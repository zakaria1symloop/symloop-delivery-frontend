"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Store, ArrowLeft, RefreshCw, Plus, X, Loader2,
  TrendingUp, TrendingDown, Wallet, Filter, Truck,
  ChevronLeft, ChevronRight, Settings, Pencil, Trash2,
  AlertTriangle, Check, XCircle, Banknote, Receipt,
} from "lucide-react";
import { api, getStoredUser } from "@/lib/api";
import {
  getCaisses, getCaisseBalances, getCaisseTransactions,
  createCaisseTransaction, createCaisse, updateCaisse, deleteCaisse,
  formatDA, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS,
  type Caisse, type CaisseWithBalance, type CaisseTransaction as TxnType,
  type TransactionFilters, type TransactionType,
} from "@/lib/caisse";
import type { StopDesk } from "@/lib/geography";

/* ── theme ───────────────────────────────────────────────── */
function useIsDark() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
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
    bg:         "#0e1017",
    card:       "#111827",
    cardHover:  "#161d2e",
    border:     "#1e2130",
    divider:    "#1e2130",
    rowHover:   "#1a1f2e",
    text:       "#f0f0f5",
    textSub:    "#d1d5db",
    textMuted:  "#6b7280",
    textFaint:  "#4b5563",
    shadow:     "none",
    shadowHover:"0 2px 12px rgba(0,0,0,0.25)",
    modalBg:    "#111827",
    overlay:    "rgba(0,0,0,0.6)",
    inp:        { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    label:      "#6b7280",
    banner:     { bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.18)" },
    warnBanner: { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)" },
    iconBg:     "rgba(255,255,255,0.07)",
  } : {
    bg:         "#ffffff",
    card:       "#ffffff",
    cardHover:  "#fafbfc",
    border:     "#e5e7eb",
    divider:    "#f3f4f6",
    rowHover:   "#f9fafb",
    text:       "#111827",
    textSub:    "#374151",
    textMuted:  "#6b7280",
    textFaint:  "#9ca3af",
    shadow:     "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    shadowHover:"0 2px 8px rgba(0,0,0,0.08)",
    modalBg:    "#ffffff",
    overlay:    "rgba(0,0,0,0.35)",
    inp:        { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    label:      "#6b7280",
    banner:     { bg: "rgba(239,68,68,0.04)", border: "rgba(239,68,68,0.15)" },
    warnBanner: { bg: "rgba(245,158,11,0.04)", border: "rgba(245,158,11,0.15)" },
    iconBg:     "#f3f4f6",
  };
}

type Tokens = ReturnType<typeof useTokens>;

function inpStyle(t: Tokens): React.CSSProperties {
  return {
    width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 7, padding: "8px 11px", fontSize: 13,
    color: t.inp.text, outline: "none", transition: "border-color 0.15s",
    boxSizing: "border-box",
  };
}

function selStyle(t: Tokens): React.CSSProperties {
  return {
    background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 7, padding: "7px 11px", fontSize: 13,
    color: t.inp.text, outline: "none", cursor: "pointer",
    appearance: "auto" as React.CSSProperties["appearance"],
  };
}

function IconBtn({ onClick, title, danger, disabled, children }: {
  onClick: () => void; title?: string;
  danger?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.06)") : "transparent",
        border: "none", borderRadius: 5, padding: "5px 6px",
        cursor: disabled ? "not-allowed" : "pointer",
        color: danger ? "#ef4444" : "inherit",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.4 : 1, transition: "background 0.1s",
      }}
    >{children}</button>
  );
}

function PrimaryBtn({ onClick, disabled, children, style }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: disabled ? "#d4a373" : (hov ? "#ea580c" : "#f97316"),
        border: "none", borderRadius: 7, padding: "7px 16px",
        fontSize: 13, fontWeight: 600, color: "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1, transition: "background 0.12s",
        ...style,
      }}
    >{children}</button>
  );
}

/* ── status config ────────────────────────────────────────── */
const STATUS_CFG = {
  active:   { label: "Active",   color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.22)" },
  inactive: { label: "Inactive", color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.22)" },
};

/* ── main page ────────────────────────────────────────────── */
export default function CaissePage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const user = getStoredUser();
  const isAdmin = user?.user_type === "admin";

  const [balances, setBalances] = useState<CaisseWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaisse, setSelectedCaisse] = useState<CaisseWithBalance | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "sd" | "driver">("sd");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "balance_desc" | "balance_asc">("name");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "positive" | "zero" | "negative">("all");

  // Management
  const [showManagement, setShowManagement] = useState(false);
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [stopDesks, setStopDesks] = useState<StopDesk[]>([]);
  const [loadingMgmt, setLoadingMgmt] = useState(false);
  const [unassignedSDs, setUnassignedSDs] = useState<StopDesk[]>([]);

  // Caisse form modal (lifted here so it renders outside dash-fade-up)
  const [showFormModal, setShowFormModal] = useState(false);
  const [editFormCaisse, setEditFormCaisse] = useState<Caisse | null>(null);
  const [quickAssignSD, setQuickAssignSD] = useState<StopDesk | null>(null);

  // SD config data for admin financial overview
  const [sdConfigData, setSdConfigData] = useState<any[]>([]);
  const [adminCaisseData, setAdminCaisseData] = useState<{ id: number; balance: number; total_in: number; total_out: number } | null>(null);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    const res = await getCaisseBalances();
    if (res.success && res.data) {
      setBalances(res.data);
      if (!isAdmin && res.data.length === 1) setSelectedCaisse(res.data[0]);
    }
    setLoading(false);
  }, [isAdmin]);

  const loadManagement = useCallback(async () => {
    setLoadingMgmt(true);
    const [cr, sr] = await Promise.all([getCaisses(), api<StopDesk[]>("/stop-desks")]);
    if (cr.success && cr.data) setCaisses(cr.data);
    if (sr.success && sr.data) setStopDesks(sr.data);
    if (cr.success && cr.data && sr.success && sr.data) {
      const taken = new Set(cr.data.filter(c => c.stop_desk_id).map(c => c.stop_desk_id!));
      setUnassignedSDs(sr.data.filter(sd => sd.is_active && !taken.has(sd.id)));
    }
    setLoadingMgmt(false);
  }, []);

  useEffect(() => {
    loadBalances();
    if (isAdmin) {
      loadManagement();
      api<any>("/sd-config").then(res => {
        if ((res as any).success && (res as any).data) setSdConfigData((res as any).data);
        if ((res as any).success && (res as any).admin_caisse) setAdminCaisseData((res as any).admin_caisse);
      });
    }
  }, [loadBalances, isAdmin, loadManagement]);

  // Compute available SDs for the form modal
  const assignedSdIds = new Set(caisses.filter(c => c.stop_desk_id).map(c => c.stop_desk_id!));
  const availableSDsForForm = editFormCaisse?.stop_desk_id
    ? [...stopDesks.filter(sd => sd.is_active && !assignedSdIds.has(sd.id)), stopDesks.find(sd => sd.id === editFormCaisse.stop_desk_id)!].filter(Boolean)
    : stopDesks.filter(sd => sd.is_active && !assignedSdIds.has(sd.id));

  /* ── transactions view ── */
  if (selectedCaisse) {
    return (
      <TransactionsView t={t} isDark={isDark} caisse={selectedCaisse} isAdmin={isAdmin}
        onBack={() => { setSelectedCaisse(null); loadBalances(); }} />
    );
  }

  /* ── overview ── */
  const total = balances.reduce((s, b) => s + (b.total_in - b.total_out), 0);

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      <style>{`
        .caisse-card { transition: background 0.12s, box-shadow 0.12s, border-color 0.12s; }
        .caisse-card:hover { border-color: rgba(249,115,22,0.4) !important; }
        @media (max-width: 640px) { .caisse-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 900px) { .caisse-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>

      {/* Header */}
      <div className="dash-fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={16} color="#f97316" strokeWidth={1.8} />
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>Caisse</h1>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: t.textMuted }}>
            {isAdmin ? "Vue globale de toutes les caisses" : "Votre caisse"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && (
            <button
              onClick={() => setShowManagement(!showManagement)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: showManagement ? "#f97316" : "transparent",
                color: showManagement ? "#fff" : t.textSub,
                border: `1px solid ${showManagement ? "#f97316" : t.border}`,
                borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", transition: "all 0.14s",
              }}
            >
              <Settings size={13} /> Gérer les caisses
            </button>
          )}
          <button
            onClick={() => { loadBalances(); if (isAdmin) loadManagement(); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: `1px solid ${t.border}`,
              borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 500,
              color: t.textSub, cursor: "pointer", transition: "background 0.12s",
            }}
          >
            <RefreshCw size={12} /> Actualiser
          </button>
          {isAdmin && (
            <button
              onClick={async () => {
                if (!confirm("Supprimer tous les transferts et transactions ? Les caisses resteront.")) return;
                const res = await api("/admin/clean-money", { method: "POST", body: JSON.stringify({}) });
                if ((res as any).success) {
                  loadBalances();
                  loadManagement();
                  api<any>("/sd-config").then(r => {
                    if ((r as any).success && (r as any).data) setSdConfigData((r as any).data);
                    if ((r as any).success && (r as any).admin_caisse) setAdminCaisseData((r as any).admin_caisse);
                  });
                }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 500,
                color: "#ef4444", cursor: "pointer",
              }}
            >
              <Trash2 size={12} /> Nettoyer argent
            </button>
          )}
        </div>
      </div>

      {/* Total banner */}
      <div className="dash-fade-up" style={{
        animationDelay: "80ms", marginBottom: 24,
        background: "linear-gradient(135deg, #f97316 0%, #ea580c 60%, #c2410c 100%)",
        borderRadius: 12, padding: "22px 24px", position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", right: -30, top: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", right: 50, bottom: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, position: "relative" }}>
          <Wallet size={16} color="rgba(255,255,255,0.7)" />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Solde total</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", position: "relative" }}>
          {formatDA(total)}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, position: "relative" }}>
          {balances.length} caisse{balances.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Management panel */}
      {isAdmin && showManagement && (
        <div className="dash-fade-up" style={{ animationDelay: "100ms", marginBottom: 24 }}>
          <ManagementPanel t={t} isDark={isDark} caisses={caisses} stopDesks={stopDesks}
            unassignedSDs={unassignedSDs}
            loading={loadingMgmt} onRefresh={() => { loadManagement(); loadBalances(); }}
            onCreateClick={() => { setEditFormCaisse(null); setShowFormModal(true); }}
            onEditClick={(c) => { setEditFormCaisse(c); setShowFormModal(true); }}
            onQuickAssign={(sd) => {
              setEditFormCaisse(null);
              setShowFormModal(true);
              // Pre-fill will be handled by passing the SD to the modal
              setQuickAssignSD(sd);
            }}
          />
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Loader2 size={22} color="#f97316" style={{ animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : balances.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: t.textFaint }}>
          <Store size={36} style={{ opacity: 0.25, margin: "0 auto 8px" }} />
          <p style={{ margin: 0, fontSize: 13 }}>Aucune caisse disponible</p>
        </div>
      ) : (<>
        {/* Admin global totals */}
        {isAdmin && (
          <div className="dash-fade-up" style={{ animationDelay: "60ms", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
            {(() => {
              const sdBalances = balances.filter(b => b.caisse_type === "sd");
              const totalSDCash = sdBalances.reduce((s, b) => s + b.balance, 0);
              // Net balance per SD (positive = SD owes, negative = admin owes)
              const totalNetOwed = sdConfigData.filter(sd => sd.has_caisse).reduce((s: number, sd: any) => s + (sd.net_balance ?? 0), 0);
              return (<>
            <div
              onClick={() => {
                const adminC = balances.find(b => b.caisse_type === "admin");
                if (adminC) setSelectedCaisse(adminC);
              }}
              style={{ padding: "14px 18px", borderRadius: 12, background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))", border: "1.5px solid rgba(245,158,11,0.25)", cursor: "pointer", transition: "transform 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 4 }}>Caisse Admin →</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{formatDA(adminCaisseData?.balance ?? 0)}</div>
              <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>Cliquer pour gérer / retirer</div>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Cash dans les SDs</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f97316" }}>{formatDA(totalSDCash)}</div>
              <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>Solde physique caisses SDs</div>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>
                {totalNetOwed >= 0 ? "SDs doivent net" : "Admin doit net"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: totalNetOwed >= 0 ? "#f59e0b" : "#ef4444" }}>{formatDA(Math.abs(totalNetOwed))}</div>
              <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>Solde net après compensation</div>
            </div>
              </>);
            })()}
          </div>
        )}

        {/* Search + Filter bar */}
        <div className="dash-fade-up" style={{
          animationDelay: "80ms", marginBottom: 16,
          background: t.card, borderRadius: 12, border: `1px solid ${t.border}`,
          padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, boxShadow: t.shadow,
        }}>
          {/* Row 1: Search + Sort */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "1 1 240px", position: "relative" }}>
              <Filter size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, chauffeur, stop desk..."
                style={{
                  width: "100%", padding: "8px 10px 8px 30px", borderRadius: 8,
                  border: `1px solid ${t.border}`, background: isDark ? "#1e2130" : "#fff",
                  color: t.text, fontSize: 12, outline: "none", boxSizing: "border-box" as const,
                }}
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              style={{
                padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                background: isDark ? "#1e2130" : "#fff", color: t.text, fontSize: 12,
                cursor: "pointer", outline: "none",
              }}
            >
              <option value="name">Tri: Nom A-Z</option>
              <option value="balance_desc">Tri: Solde ↓</option>
              <option value="balance_asc">Tri: Solde ↑</option>
            </select>
          </div>

          {/* Row 2: Type chips + Balance filter */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {/* Type chips */}
            {(() => {
              const sdCount = balances.filter(b => b.caisse_type === "sd").length;
              const driverCount = balances.filter(b => b.caisse_type === "driver").length;
              const chips: { key: "all" | "sd" | "driver"; label: string; count: number; color: string; icon: string }[] = [
                { key: "all", label: "Toutes", count: balances.length, color: "#6b7280", icon: "" },
                { key: "sd", label: "Stop Desks", count: sdCount, color: "#f97316", icon: "🏪" },
                ...(driverCount > 0 ? [{ key: "driver" as const, label: "Chauffeurs", count: driverCount, color: "#0ea5e9", icon: "🚚" }] : []),
              ];
              return chips.map(chip => {
                const active = typeFilter === chip.key;
                return (
                  <button key={chip.key} onClick={() => setTypeFilter(chip.key)} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: 99, border: `1.5px solid ${active ? chip.color : "transparent"}`,
                    background: active ? `${chip.color}15` : (isDark ? "#1e2130" : "#f3f4f6"),
                    color: active ? chip.color : t.textSub,
                    fontSize: 11, fontWeight: active ? 700 : 500, cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {chip.label}
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 99,
                      background: active ? `${chip.color}20` : (isDark ? "#2a3145" : "#e5e7eb"),
                      color: active ? chip.color : t.textMuted,
                    }}>{chip.count}</span>
                  </button>
                );
              });
            })()}

            <div style={{ width: 1, height: 18, background: t.border, margin: "0 4px" }} />

            {/* Balance filter */}
            {[
              { key: "all" as const, label: "Tous soldes" },
              { key: "positive" as const, label: "Solde > 0" },
              { key: "zero" as const, label: "Solde = 0" },
              { key: "negative" as const, label: "Solde < 0" },
            ].map(bf => {
              const active = balanceFilter === bf.key;
              return (
                <button key={bf.key} onClick={() => setBalanceFilter(bf.key)} style={{
                  padding: "5px 12px", borderRadius: 99, border: "none",
                  background: active ? (isDark ? "#2a3145" : "#e5e7eb") : "transparent",
                  color: active ? t.text : t.textMuted,
                  fontSize: 11, fontWeight: active ? 600 : 400, cursor: "pointer",
                }}>
                  {bf.label}
                </button>
              );
            })}

            {/* Reset */}
            {(searchQuery || typeFilter !== "all" || balanceFilter !== "all" || sortBy !== "name") && (
              <button onClick={() => { setSearchQuery(""); setTypeFilter("all"); setBalanceFilter("all"); setSortBy("name"); }} style={{
                padding: "4px 10px", borderRadius: 8, border: `1px solid ${t.border}`,
                background: "transparent", color: t.textMuted, fontSize: 10, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}>
                <X size={10} /> Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Filtered results count */}
        {(() => {
          const filtered = balances
            .filter(c => c.caisse_type !== "admin") // admin caisse shown in top stats
            .filter(c => typeFilter === "all" ? true : typeFilter === "driver" ? c.caisse_type === "driver" : c.caisse_type === "sd")
            .filter(c => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return c.name.toLowerCase().includes(q)
                || (c.stop_desk?.name ?? "").toLowerCase().includes(q)
                || (c.stop_desk?.code ?? "").toLowerCase().includes(q)
                || (c.driver_user ? `${c.driver_user.first_name} ${c.driver_user.last_name}`.toLowerCase().includes(q) : false)
                || (c.driver_user?.phone ?? "").includes(q);
            })
            .filter(c => {
              if (balanceFilter === "all") return true;
              const bal = c.total_in - c.total_out;
              if (balanceFilter === "positive") return bal > 0;
              if (balanceFilter === "zero") return bal === 0;
              if (balanceFilter === "negative") return bal < 0;
              return true;
            })
            .sort((a, b) => {
              if (sortBy === "balance_desc") return (b.total_in - b.total_out) - (a.total_in - a.total_out);
              if (sortBy === "balance_asc") return (a.total_in - a.total_out) - (b.total_in - b.total_out);
              return a.name.localeCompare(b.name);
            });

          return (
            <>
              {(searchQuery || typeFilter !== "all" || balanceFilter !== "all") && (
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10, fontWeight: 500 }}>
                  {filtered.length} caisse{filtered.length !== 1 ? "s" : ""} trouvée{filtered.length !== 1 ? "s" : ""}
                </div>
              )}
              <div className="caisse-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {filtered.map((c, i) => (
                  <CaisseCard key={c.id} t={t} isDark={isDark} caisse={c} delay={50 + i * 30}
                    onClick={() => setSelectedCaisse(c)} />
                ))}
                {filtered.length === 0 && (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", color: t.textFaint }}>
                    <Store size={32} style={{ opacity: 0.2, margin: "0 auto 8px", display: "block" }} />
                    <p style={{ margin: 0, fontSize: 13 }}>Aucune caisse trouvée</p>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </>)}

      {/* Caisse form modal — rendered at root level for proper centering */}
      {showFormModal && (
        <CaisseFormModal t={t} isDark={isDark} caisse={editFormCaisse}
          availableSDs={availableSDsForForm}
          prefillSD={quickAssignSD}
          onClose={() => { setShowFormModal(false); setEditFormCaisse(null); setQuickAssignSD(null); }}
          onSaved={() => { setShowFormModal(false); setEditFormCaisse(null); setQuickAssignSD(null); loadManagement(); loadBalances(); }}
        />
      )}
    </div>
  );
}

/* ── CaisseCard ─────────────────────────────────────────── */
function CaisseCard({ t, isDark, caisse: c, delay, onClick }: {
  t: Tokens; isDark: boolean; caisse: CaisseWithBalance; delay: number; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="dash-fade-up caisse-card"
      style={{
        animationDelay: `${delay}ms`, textAlign: "left" as const,
        background: hov ? t.cardHover : t.card,
        border: `1px solid ${t.border}`, borderRadius: 10, padding: "16px 18px",
        boxShadow: hov ? t.shadowHover : t.shadow,
        cursor: "pointer", width: "100%",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: c.caisse_type === "driver" ? "rgba(14,165,233,0.09)" : "rgba(249,115,22,0.09)",
          border: `1px solid ${c.caisse_type === "driver" ? "rgba(14,165,233,0.18)" : "rgba(249,115,22,0.18)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {c.caisse_type === "driver"
            ? <Truck size={15} color="#0ea5e9" strokeWidth={1.8} />
            : <Store size={15} color="#f97316" strokeWidth={1.8} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: hov ? "#f97316" : t.text, transition: "color 0.12s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {c.name}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
            {c.caisse_type === "driver" && c.driver_user
              ? <span style={{ color: "#0ea5e9", fontWeight: 500 }}>Chauffeur · {c.driver_user.phone ?? ""}</span>
              : c.stop_desk
              ? `${c.stop_desk.name}${c.stop_desk.code ? ` · ${c.stop_desk.code}` : ""}`
              : <span style={{ color: "#f59e0b", fontWeight: 600 }}>Non assignée</span>
            }
          </div>
        </div>
        {c.caisse_type === "driver" && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "#0ea5e9", background: "rgba(14,165,233,0.1)", padding: "2px 7px", borderRadius: 99 }}>
            CHAUFFEUR
          </span>
        )}
      </div>
      {/* Warning if no SD and not a driver caisse */}
      {!c.stop_desk && c.caisse_type !== "driver" && (
        <div style={{
          display: "flex", alignItems: "center", gap: 5, marginBottom: 10,
          fontSize: 10, fontWeight: 600, color: "#f59e0b",
          background: t.warnBanner.bg, border: `1px solid ${t.warnBanner.border}`,
          borderRadius: 6, padding: "4px 8px",
        }}>
          <AlertTriangle size={10} /> Pas de stop desk
        </div>
      )}
      {/* Physical cash = total_in - total_out */}
      <div style={{ fontSize: 20, fontWeight: 700, color: "#f97316", letterSpacing: "-0.01em" }}>
        {formatDA(c.total_in - c.total_out)}
      </div>
      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>en caisse (physique)</div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.textMuted }}>
          <TrendingUp size={11} color="#10b981" /> Entrées: {formatDA(c.total_in)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.textMuted }}>
          <TrendingDown size={11} color="#ef4444" /> Sorties: {formatDA(c.total_out)}
        </span>
      </div>
    </button>
  );
}

/* ── Management Panel ───────────────────────────────────── */
function ManagementPanel({ t, isDark, caisses, stopDesks, unassignedSDs, loading, onRefresh, onCreateClick, onEditClick, onQuickAssign }: {
  t: Tokens; isDark: boolean; caisses: Caisse[]; stopDesks: StopDesk[];
  unassignedSDs: StopDesk[];
  loading: boolean; onRefresh: () => void;
  onCreateClick: () => void; onEditClick: (c: Caisse) => void;
  onQuickAssign: (sd: StopDesk) => void;
}) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteErr, setDeleteErr] = useState("");
  const [hovRow, setHovRow] = useState<number | null>(null);

  async function handleDelete(id: number) {
    setDeleteErr(""); setDeleting(id);
    const res = await deleteCaisse(id);
    setDeleting(null);
    if (res.success) onRefresh();
    else setDeleteErr(res.message || "Erreur lors de la suppression");
  }

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: t.shadow, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px", borderBottom: `1px solid ${t.border}`,
        background: isDark ? "rgba(255,255,255,0.02)" : "#fafbfc",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Settings size={13} color={t.textMuted} />
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Gestion des caisses</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.1)", padding: "1px 7px", borderRadius: 20 }}>
            {caisses.length}
          </span>
        </div>
        <PrimaryBtn onClick={onCreateClick}>
          <Plus size={13} /> Créer
        </PrimaryBtn>
      </div>

      {/* Unassigned SD warnings */}
      {unassignedSDs.length > 0 && (
        <div style={{
          margin: "12px 18px 0", padding: "10px 14px", borderRadius: 8,
          background: t.banner.bg, border: `1px solid ${t.banner.border}`,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#ef4444" }}>
              {unassignedSDs.length} stop desk{unassignedSDs.length > 1 ? "s" : ""} sans caisse — création de colis bloquée
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {unassignedSDs.map(sd => (
                <button
                  key={sd.id}
                  onClick={() => onQuickAssign(sd)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                    background: "rgba(249,115,22,0.08)", color: "#f97316",
                    border: "1px solid rgba(249,115,22,0.2)",
                    cursor: "pointer", transition: "all 0.12s",
                  }}
                >
                  <Plus size={10} strokeWidth={2.5} />
                  {sd.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {deleteErr && (
        <div style={{ margin: "12px 18px 0", padding: "8px 12px", borderRadius: 7, fontSize: 12, color: "#ef4444", background: t.banner.bg, border: `1px solid ${t.banner.border}` }}>
          {deleteErr}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
          <Loader2 size={18} color="#f97316" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : caisses.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: t.textFaint }}>
          Aucune caisse créée
        </div>
      ) : (
        <div>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1.5fr 80px", padding: "8px 18px", borderBottom: `1px solid ${t.divider}` }}>
            {["Nom", "Stop Desk", "Statut", "Créée par", "Actions"].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: t.textMuted, textAlign: h === "Actions" ? "right" as const : "left" as const }}>
                {h}
              </span>
            ))}
          </div>
          {/* Rows */}
          {caisses.map(c => {
            const hov = hovRow === c.id;
            const st = c.is_active ? STATUS_CFG.active : STATUS_CFG.inactive;
            return (
              <div
                key={c.id}
                onMouseEnter={() => setHovRow(c.id)} onMouseLeave={() => setHovRow(null)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1.5fr 80px",
                  padding: "10px 18px", alignItems: "center",
                  borderBottom: `1px solid ${t.divider}`,
                  background: hov ? t.rowHover : "transparent",
                  transition: "background 0.12s",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{c.name}</span>
                <span style={{ fontSize: 12, color: c.stop_desk ? t.textSub : "#f59e0b", fontWeight: c.stop_desk ? 400 : 600 }}>
                  {c.stop_desk
                    ? `${c.stop_desk.name}${c.stop_desk.code ? ` (${c.stop_desk.code})` : ""}`
                    : "Non assignée"}
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content",
                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                  color: st.color, background: st.bg, border: `1px solid ${st.border}`,
                }}>
                  {c.is_active ? <Check size={9} /> : <XCircle size={9} />}
                  {st.label}
                </span>
                <span style={{ fontSize: 12, color: t.textMuted }}>
                  {c.created_by_user ? `${c.created_by_user.first_name} ${c.created_by_user.last_name}` : "—"}
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                  <IconBtn onClick={() => onEditClick(c)} title="Modifier">
                    <Pencil size={13} color={t.textMuted} />
                  </IconBtn>
                  <IconBtn onClick={() => handleDelete(c.id)} title="Supprimer" danger disabled={deleting === c.id}>
                    <Trash2 size={13} />
                  </IconBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── CaisseFormModal ────────────────────────────────────── */
function CaisseFormModal({ t, isDark, caisse, availableSDs, prefillSD, onClose, onSaved }: {
  t: Tokens; isDark: boolean; caisse: Caisse | null; availableSDs: StopDesk[];
  prefillSD?: StopDesk | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(caisse?.name ?? (prefillSD ? `Caisse ${prefillSD.name}` : ""));
  const [sdId, setSdId] = useState(caisse?.stop_desk_id ? String(caisse.stop_desk_id) : (prefillSD ? String(prefillSD.id) : ""));
  const [isActive, setIsActive] = useState(caisse?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit() {
    if (!name.trim()) { setError("Le nom est requis."); return; }
    setError(""); setSubmitting(true);
    const payload = { name: name.trim(), stop_desk_id: sdId ? Number(sdId) : null, is_active: isActive };
    const res = caisse ? await updateCaisse(caisse.id, payload) : await createCaisse(payload);
    setSubmitting(false);
    if (res.success) onSaved(); else setError(res.message || "Erreur");
  }

  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: t.label, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: t.overlay, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 12,
        width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        fontFamily: "var(--font-jakarta, sans-serif)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ position: "relative", padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#f97316", borderRadius: "12px 0 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Banknote size={15} color="#f97316" strokeWidth={1.8} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                {caisse ? "Modifier la caisse" : "Créer une caisse"}
              </span>
            </div>
            <IconBtn onClick={onClose} title="Fermer"><X size={15} color={t.textMuted} /></IconBtn>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "8px 12px", borderRadius: 7, fontSize: 12, color: "#ef4444", background: t.banner.bg, border: `1px solid ${t.banner.border}` }}>
              {error}
            </div>
          )}
          <div>
            <label style={lbl}>Nom <span style={{ color: "#f97316" }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Caisse Alger Centre" style={inpStyle(t)} />
          </div>
          <div>
            <label style={lbl}>Stop Desk</label>
            <select value={sdId} onChange={e => setSdId(e.target.value)} style={{ ...selStyle(t), width: "100%" }}>
              <option value="">— Non assignée —</option>
              {availableSDs.map(sd => (
                <option key={sd.id} value={sd.id}>{sd.name}{sd.code ? ` (${sd.code})` : ""} — {sd.type}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ ...lbl, margin: 0 }}>Active</label>
            <button
              type="button" onClick={() => setIsActive(!isActive)}
              style={{
                width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                background: isActive ? "#10b981" : (isDark ? "#374151" : "#d1d5db"),
                position: "relative", transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 2, left: isActive ? 20 : 2,
                width: 18, height: 18, borderRadius: 9, background: "#fff",
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>
            Annuler
          </button>
          <PrimaryBtn onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : caisse ? "Enregistrer" : "Créer"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

/* ── TransactionsView ───────────────────────────────────── */
function TransactionsView({ t, isDark, caisse: caisseProp, isAdmin, onBack }: {
  t: Tokens; isDark: boolean; caisse: CaisseWithBalance; isAdmin: boolean; onBack: () => void;
}) {
  // Local copy so we can update balance immediately on mutations
  const [caisse, setCaisse] = useState<CaisseWithBalance>(caisseProp);
  useEffect(() => { setCaisse(caisseProp); }, [caisseProp]);
  const refreshCaisse = useCallback(async () => {
    const res = await getCaisseBalances();
    if (res.success && res.data) {
      const fresh = res.data.find(c => c.id === caisseProp.id);
      if (fresh) setCaisse(fresh);
    }
  }, [caisseProp.id]);

  const [transactions, setTransactions] = useState<TxnType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<string>("expense");
  const [modalAmount, setModalAmount] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hovRow, setHovRow] = useState<number | null>(null);

  // Transfer to admin
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [transferDesc, setTransferDesc] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Adjust/reset balance
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  async function handleTransfer() {
    if (!transferAmount || parseFloat(transferAmount) <= 0) return;
    // Only cap by physical caisse balance — SD can send any amount they have,
    // independent of what the system calculated as "owed".
    if (parseFloat(transferAmount) > caisse.balance) {
      alert(`Solde insuffisant. Maximum: ${formatDA(caisse.balance)}.`);
      return;
    }
    setTransferSubmitting(true);
    // 1. Create the transfer record (pending until admin confirms receipt)
    const res = await api("/sd-transfers", {
      method: "POST",
      body: JSON.stringify({
        from_stop_desk_id: caisse.stop_desk?.id ?? null,
        to_stop_desk_id: null,
        amount: parseFloat(transferAmount),
        type: "cod_transfer",
        description: transferDesc || `Envoi COD — ${caisse.name}`,
        reference: transferRef || null,
      }),
    });
    if (!(res as any).success) { setTransferSubmitting(false); return; }

    // Backend already creates transfer_out transaction — no need to debit again

    setTransferSubmitting(false);
    setShowTransferModal(false);
    setTransferAmount(""); setTransferRef(""); setTransferDesc("");
    // Refresh transfers list + caisse data + sdConfig
    if (caisse.stop_desk) {
      api<any[]>(`/sd-transfers?stop_desk_id=${caisse.stop_desk.id}`).then(r => {
        if ((r as any).success && (r as any).data) setSdTransfers((r as any).data);
      });
      api<any[]>("/sd-config").then(res => {
        if ((res as any).success && (res as any).data) {
          const found = (res as any).data.find((s: any) => s.id === caisse.stop_desk?.id);
          if (found) setSdConfig(found);
        }
      });
    }
    load();
    refreshCaisse();
  }

  // SD config (for margin/prelevement info)
  const [sdConfig, setSdConfig] = useState<any>(null);

  // Transfers for this SD
  const [sdTransfers, setSdTransfers] = useState<any[]>([]);
  useEffect(() => {
    if (caisse.stop_desk) {
      api<any[]>(`/sd-transfers?stop_desk_id=${caisse.stop_desk.id}`).then(res => {
        if ((res as any).success && (res as any).data) setSdTransfers((res as any).data);
      });
      // Always lifetime — SD sees ALL their margin profit, not date-filtered
      api<any[]>("/sd-config").then(res => {
        if ((res as any).success && (res as any).data) {
          const found = (res as any).data.find((s: any) => s.id === caisse.stop_desk?.id);
          if (found) setSdConfig(found);
        }
      });
    }
  }, [caisse.stop_desk]);

  const load = useCallback(async () => {
    setLoading(true);
    const f: TransactionFilters = { page, per_page: 20 };
    if (filterType) f.type = filterType;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    const res = await getCaisseTransactions(caisse.id, f);
    if (res.success && res.data) {
      setTransactions(res.data.data);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [caisse.id, page, filterType, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    if (!modalAmount || parseFloat(modalAmount) <= 0) return;
    setSubmitting(true);
    try {
      const res = await createCaisseTransaction({ caisse_id: caisse.id, type: modalType as any, amount: parseFloat(modalAmount), description: modalDesc || undefined });
      setSubmitting(false);
      if (res.success) { setShowModal(false); setModalAmount(""); setModalDesc(""); load(); refreshCaisse(); }
      else { alert((res as any).message || "Erreur lors de la création"); }
    } catch (e: any) {
      setSubmitting(false);
      alert("Erreur: " + (e?.message || "Connexion échouée"));
    }
  }

  // All-time transactions for accurate margin/profit metrics (not affected by filters)
  const [allTimeTx, setAllTimeTx] = useState<TxnType[]>([]);
  useEffect(() => {
    getCaisseTransactions(caisse.id, { per_page: 1000 }).then(res => {
      if (res.success && res.data) setAllTimeTx(res.data.data);
    });
  }, [caisse.id]);

  // Margin earned = sum of margin_profit transactions (real margin pocketed)
  const marginEarned = allTimeTx.filter(tx => tx.type === "margin_profit").reduce((s, tx) => s + Number(tx.amount), 0);
  const totalDelivered = allTimeTx.filter(tx => tx.type === "cod_collected").length;

  const kpi: React.CSSProperties = {
    padding: "14px 16px", borderRadius: 8,
    background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb",
    border: `1px solid ${t.border}`,
  };
  const kpiLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: 6 };
  const kpiVal = (color: string): React.CSSProperties => ({ fontSize: 22, fontWeight: 700, color, letterSpacing: "-0.01em" });

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* Header */}
      <div className="dash-fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isAdmin && (
            <button onClick={onBack} style={{ background: "transparent", border: "none", borderRadius: 6, padding: 4, cursor: "pointer", display: "flex" }}>
              <ArrowLeft size={16} color={t.textMuted} />
            </button>
          )}
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Banknote size={15} color="#f97316" strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>{caisse.name}</h1>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>
              {caisse.stop_desk ? `${caisse.stop_desk.name}${caisse.stop_desk.code ? ` · ${caisse.stop_desk.code}` : ""}` : "Pas de stop desk assigné"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {caisse.stop_desk && sdConfig && (() => {
            // Use backend-computed receiver_remaining (accurate across all data)
            const remaining = sdConfig.receiver_remaining ?? 0;
            return remaining > 0 ? (
            <button onClick={() => { setTransferAmount(String(remaining)); setShowTransferModal(true); }} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
              background: "rgba(59,130,246,0.1)", color: "#3b82f6", cursor: "pointer",
            }}>
              <TrendingUp size={13} /> Envoyer à l'admin ({formatDA(remaining)})
            </button>
          ) : null; })()}
          <PrimaryBtn onClick={() => setShowModal(true)}><Plus size={13} /> Ajouter</PrimaryBtn>
          {isAdmin && (
            <button onClick={() => { setAdjustAmount(String(caisse.balance)); setAdjustReason(""); setShowAdjustModal(true); }}
              title="Ajuster le solde" style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                borderRadius: 7, border: "1px solid rgba(245,158,11,0.3)",
                background: "rgba(245,158,11,0.06)", color: "#d97706",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
              <Pencil size={12} /> Ajuster
            </button>
          )}
          <IconBtn onClick={load} title="Actualiser"><RefreshCw size={14} color={t.textMuted} /></IconBtn>
        </div>
      </div>

      {/* Date filter — top of page, applies to all sections below */}
      {(() => {
        const today = new Date().toISOString().split("T")[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
        const monthStart = today.substring(0, 8) + "01";
        return (
          <div className="dash-fade-up" style={{ animationDelay: "20ms", display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { label: "Aujourd'hui", from: today, to: today },
              { label: "7 jours", from: weekAgo, to: today },
              { label: "Ce mois", from: monthStart, to: today },
              { label: "Tout", from: "", to: "" },
            ].map(q => {
              const active = dateFrom === q.from && dateTo === q.to;
              return (
                <button key={q.label} onClick={() => { setDateFrom(q.from); setDateTo(q.to); setPage(1); }} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${active ? "#f97316" : t.border}`,
                  background: active ? "rgba(249,115,22,0.1)" : "transparent",
                  color: active ? "#f97316" : t.textMuted, cursor: "pointer",
                }}>{q.label}</button>
              );
            })}
            <div style={{ width: 1, height: 18, background: t.border }} />
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ ...inpStyle(t), width: "auto", padding: "6px 10px", fontSize: 12 }} />
            <span style={{ fontSize: 11, color: t.textFaint }}>→</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={{ ...inpStyle(t), width: "auto", padding: "6px 10px", fontSize: 12 }} />
          </div>
        );
      })()}

      {/* Single balance hero — one number, what the caisse contains */}
      <div className="dash-fade-up" style={{
        animationDelay: "40ms", marginBottom: 12,
        padding: "28px 28px", borderRadius: 14,
        background: isDark ? "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(249,115,22,0.02))" : "linear-gradient(135deg, #fff7ed, #ffffff)",
        border: `1px solid ${isDark ? "rgba(249,115,22,0.2)" : "#fed7aa"}`,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: t.textMuted, marginBottom: 8 }}>
          Contenu de la caisse
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, color: caisse.balance >= 0 ? "#f97316" : "#ef4444", letterSpacing: "-0.02em", lineHeight: 1 }}>
          {formatDA(caisse.balance)}
        </div>
      </div>

      {/* Profit section — earned / paid / to cash out */}
      {caisse.stop_desk && sdConfig && (() => {
        const earned = Number(sdConfig.profit_earned ?? 0);
        const paid = Number(sdConfig.profit_paid ?? 0);
        const pending = Number(sdConfig.profit_pending ?? 0);
        const deliveries = Number(sdConfig.receiver_deliveries ?? 0) + Number(sdConfig.origin_deliveries ?? 0);
        const maxCashout = Math.min(pending, caisse.balance);
        return (
          <div className="dash-fade-up" style={{
            animationDelay: "45ms", marginBottom: 20, padding: "18px 20px", borderRadius: 12,
            background: t.card, border: `1px solid ${t.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: 4 }}>
                    Profit gagné ({deliveries} colis)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{formatDA(earned)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: 4 }}>
                    Déjà encaissé
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: t.textSub }}>{formatDA(paid)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: 4 }}>
                    À encaisser
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: pending > 0 ? "#f97316" : t.textMuted }}>{formatDA(pending)}</div>
                </div>
              </div>
              {maxCashout > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm(`Encaisser ${formatDA(maxCashout)} de marge ?`)) return;
                    const res = await createCaisseTransaction({
                      caisse_id: caisse.id,
                      type: "margin_profit" as any,
                      amount: maxCashout,
                      description: `Marge encaissée manuellement`,
                    });
                    if ((res as any).success) {
                      // Optimistic: decrement balance locally so user sees update immediately
                      setCaisse(c => ({ ...c, balance: Number(c.balance) - maxCashout, total_out: Number(c.total_out) + maxCashout }));
                      load();
                      refreshCaisse();
                      // refresh sdConfig
                      const qs: string[] = [];
                      if (dateFrom) qs.push(`date_from=${dateFrom}`);
                      if (dateTo)   qs.push(`date_to=${dateTo}`);
                      const r = await api<any[]>("/sd-config" + (qs.length ? `?${qs.join("&")}` : ""));
                      if ((r as any).success && (r as any).data) {
                        const found = (r as any).data.find((s: any) => s.id === caisse.stop_desk?.id);
                        if (found) setSdConfig(found);
                      }
                    } else {
                      alert((res as any).message || "Erreur");
                    }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
                    borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700,
                    background: "#16a34a", color: "#fff", cursor: "pointer",
                  }}
                >
                  <Banknote size={14} /> Encaisser ma marge ({formatDA(maxCashout)})
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Transfers section */}
      {sdTransfers.length > 0 && (
        <div className="dash-fade-up" style={{ animationDelay: "50ms", marginBottom: 16, background: t.card, borderRadius: 10, border: `1px solid ${t.border}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={13} style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Transferts</span>
            <span style={{ fontSize: 11, color: t.textFaint }}>({sdTransfers.length})</span>
          </div>
          {sdTransfers.filter((tr: any) => {
            if (dateFrom && new Date(tr.created_at) < new Date(dateFrom + "T00:00:00")) return false;
            if (dateTo && new Date(tr.created_at) > new Date(dateTo + "T23:59:59")) return false;
            return true;
          }).map((tr: any) => {
            const isPending = tr.status === "pending";
            const isConfirmed = tr.status === "confirmed";
            const statusColor = isPending ? "#f59e0b" : isConfirmed ? "#16a34a" : "#ef4444";
            const statusLabel = isPending ? "En attente" : isConfirmed ? "Confirmé" : "Rejeté";
            const isSent = tr.from_stop_desk?.id === caisse.stop_desk?.id;
            const isReceived = tr.to_stop_desk?.id === caisse.stop_desk?.id;
            const canConfirm = isPending && isReceived; // SD can confirm incoming transfers
            return (
              <div key={tr.id} style={{
                padding: "10px 16px", borderBottom: `1px solid ${t.divider}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: statusColor,
                }} />
                <div style={{ flex: 1 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{formatDA(tr.amount)}</span>
                    <span style={{ fontSize: 11, color: isSent ? "#ef4444" : "#16a34a", marginLeft: 6 }}>
                      {isSent ? "→ Envoyé" : "← Reçu"}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{tr.description ?? ""}</span>
                  {tr.reference && <span style={{ fontSize: 10, color: t.textFaint, marginLeft: 6 }}>Réf: {tr.reference}</span>}
                </div>
                {canConfirm ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={async () => {
                      await api(`/sd-transfers/${tr.id}/confirm`, { method: "PATCH" });
                      // Refresh
                      if (caisse.stop_desk) {
                        const res = await api<any[]>(`/sd-transfers?stop_desk_id=${caisse.stop_desk.id}`);
                        if ((res as any).success && (res as any).data) setSdTransfers((res as any).data);
                      }
                      load();
                    }} style={{
                      padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700,
                      background: "rgba(16,185,129,0.1)", color: "#16a34a", cursor: "pointer",
                    }}>Confirmer</button>
                    <button onClick={async () => {
                      await api(`/sd-transfers/${tr.id}/reject`, { method: "PATCH" });
                      if (caisse.stop_desk) {
                        const res = await api<any[]>(`/sd-transfers?stop_desk_id=${caisse.stop_desk.id}`);
                        if ((res as any).success && (res as any).data) setSdTransfers((res as any).data);
                      }
                    }} style={{
                      padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700,
                      background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer",
                    }}>Rejeter</button>
                  </div>
                ) : (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: statusColor,
                    background: `${statusColor}15`, padding: "2px 8px", borderRadius: 99,
                  }}>{statusLabel}</span>
                )}
                <span style={{ fontSize: 10, color: t.textFaint }}>
                  {new Date(tr.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Type filter (scoped to transactions table) */}
      <div className="dash-fade-up" style={{ animationDelay: "60ms", display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Filter size={13} color={t.textMuted} />
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} style={{ ...selStyle(t), width: "auto", fontSize: 12 }}>
          <option value="">Tous les types</option>
          <option value="cod_collected">COD Collecté</option>
          <option value="shipping_received">Frais Livraison</option>
          <option value="cod_remitted">COD Remis</option>
          <option value="expense">Dépense</option>
          <option value="margin_profit">Marge Encaissée</option>
          <option value="transfer_out">Transfert Envoyé</option>
          <option value="transfer_in">Transfert Reçu</option>
        </select>
      </div>

      {/* Table */}
      <div className="dash-fade-up" style={{ animationDelay: "80ms", background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: t.shadow, overflow: "hidden" }}>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Receipt size={13} color={t.textMuted} />
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Transactions</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.1)", padding: "1px 7px", borderRadius: 20 }}>
            {total}
          </span>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <Loader2 size={18} color="#f97316" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", fontSize: 12, color: t.textFaint }}>Aucune transaction</div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 110px 1fr 100px 110px 100px", padding: "8px 18px", borderBottom: `1px solid ${t.divider}` }}>
              {["Date", "Type", "Description", "Colis", "Montant", "Par"].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: t.textMuted, textAlign: h === "Montant" ? "right" as const : "left" as const }}>
                  {h}
                </span>
              ))}
            </div>
            {/* Rows */}
            {transactions.map(tx => {
              const hov = hovRow === tx.id;
              const colors = TRANSACTION_TYPE_COLORS[tx.type] || { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
              return (
                <div
                  key={tx.id}
                  onMouseEnter={() => setHovRow(tx.id)} onMouseLeave={() => setHovRow(null)}
                  style={{
                    display: "grid", gridTemplateColumns: "140px 110px 1fr 100px 110px 100px",
                    padding: "10px 18px", alignItems: "center",
                    borderBottom: `1px solid ${t.divider}`,
                    background: hov ? t.rowHover : "transparent",
                    transition: "background 0.12s",
                  }}
                >
                  <span style={{ fontSize: 12, color: t.textMuted, whiteSpace: "nowrap" as const }}>
                    {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span>
                    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: colors.bg, color: colors.text }}>
                      {TRANSACTION_TYPE_LABELS[tx.type] || tx.type}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: t.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {tx.description || "\u2014"}
                  </span>
                  <span>
                    {tx.package ? (
                      <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, color: t.textMuted, background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", padding: "2px 6px", borderRadius: 4, border: `1px solid ${t.border}` }}>
                        {tx.package.tracking_number}
                      </span>
                    ) : <span style={{ color: t.textFaint }}>{"\u2014"}</span>}
                  </span>
                  <span style={{ textAlign: "right" as const, fontSize: 13, fontWeight: 600, color: tx.direction === "in" ? "#10b981" : "#ef4444" }}>
                    {tx.direction === "in" ? "+" : "\u2212"}{formatDA(tx.amount)}
                  </span>
                  <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap" as const }}>
                    {tx.created_by_user ? `${tx.created_by_user.first_name} ${tx.created_by_user.last_name.charAt(0)}.` : "\u2014"}
                  </span>
                </div>
              );
            })}
          </>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderTop: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 11, color: t.textMuted }}>Page {page} / {lastPage}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <IconBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft size={14} color={t.textMuted} /></IconBtn>
              <IconBtn onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage}><ChevronRight size={14} color={t.textMuted} /></IconBtn>
            </div>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: t.overlay, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 12,
            width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
            fontFamily: "var(--font-jakarta, sans-serif)", overflow: "hidden",
          }}>
            <div style={{ position: "relative", padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#f97316", borderRadius: "12px 0 0 0" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Nouvelle transaction</span>
                <IconBtn onClick={() => setShowModal(false)} title="Fermer"><X size={15} color={t.textMuted} /></IconBtn>
              </div>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.label, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Type</label>
                <select value={modalType} onChange={e => setModalType(e.target.value)} style={{ ...selStyle(t), width: "100%" }}>
                  <optgroup label="Entrées (argent reçu)">
                    <option value="cod_collected">COD Collecté (entrée)</option>
                    <option value="shipping_received">Frais reçus (entrée)</option>
                  </optgroup>
                  <optgroup label="Sorties (argent sorti)">
                    <option value="expense">Dépense (sortie)</option>
                    <option value="cod_remitted">COD Remis (sortie)</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.label, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                  Montant <span style={{ color: "#f97316" }}>*</span>
                </label>
                <input type="number" step="0.01" min="0.01" value={modalAmount} onChange={e => setModalAmount(e.target.value)} placeholder="0.00" style={inpStyle(t)} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.label, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Description</label>
                <input value={modalDesc} onChange={e => setModalDesc(e.target.value)} placeholder="Motif (optionnel)" style={inpStyle(t)} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}` }}>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>
                Annuler
              </button>
              <PrimaryBtn onClick={handleSubmit} disabled={submitting || !modalAmount}>
                {submitting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Enregistrer"}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}

      {/* Transfer to admin modal */}
      {showTransferModal && (
        <div onClick={() => setShowTransferModal(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: t.overlay, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 12,
            width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
          }}>
            <div style={{ position: "relative", padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#3b82f6", borderRadius: "12px 0 0 0" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Envoyer de l'argent à l'admin</span>
                <IconBtn onClick={() => setShowTransferModal(false)} title="Fermer"><X size={15} color={t.textMuted} /></IconBtn>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: t.textMuted }}>
                {sdConfig?.auto_prelevement
                  ? `Prélèvement auto — marge ${sdConfig.receiver_margin} DA × ${sdConfig.receiver_deliveries ?? 0} colis = ${formatDA(sdConfig.receiver_margin_total ?? 0)} conservée.`
                  : `Envoi du montant total. Votre marge sera payée par l'admin${sdConfig?.payment_day ? ` le ${sdConfig.payment_day} du mois` : ""}.`
                }
              </p>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                  Montant <span style={{ color: "#3b82f6" }}>*</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" step="100" min="1" value={transferAmount} onChange={e => setTransferAmount(e.target.value)}
                    placeholder="0" autoFocus
                    style={{ ...inpStyle(t), flex: 1, fontSize: 18, fontWeight: 700, textAlign: "right" as const }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>DA</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Référence (reçu, numéro...)</label>
                <input value={transferRef} onChange={e => setTransferRef(e.target.value)} placeholder="Ex: REC-2026-001" style={inpStyle(t)} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Description</label>
                <input value={transferDesc} onChange={e => setTransferDesc(e.target.value)} placeholder="Motif (optionnel)" style={inpStyle(t)} />
              </div>
              <div style={{
                padding: "10px 14px", borderRadius: 8,
                background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)",
                fontSize: 11, color: "#3b82f6", lineHeight: 1.5,
              }}>
                Le statut sera <strong>&quot;En attente&quot;</strong> jusqu'à ce que l'admin confirme la réception.
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}` }}>
              <button onClick={() => setShowTransferModal(false)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={handleTransfer} disabled={transferSubmitting || !transferAmount} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
                borderRadius: 7, border: "none", fontSize: 13, fontWeight: 700,
                background: (!transferAmount || transferSubmitting) ? (isDark ? "#333" : "#d1d5db") : "#3b82f6",
                color: "#fff", cursor: (!transferAmount || transferSubmitting) ? "default" : "pointer",
              }}>
                {transferSubmitting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <TrendingUp size={13} />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust/reset balance modal (admin only) */}
      {showAdjustModal && (
        <div onClick={() => setShowAdjustModal(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: t.overlay, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 12,
            width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
          }}>
            <div style={{ position: "relative", padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#d97706", borderRadius: "12px 0 0 0" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Ajuster le solde</span>
                <IconBtn onClick={() => setShowAdjustModal(false)} title="Fermer"><X size={15} color={t.textMuted} /></IconBtn>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: t.textMuted }}>
                Solde actuel: <strong>{formatDA(caisse.balance)}</strong> — définir le nouveau solde
              </p>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" as const }}>Nouveau solde</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" step="100" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                    autoFocus style={{ ...inpStyle(t), flex: 1, fontSize: 18, fontWeight: 700, textAlign: "right" as const }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>DA</span>
                </div>
                <button onClick={() => setAdjustAmount("0")} style={{
                  marginTop: 6, padding: "4px 12px", borderRadius: 6, border: `1px solid ${t.border}`,
                  background: "transparent", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}>Remettre à zéro</button>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" as const }}>Raison</label>
                <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Correction d'erreur, inventaire..." style={inpStyle(t)} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}` }}>
              <button onClick={() => setShowAdjustModal(false)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>Annuler</button>
              <button onClick={async () => {
                if (adjustAmount === "") return;
                setAdjustSubmitting(true);
                const res = await api(`/caisse/${caisse.id}/adjust`, {
                  method: "POST",
                  body: JSON.stringify({ new_balance: parseFloat(adjustAmount), reason: adjustReason || null }),
                });
                setAdjustSubmitting(false);
                if ((res as any).success) {
                  setShowAdjustModal(false);
                  setAdjustAmount(""); setAdjustReason("");
                  load();
                  onBack();
                } else {
                  alert((res as any).message || "Erreur");
                }
              }} disabled={adjustSubmitting || adjustAmount === ""} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
                borderRadius: 7, border: "none", fontSize: 13, fontWeight: 700,
                background: (adjustAmount === "" || adjustSubmitting) ? (isDark ? "#333" : "#d1d5db") : "#d97706",
                color: "#fff", cursor: (adjustAmount === "" || adjustSubmitting) ? "default" : "pointer",
              }}>
                {adjustSubmitting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
