"use client";

// Standalone Retrait Retours page — focused on sender pickup only
// This renders the same retrait content but without the expedition retour tab

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RotateCcw, RefreshCw, Search, X, Loader2, Package2,
  User, Phone, Check, AlertTriangle, CheckCircle2, PackageOpen, Truck,
} from "lucide-react";
import {
  getPackages, type Package as Pkg, STATUS_LABELS, STATUS_COLORS,
  type PackageStatus, getPackageStats, type PackageStats,
  searchForReturnPickup, returnPickupPackage, bulkReturnPickup,
} from "@/lib/packages";
import {
  getBags, receiveBag, unpackBag,
  type Bag, type BagStatus, BAG_STATUS_LABELS, BAG_STATUS_COLORS,
} from "@/lib/bags";
import { api, getStoredUser, isSDLocked, getLockedSDId } from "@/lib/api";
import { getWalletByPhone, type WalletWithUser } from "@/lib/wallet";
import SDSelector from "@/components/SDSelector";

/* ── theme ── */
function useIsDark() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function useTokens(isDark: boolean) {
  return isDark ? {
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    success: { text: "#22c55e", bg: "rgba(34,197,94,0.08)" },
    danger: { text: "#ef4444", bg: "rgba(239,68,68,0.08)" },
    warning: { text: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
    purple: { text: "#a855f7", bg: "rgba(168,85,247,0.08)" },
    chipActive: { text: "#f97316" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    success: { text: "#16a34a", bg: "rgba(34,197,94,0.05)" },
    danger: { text: "#dc2626", bg: "rgba(239,68,68,0.05)" },
    warning: { text: "#d97706", bg: "rgba(245,158,11,0.05)" },
    purple: { text: "#9333ea", bg: "rgba(168,85,247,0.05)" },
    chipActive: { text: "#ea580c" },
  };
}

type SDOption = { id: number; name: string; code: string | null; type: string; parent_sd_id: number | null; commune?: any };

function formatDA(n: number) { return n.toLocaleString("fr-DZ") + " DA"; }

export default function RetraitRetoursPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const sdLoaded = useRef(false);

  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Pkg[]>([]);
  const [searching, setSearching] = useState(false);
  const [walletCache, setWalletCache] = useState<Record<string, WalletWithUser | null>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filterSender, setFilterSender] = useState("");
  const [filterHasCost, setFilterHasCost] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "count" | "cost">("count");

  // Retrait modal
  const [retraitGroup, setRetraitGroup] = useState<{ name: string; phone: string; ids: number[]; count: number; cost: number } | null>(null);
  const [retraitPhone, setRetraitPhone] = useState("");
  const [retraitLoading, setRetraitLoading] = useState(false);
  const [retraitError, setRetraitError] = useState("");

  // Load SDs
  useEffect(() => {
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); sdLoaded.current = true; return; }
        if (res.data.length > 0) setSelectedSD(res.data[0].id);
        sdLoaded.current = true;
      }
    });
  }, []);

  // Fetch retour_arrive packages
  const fetchData = useCallback(async () => {
    if (!selectedSD) return;
    setLoading(true);
    const res = await getPackages({ status: "retour_arrive", origin_stop_desk_id: selectedSD, per_page: 100 });
    if (res.success && res.data) {
      setPackages(res.data.data);
      // Fetch wallets
      const phones = [...new Set(res.data.data.map(p => p.sender_phone))];
      phones.forEach(phone => {
        if (!walletCache[phone]) {
          getWalletByPhone(phone).then(r => {
            if (r.success) setWalletCache(prev => ({ ...prev, [phone]: r.data ?? null }));
          });
        }
      });
    }
    setLoading(false);
  }, [selectedSD]);

  useEffect(() => { if (sdLoaded.current) fetchData(); }, [fetchData]);

  // Search
  async function handleSearch() {
    if (!searchQuery.trim() || searchQuery.length < 3) return;
    setSearching(true);
    const res = await searchForReturnPickup(searchQuery.trim(), selectedSD ?? undefined);
    if (res.success && res.data) setSearchResults(res.data);
    else setSearchResults([]);
    setSearching(false);
  }

  // Group packages by sender
  const pkgs = searchResults.length > 0 ? searchResults : packages;
  const allGroups: Record<string, { name: string; phone: string; packages: typeof pkgs }> = {};
  pkgs.forEach(p => {
    if (!allGroups[p.sender_phone]) allGroups[p.sender_phone] = { name: p.sender_name, phone: p.sender_phone, packages: [] };
    allGroups[p.sender_phone].packages.push(p);
  });

  // Apply filters + sort
  const groupsList = Object.values(allGroups)
    .filter(group => {
      if (filterSender) {
        const s = filterSender.toLowerCase();
        if (!group.name.toLowerCase().includes(s) && !group.phone.includes(s)) return false;
      }
      if (filterHasCost === "with_cost" && group.packages.every(p => !p.return_cost || p.return_cost === 0)) return false;
      if (filterHasCost === "no_cost" && group.packages.some(p => p.return_cost && p.return_cost > 0)) return false;
      return true;
    })
    .map(g => ({ ...g, totalCost: g.packages.reduce((s, p) => s + (p.return_cost ?? 0), 0) }))
    .sort((a, b) => {
      if (sortBy === "count") return b.packages.length - a.packages.length;
      if (sortBy === "cost") return b.totalCost - a.totalCost;
      return a.name.localeCompare(b.name);
    });

  // Summary stats
  const totalExpéditeurs = groupsList.length;
  const totalPkgs = groupsList.reduce((s, g) => s + g.packages.length, 0);
  const totalReturnCost = groupsList.reduce((s, g) => s + g.totalCost, 0);
  const withWallet = groupsList.filter(g => walletCache[g.phone]).length;

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
            background: t.purple.bg, border: `1px solid ${t.purple.text}25`,
          }}>
            <RotateCcw size={20} style={{ color: t.purple.text }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Retrait Retours</h1>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Remise des colis retournés aux expéditeurs</p>
          </div>
        </div>
        <button onClick={fetchData} style={{
          padding: "8px 16px", borderRadius: 10, border: `1px solid ${t.border}`,
          background: t.card, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      {/* SD selector */}
      <div style={{ marginBottom: 20 }}>
        <SDSelector stopDesks={stopDesks} value={selectedSD} onChange={setSelectedSD} disabled={isSDLocked(getStoredUser())} />
      </div>

      {!selectedSD && (
        <div style={{ textAlign: "center", padding: "60px 0", color: t.textMuted }}>
          Sélectionnez un Stop Desk pour commencer
        </div>
      )}

      {/* Summary cards */}
      {selectedSD && !loading && totalPkgs > 0 && (
        <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 150, padding: "14px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Expéditeurs</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.purple.text }}>{totalExpéditeurs}</div>
          </div>
          <div style={{ flex: 1, minWidth: 150, padding: "14px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Colis</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{totalPkgs}</div>
          </div>
          <div style={{ flex: 1, minWidth: 150, padding: "14px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Frais retour total</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.warning.text }}>{formatDA(totalReturnCost)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 150, padding: "14px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Avec portefeuille</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.success.text }}>{withWallet} / {totalExpéditeurs}</div>
          </div>
        </div>
      )}

      {selectedSD && (
        <div style={{
          background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 10 }}>
            <RotateCcw size={16} style={{ color: t.purple.text }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text, flex: 1 }}>
              {pkgs.length} colis en attente de retrait
            </span>
          </div>
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
                <input
                  placeholder="Téléphone ou nom expéditeur..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                  style={{
                    width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10,
                    border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
                    fontSize: 13, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <button onClick={handleSearch} disabled={searching} style={{
                padding: "0 18px", borderRadius: 10, border: "none",
                background: t.purple.text, color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: searching ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6,
              }}>
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Rechercher
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input placeholder="Filtrer par expéditeur..." value={filterSender} onChange={e => setFilterSender(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 11, outline: "none" }}
              />
              <select value={filterHasCost} onChange={e => setFilterHasCost(e.target.value)} style={{
                padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
                background: t.inp.bg, color: t.inp.text, fontSize: 11, cursor: "pointer",
              }}>
                <option value="">Tous</option>
                <option value="with_cost">Avec frais retour</option>
                <option value="no_cost">Sans frais</option>
              </select>
              <div style={{ width: 1, height: 18, background: t.border }} />
              <span style={{ fontSize: 10, color: t.textFaint }}>Trier:</span>
              {[
                { v: "count" as const, l: "Nb colis" },
                { v: "cost" as const, l: "Frais" },
                { v: "name" as const, l: "Nom" },
              ].map(s => (
                <button key={s.v} onClick={() => setSortBy(s.v)} style={{
                  padding: "4px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600,
                  border: `1px solid ${sortBy === s.v ? t.purple.text : t.border}`,
                  background: sortBy === s.v ? t.purple.bg : "transparent",
                  color: sortBy === s.v ? t.purple.text : t.textMuted, cursor: "pointer",
                }}>{s.l}</button>
              ))}
            </div>
          </div>

          {/* Grouped list */}
          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            {loading && <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}><Loader2 size={16} className="animate-spin" /></div>}
            {!loading && pkgs.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                Aucun colis en attente de retrait
              </div>
            )}
            {groupsList.map(group => {
              const totalCost = group.totalCost;
              const wd = walletCache[group.phone];
              const balance = wd?.wallet?.balance ?? null;
              return (
                <div key={group.phone} style={{ borderBottom: `2px solid ${t.divider}` }}>
                  <div style={{
                    padding: "14px 20px", background: t.purple.bg,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: t.purple.text, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <User size={16} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                          {group.name}
                          {wd?.user?.company_name && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400, marginLeft: 6 }}>({wd.user.company_name})</span>}
                        </div>
                        <div style={{ fontSize: 12, color: t.textMuted }}>
                          <Phone size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                          {group.phone} · {group.packages.length} colis
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {balance !== null && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: balance >= 0 ? t.success.text : t.danger.text }}>{formatDA(balance)}</div>
                          <div style={{ fontSize: 10, color: t.textMuted }}>solde</div>
                        </div>
                      )}
                      {totalCost > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.warning.text }}>-{formatDA(totalCost)}</div>
                          <div style={{ fontSize: 10, color: t.textMuted }}>frais retour</div>
                        </div>
                      )}
                    </div>
                  </div>
                  {group.packages.map(pkg => (
                    <div key={pkg.id} style={{ padding: "10px 20px 10px 64px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: "monospace" }}>{pkg.tracking_number}</span>
                        <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 8 }}>{pkg.content_description}</span>
                        {pkg.return_cost !== null && pkg.return_cost > 0 && (
                          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: t.warning.text, background: t.warning.bg, padding: "1px 6px", borderRadius: 4 }}>{pkg.return_cost} DA</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => {
                      setRetraitGroup({
                        name: group.name, phone: group.phone,
                        ids: group.packages.map(p => p.id),
                        count: group.packages.length,
                        cost: totalCost,
                      });
                      setRetraitPhone("");
                      setRetraitError("");
                    }} style={{
                      padding: "9px 20px", borderRadius: 10, border: "none",
                      background: t.purple.text, color: "#fff", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <RotateCcw size={14} />
                      Retrait {group.packages.length > 1 ? `(${group.packages.length} colis)` : ""}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Retrait Modal */}
      {retraitGroup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)" }}
          onClick={() => setRetraitGroup(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: isDark ? "#111827" : "#fff", borderRadius: 16, width: "100%", maxWidth: 440,
            border: `1px solid ${t.border}`, overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: t.purple.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RotateCcw size={18} style={{ color: t.purple.text }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Retrait Expéditeur</h3>
                <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>{retraitGroup.count} colis</p>
              </div>
              <button onClick={() => setRetraitGroup(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={18} style={{ color: t.textMuted }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Sender info */}
              {(() => {
                const wd = walletCache[retraitGroup.phone];
                const walletBalance = wd?.wallet?.balance ?? null;
                return (
              <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#f9fafb", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: t.purple.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={16} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                      {retraitGroup.name}
                      {wd?.user?.company_name && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400, marginLeft: 6 }}>({wd.user.company_name})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{retraitGroup.phone}</div>
                  </div>
                  {walletBalance !== null && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: Number(walletBalance) >= 0 ? t.success.text : t.danger.text }}>{formatDA(Number(walletBalance))}</div>
                      <div style={{ fontSize: 9, color: t.textMuted }}>solde wallet</div>
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: isDark ? "#1e2130" : "#fff", border: `1px solid ${t.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{retraitGroup.count}</div>
                    <div style={{ fontSize: 9, color: t.textMuted, textTransform: "uppercase" }}>Colis</div>
                  </div>
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: isDark ? "#1e2130" : "#fff", border: `1px solid ${t.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: retraitGroup.cost > 0 ? t.warning.text : t.textFaint }}>{formatDA(retraitGroup.cost)}</div>
                    <div style={{ fontSize: 9, color: t.textMuted, textTransform: "uppercase" }}>Frais retour</div>
                  </div>
                </div>
                {/* Colis list */}
                <div style={{ maxHeight: 120, overflowY: "auto", borderRadius: 8, border: `1px solid ${t.border}` }}>
                  {packages.filter(p => retraitGroup.ids.includes(p.id)).map((p, i) => (
                    <div key={p.id} style={{
                      padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 8,
                      borderBottom: i < retraitGroup.count - 1 ? `1px solid ${t.divider}` : "none",
                    }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: t.text }}>{p.tracking_number}</span>
                      <span style={{ color: t.textMuted, flex: 1 }}>{p.content_description}</span>
                      {p.return_cost && p.return_cost > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: t.warning.text }}>{p.return_cost} DA</span>
                      )}
                    </div>
                  ))}
                </div>
                {walletBalance !== null && retraitGroup.cost > 0 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: t.warning.bg, border: `1px solid ${t.warning.text}30`, fontSize: 11, color: t.warning.text }}>
                    Après retrait: solde wallet = {formatDA(Number(walletBalance) - retraitGroup.cost)}
                  </div>
                )}
              </div>
                );
              })()}

              {/* Phone verification */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>
                  Vérification — Numéro de téléphone de l'expéditeur
                </label>
                <div style={{ position: "relative" }}>
                  <Phone size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
                  <input
                    type="tel" value={retraitPhone} onChange={e => setRetraitPhone(e.target.value)}
                    placeholder="Ex: 0555123456" autoFocus
                    style={{
                      width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10,
                      border: `1px solid ${retraitError ? t.danger.text + "50" : t.border}`,
                      background: isDark ? "#1e2130" : "#fff", color: t.text, fontSize: 14,
                      outline: "none", boxSizing: "border-box",
                    }}
                    onKeyDown={async e => {
                      if (e.key === "Enter") {
                        if (!retraitPhone.trim()) { setRetraitError("Veuillez saisir le numéro"); return; }
                        setRetraitLoading(true); setRetraitError("");
                        const res = await bulkReturnPickup(retraitGroup.ids, retraitPhone.trim());
                        setRetraitLoading(false);
                        if (res.success) {
                          setToast({ message: `${res.data?.processed} colis retournés · ${formatDA(res.data?.total_return_cost ?? 0)} collectés`, type: "success" });
                          setRetraitGroup(null);
                          fetchData();
                        } else {
                          setRetraitError((res as any).message || "Erreur");
                        }
                      }
                    }}
                  />
                </div>
                {retraitError && <p style={{ margin: "6px 0 0", fontSize: 12, color: t.danger.text }}>{retraitError}</p>}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.divider}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setRetraitGroup(null)} style={{
                padding: "9px 18px", borderRadius: 10, border: `1px solid ${t.border}`,
                background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Annuler</button>
              <button onClick={async () => {
                if (!retraitPhone.trim()) { setRetraitError("Veuillez saisir le numéro"); return; }
                setRetraitLoading(true); setRetraitError("");
                const res = await bulkReturnPickup(retraitGroup.ids, retraitPhone.trim());
                setRetraitLoading(false);
                if (res.success) {
                  setToast({ message: `${res.data?.processed} colis retournés · ${formatDA(res.data?.total_return_cost ?? 0)} collectés`, type: "success" });
                  setRetraitGroup(null);
                  fetchData();
                } else {
                  setRetraitError((res as any).message || "Erreur");
                }
              }} disabled={retraitLoading} style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: t.purple.text, color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: retraitLoading ? "not-allowed" : "pointer", opacity: retraitLoading ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {retraitLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmer le retrait
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === "success" ? "#16a34a" : "#dc2626", color: "#fff",
          padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 8,
        }}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
