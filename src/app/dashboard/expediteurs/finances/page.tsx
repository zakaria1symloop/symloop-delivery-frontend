"use client";

import { useState, useEffect, useRef } from "react";
import {
  Wallet, Search, Loader2, X, ChevronDown, UserPlus, Phone, Building2,
  TrendingUp, TrendingDown, Package2, ArrowUpRight, ArrowDownLeft, Banknote,
  MapPin, Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { getUsers, type StaffUser } from "@/lib/users";
import { getWalletSummary, getWalletTransactions, withdrawFromWallet, type WalletSummary, type WalletTransaction } from "@/lib/wallet";
import { getContactStats, bulkReturnPickup, type ContactStats } from "@/lib/packages";
import { api } from "@/lib/api";

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
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

function formatDA(n: number | string) { return Number(n).toLocaleString("fr-DZ") + " DA"; }

const TXN_LABELS: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  cod_credit:      { label: "COD Livré",       color: "#16a34a", icon: TrendingUp },
  shipping_debit:  { label: "Frais livraison",  color: "#f59e0b", icon: TrendingDown },
  return_debit:    { label: "Frais retour",     color: "#ef4444", icon: TrendingDown },
  cash_withdrawal: { label: "Retrait espèces",  color: "#8b5cf6", icon: ArrowDownLeft },
  cash_deposit:    { label: "Dépôt espèces",    color: "#3b82f6", icon: ArrowUpRight },
  adjustment:      { label: "Ajustement",        color: "#6b7280", icon: Banknote },
};

export default function FinancesExpediteurPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // Expéditeur list + selector
  const [expediteurs, setExpediteurs] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState("");
  const selectorRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Selected expéditeur data
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);

  // Transaction filters
  const [txFilterType, setTxFilterType] = useState("");
  const [txFilterDir, setTxFilterDir] = useState("");
  const _todayISO = new Date().toISOString().split("T")[0];
  const [txFilterDateFrom, setTxFilterDateFrom] = useState(_todayISO);
  const [txFilterDateTo, setTxFilterDateTo] = useState(_todayISO);

  // Load expéditeurs
  useEffect(() => {
    getUsers({ type: "expediteur" }).then(res => {
      if (res.success && res.data) setExpediteurs(res.data);
      setLoading(false);
    });
  }, []);

  // Close selector on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) setSelectorOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (selectorOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [selectorOpen]);

  // Load detail when selected
  useEffect(() => {
    if (!selected) { setWallet(null); setTransactions([]); setStats(null); return; }
    setLoadingDetail(true);
    Promise.all([
      getWalletSummary(selected.id),
      getWalletTransactions(selected.id),
      selected.phone ? getContactStats(selected.phone, "sender") : Promise.resolve({ success: true, data: null }),
    ]).then(([wRes, txRes, sRes]) => {
      if (wRes.success && wRes.data) setWallet(wRes.data);
      if (txRes.success && txRes.data) setTransactions(txRes.data);
      if (sRes.success && sRes.data) setStats(sRes.data as ContactStats);
      setLoadingDetail(false);
    });
  }, [selected]);

  // Filter selector
  const filteredExp = expediteurs.filter(u => {
    if (!selectorSearch.trim()) return true;
    const s = selectorSearch.toLowerCase();
    return u.first_name.toLowerCase().includes(s) || u.last_name.toLowerCase().includes(s)
      || (u.phone ?? "").includes(s) || (u.company_name ?? "").toLowerCase().includes(s);
  });

  function selectExp(u: StaffUser) {
    setSelected(u);
    setSelectorOpen(false);
    setSelectorSearch("");
  }

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
        }}>
          <Wallet size={20} style={{ color: "#f97316" }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Finances Expéditeurs</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Soldes, historique et transactions</p>
        </div>
      </div>

      {/* Expéditeur Selector */}
      <div ref={selectorRef} style={{ position: "relative", marginBottom: 20, display: "inline-block", minWidth: 360 }}>
        <button type="button" onClick={() => setSelectorOpen(!selectorOpen)} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12,
          border: `1.5px solid ${selectorOpen ? "#f97316" : t.border}`, background: t.card,
          cursor: "pointer", whiteSpace: "nowrap", transition: "border-color 150ms",
        }}>
          {selected ? (
            <>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: "rgba(244,63,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#f43f5e",
              }}>{selected.first_name[0]}{selected.last_name[0]}</div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                  {selected.first_name} {selected.last_name}
                  {selected.company_name && <span style={{ fontWeight: 400, color: t.textFaint, marginLeft: 6, fontSize: 11 }}>({selected.company_name})</span>}
                </div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{selected.phone ?? "—"}{selected.wilaya ? ` · ${selected.wilaya.name}` : ""}</div>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 13, color: t.textMuted }}>Sélectionner un expéditeur...</span>
          )}
          <ChevronDown size={14} style={{ color: t.textFaint, marginLeft: "auto", transform: selectorOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
        </button>

        {selectorOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50, minWidth: 400,
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
            boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight: 350, display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: isDark ? "#1e2130" : "#f3f4f6", borderRadius: 8, padding: "0 10px" }}>
                <Search size={13} style={{ color: t.textFaint }} />
                <input ref={searchRef} value={selectorSearch} onChange={e => setSelectorSearch(e.target.value)}
                  placeholder="Rechercher par nom, téléphone, entreprise..."
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: t.text, fontSize: 12, padding: "8px 0" }}
                />
                {selectorSearch && <button onClick={() => setSelectorSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={12} style={{ color: t.textFaint }} /></button>}
              </div>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 280 }}>
              {loading && <div style={{ padding: 20, textAlign: "center", color: t.textMuted, fontSize: 12 }}>Chargement...</div>}
              {!loading && filteredExp.length === 0 && <div style={{ padding: 20, textAlign: "center", color: t.textMuted, fontSize: 12 }}>Aucun expéditeur trouvé</div>}
              {filteredExp.map(u => (
                <button key={u.id} onClick={() => selectExp(u)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  border: "none", cursor: "pointer", textAlign: "left",
                  background: selected?.id === u.id ? "rgba(249,115,22,0.08)" : "transparent",
                  borderLeft: selected?.id === u.id ? "3px solid #f97316" : "3px solid transparent",
                  transition: "background 100ms",
                }}
                  onMouseEnter={e => { if (selected?.id !== u.id) e.currentTarget.style.background = t.rowHover; }}
                  onMouseLeave={e => { if (selected?.id !== u.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: "rgba(244,63,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#f43f5e",
                  }}>{u.first_name[0]}{u.last_name[0]}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                      {u.first_name} {u.last_name}
                      {u.company_name && <span style={{ fontWeight: 400, color: t.textFaint, marginLeft: 4, fontSize: 10 }}>({u.company_name})</span>}
                    </div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{u.phone ?? "—"}{u.wilaya ? ` · ${u.wilaya.name}` : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* No selection */}
      {!selected && (
        <div style={{ textAlign: "center", padding: "80px 0", color: t.textMuted }}>
          <Wallet size={48} style={{ color: t.textFaint, margin: "0 auto 16px" }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>Sélectionnez un expéditeur</p>
          <p style={{ fontSize: 13 }}>pour voir ses finances et son historique</p>
        </div>
      )}

      {/* Selected — Detail View */}
      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {loadingDetail ? (
            <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}><Loader2 size={20} className="animate-spin" /></div>
          ) : wallet && (() => {
            const today = new Date().toISOString().split("T")[0];
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
            const monthStart = today.substring(0, 8) + "01";

            const filteredTx = transactions.filter(tx => {
              if (txFilterType && tx.type !== txFilterType) return false;
              if (txFilterDir && tx.direction !== txFilterDir) return false;
              if (txFilterDateFrom && new Date(tx.created_at) < new Date(txFilterDateFrom + "T00:00:00")) return false;
              if (txFilterDateTo && new Date(tx.created_at) > new Date(txFilterDateTo + "T23:59:59")) return false;
              return true;
            });

            const totalIn = filteredTx.filter(tx => tx.direction === "in").reduce((s, tx) => s + Number(tx.amount), 0);
            const totalOut = filteredTx.filter(tx => tx.direction === "out").reduce((s, tx) => s + Number(tx.amount), 0);
            const hasFilter = !!(txFilterType || txFilterDir || txFilterDateFrom || txFilterDateTo);
            const periodLabel = txFilterDateFrom === today && txFilterDateTo === today ? "Aujourd'hui"
              : txFilterDateFrom === weekAgo ? "7 derniers jours"
              : txFilterDateFrom === monthStart ? "Ce mois"
              : hasFilter ? "Période filtrée" : "Tout l'historique";

            return (
            <>
              {/* ── 1. FILTERS (first) ── */}
              <div style={{
                background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
                boxShadow: t.shadow, padding: "14px 20px",
              }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {/* Quick date buttons */}
                  {[
                    { label: "Aujourd'hui", from: today, to: today },
                    { label: "7 jours", from: weekAgo, to: today },
                    { label: "Ce mois", from: monthStart, to: today },
                    { label: "Tout", from: "", to: "" },
                  ].map(q => {
                    const active = txFilterDateFrom === q.from && txFilterDateTo === q.to;
                    return (
                      <button key={q.label} onClick={() => { setTxFilterDateFrom(q.from); setTxFilterDateTo(q.to); }} style={{
                        padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        border: `1.5px solid ${active ? "#f97316" : t.border}`,
                        background: active ? "rgba(249,115,22,0.1)" : "transparent",
                        color: active ? "#f97316" : t.textMuted, cursor: "pointer",
                      }}>{q.label}</button>
                    );
                  })}

                  <div style={{ width: 1, height: 20, background: t.border, margin: "0 4px" }} />

                  {/* Type */}
                  <select value={txFilterType} onChange={e => setTxFilterType(e.target.value)} style={{
                    padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
                    background: t.inp.bg, color: t.inp.text, fontSize: 11, cursor: "pointer",
                  }}>
                    <option value="">Tous les types</option>
                    <option value="cod_credit">COD Livré</option>
                    <option value="shipping_debit">Frais livraison</option>
                    <option value="return_debit">Frais retour</option>
                    <option value="cash_withdrawal">Retrait espèces</option>
                    <option value="cash_deposit">Dépôt espèces</option>
                    <option value="adjustment">Ajustement</option>
                  </select>

                  {/* Direction */}
                  <select value={txFilterDir} onChange={e => setTxFilterDir(e.target.value)} style={{
                    padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
                    background: t.inp.bg, color: t.inp.text, fontSize: 11, cursor: "pointer",
                  }}>
                    <option value="">Entrées + Sorties</option>
                    <option value="in">Entrées</option>
                    <option value="out">Sorties</option>
                  </select>

                  {/* Custom dates */}
                  <input type="date" value={txFilterDateFrom} onChange={e => setTxFilterDateFrom(e.target.value)} style={{
                    padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
                    background: t.inp.bg, color: t.inp.text, fontSize: 11,
                  }} />
                  <span style={{ fontSize: 11, color: t.textFaint }}>→</span>
                  <input type="date" value={txFilterDateTo} onChange={e => setTxFilterDateTo(e.target.value)} style={{
                    padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
                    background: t.inp.bg, color: t.inp.text, fontSize: 11,
                  }} />

                  {hasFilter && (
                    <button onClick={() => { setTxFilterType(""); setTxFilterDir(""); setTxFilterDateFrom(""); setTxFilterDateTo(""); }} style={{
                      padding: "5px 10px", borderRadius: 8, border: `1px solid ${t.border}`,
                      background: "transparent", color: t.textMuted, fontSize: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <X size={10} /> Réinitialiser
                    </button>
                  )}
                </div>
              </div>

              {/* ── 2. SUMMARY CARDS (reflect filtered period) ── */}
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {[
                  { label: "Entrées", value: formatDA(totalIn), color: "#16a34a", desc: periodLabel, icon: TrendingUp },
                  { label: "Sorties", value: formatDA(totalOut), color: "#ef4444", desc: periodLabel, icon: TrendingDown },
                  { label: "Solde période", value: formatDA(totalIn - totalOut), color: (totalIn - totalOut) >= 0 ? "#16a34a" : "#ef4444", desc: `${filteredTx.length} transactions`, icon: Wallet },
                ].map(c => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} style={{
                      flex: "1 1 200px", padding: "18px 20px", borderRadius: 14,
                      background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Icon size={14} style={{ color: c.color }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase" }}>{c.label}</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
                      <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4 }}>{c.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* ── 3. GLOBAL WALLET STATUS (always shows totals) ── */}
              <div style={{
                display: "flex", gap: 14, flexWrap: "wrap", padding: "14px 20px", borderRadius: 14,
                background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow,
              }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <span style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase" }}>En transit</span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#3b82f6" }}>{formatDA(wallet.en_transit)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <span style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase" }}>Libéré</span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{formatDA(wallet.libere)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <span style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase" }}>Retours en attente</span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: ((wallet as any).pending_return_cost ?? 0) > 0 ? "#f59e0b" : "#6b7280" }}>
                    {formatDA((wallet as any).pending_return_cost ?? 0)}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <span style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase" }}>Solde net réel</span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: (Number(wallet.balance) - ((wallet as any).pending_return_cost ?? 0)) >= 0 ? "#16a34a" : "#ef4444" }}>
                    {formatDA(Number(wallet.balance) - ((wallet as any).pending_return_cost ?? 0))}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <span style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase" }}>Retraits</span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#8b5cf6" }}>{formatDA(wallet.total_withdrawals)}</div>
                </div>
              </div>

              {/* ── 4. PENDING RETOUR WARNING ── */}
              {(() => {
                const pendingCost = (wallet as any).pending_return_cost ?? 0;
                const pendingPkgs = (wallet as any).pending_retour_packages ?? [];
                if (pendingCost <= 0) return null;
                return (
                  <div style={{
                    padding: "16px 20px", borderRadius: 14,
                    background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>
                          Retours en cours — {formatDA(pendingCost)} à débiter
                        </div>
                        <div style={{ fontSize: 12, color: t.textMuted }}>
                          {pendingPkgs.length} colis en retour. Le montant sera débité quand l'expéditeur récupère les colis.
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {pendingPkgs.map((p: any) => (
                        <div key={p.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "6px 10px", borderRadius: 8,
                          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 11, color: t.textSub }}>{p.tracking_number}</span>
                            <span style={{ fontSize: 11, color: t.textMuted }}>{p.recipient_name}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
                              background: "rgba(249,115,22,0.1)", color: "#f59e0b",
                            }}>
                              {(p.status ?? "").replaceAll("_", " ")}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>{formatDA(p.return_cost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── 5. FINANCIAL ACTION ── */}
              {(() => {
                const libere = Number(wallet.libere) || 0;
                const pendingReturn = Number((wallet as any).pending_return_cost) || 0;
                const balance = Number(wallet.balance) || 0;
                // Net payable = what's available minus pending return costs
                const net = Math.max(0, libere) - pendingReturn;

                // Case 1: Expéditeur owes us (balance negative OR pending returns exceed available)
                if (balance < 0 || (net < 0 && pendingReturn > 0)) {
                  const owes = balance < 0 ? Math.abs(balance) + pendingReturn : Math.abs(net);
                  return (
                    <div style={{
                      padding: "16px 20px", borderRadius: 14,
                      background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <AlertTriangle size={18} style={{ color: "#ef4444" }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>L'expéditeur nous doit de l'argent</div>
                      </div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 11, color: t.textMuted }}>Solde wallet: </span>
                          <span style={{ fontWeight: 700, color: balance >= 0 ? "#16a34a" : "#ef4444" }}>{formatDA(balance)}</span>
                        </div>
                        {pendingReturn > 0 && <div>
                          <span style={{ fontSize: 11, color: t.textMuted }}>Retours en attente: </span>
                          <span style={{ fontWeight: 700, color: "#f59e0b" }}>{formatDA(pendingReturn)}</span>
                        </div>}
                        <div>
                          <span style={{ fontSize: 11, color: t.textMuted }}>Il nous doit: </span>
                          <span style={{ fontWeight: 800, color: "#ef4444", fontSize: 16 }}>{formatDA(owes)}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: t.textMuted }}>
                        L'expéditeur doit payer {formatDA(owes)} en espèces pour couvrir les frais.
                      </div>
                    </div>
                  );
                }

                // Case 2: Net positive — can pay, but deduct dettes first
                if (net > 0) {
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 20px", borderRadius: 14,
                      background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Payer l'expéditeur</div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                          Disponible: <span style={{ fontWeight: 700, color: "#16a34a" }}>{formatDA(libere)}</span>
                          {pendingReturn > 0 && (
                            <span style={{ marginLeft: 8 }}>
                              − Retours en attente: <span style={{ fontWeight: 700, color: "#f59e0b" }}>{formatDA(pendingReturn)}</span>
                              {" "}= Net: <span style={{ fontWeight: 800, color: "#16a34a" }}>{formatDA(net)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setShowPayModal(true)} style={{
                        padding: "10px 24px", borderRadius: 10, border: "none",
                        background: "#16a34a", color: "#fff", fontSize: 14, fontWeight: 700,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <Banknote size={16} /> Payer {formatDA(net)}
                      </button>
                    </div>
                  );
                }

                // Case 3: Nothing to pay, no debt
                return (
                  <div style={{ padding: "14px 20px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center" }}>Aucun montant disponible — rien à payer</div>
                  </div>
                );
              })()}

              {/* ── MANUAL ACTIONS ── */}
              <div style={{
                display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderRadius: 14,
                background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "flex", alignItems: "center", gap: 6, marginRight: "auto" }}>
                  Actions manuelles
                </span>
                {/* Manual pay */}
                <button onClick={async () => {
                  const amount = prompt("Montant à payer à l'expéditeur (DA) :");
                  if (!amount) return;
                  const num = parseFloat(amount);
                  if (isNaN(num) || num <= 0) { alert("Montant invalide"); return; }
                  const res = await withdrawFromWallet(selected!.id, num, "Paiement manuel");
                  if (res.success) {
                    alert(`Paiement manuel de ${formatDA(num)} effectué.`);
                    getWalletSummary(selected!.id).then(r => { if (r.success && r.data) setWallet(r.data); });
                    getWalletTransactions(selected!.id).then(r => { if (r.success && r.data) setTransactions(r.data); });
                  } else { alert("Erreur: " + ((res as any).message || "Échec")); }
                }} style={{
                  padding: "7px 16px", borderRadius: 8, border: `1px solid rgba(16,185,129,0.3)`,
                  background: "rgba(16,185,129,0.06)", color: "#16a34a",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <ArrowUpRight size={13} /> Payer manuellement
                </button>
                {/* Manual collect */}
                <button onClick={async () => {
                  const amount = prompt("Montant à encaisser de l'expéditeur (DA) :");
                  if (!amount) return;
                  const num = parseFloat(amount);
                  if (isNaN(num) || num <= 0) { alert("Montant invalide"); return; }
                  // Credit wallet (deposit)
                  const res = await api("/wallet/expediteur/" + selected!.id + "/deposit", {
                    method: "POST",
                    body: JSON.stringify({ amount: num, description: "Encaissement manuel" }),
                  });
                  if ((res as any).success) {
                    alert(`Encaissement de ${formatDA(num)} effectué.`);
                    getWalletSummary(selected!.id).then(r => { if (r.success && r.data) setWallet(r.data); });
                    getWalletTransactions(selected!.id).then(r => { if (r.success && r.data) setTransactions(r.data); });
                  } else { alert("Erreur: " + ((res as any).message || "Échec")); }
                }} style={{
                  padding: "7px 16px", borderRadius: 8, border: `1px solid rgba(239,68,68,0.3)`,
                  background: "rgba(239,68,68,0.06)", color: "#ef4444",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <ArrowDownLeft size={13} /> Encaisser manuellement
                </button>
              </div>

              {/* ── PAY CONFIRMATION MODAL ── */}
              {showPayModal && wallet && selected && (() => {
                const libere = Number(wallet.libere) || 0;
                const dettes = Number(wallet.dettes) || 0;
                const pendingReturn = Number((wallet as any).pending_return_cost) || 0;
                const pendingPkgs: any[] = (wallet as any).pending_retour_packages ?? [];
                const net = libere - dettes - pendingReturn;
                const payAmount = Math.max(0, net);

                return (
                  <div onClick={() => { if (!paying) setShowPayModal(false); }} style={{
                    position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
                    background: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)",
                  }}>
                    <div onClick={e => e.stopPropagation()} style={{
                      background: isDark ? "#111827" : "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
                      border: `1px solid ${t.border}`, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
                    }}>
                      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${t.divider}` }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Confirmer le paiement</h3>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: t.textMuted }}>
                          {selected.first_name} {selected.last_name}
                          {(selected as any).company_name && ` — ${(selected as any).company_name}`}
                        </p>
                      </div>
                      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* Breakdown */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: t.textMuted }}>COD libéré</span>
                            <span style={{ fontWeight: 700, color: "#16a34a" }}>{formatDA(libere)}</span>
                          </div>
                          {dettes > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: t.textMuted }}>Dettes débitées</span>
                              <span style={{ fontWeight: 700, color: "#ef4444" }}>-{formatDA(dettes)}</span>
                            </div>
                          )}
                          {pendingReturn > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ color: t.textMuted }}>Frais retour ({pendingPkgs.length} colis)</span>
                              <span style={{ fontWeight: 700, color: "#f59e0b" }}>-{formatDA(pendingReturn)}</span>
                            </div>
                          )}
                          <div style={{ height: 1, background: t.divider }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                            <span style={{ fontWeight: 700, color: t.text }}>Montant à payer</span>
                            <span style={{ fontWeight: 800, color: "#16a34a", fontSize: 18 }}>{formatDA(payAmount)}</span>
                          </div>
                        </div>

                        {/* Retour packages to finalize */}
                        {pendingPkgs.length > 0 && (
                          <div style={{
                            padding: "12px 14px", borderRadius: 10,
                            background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.15)",
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 8, textTransform: "uppercase" }}>
                              Colis retour — seront marqués comme retournés
                            </div>
                            {pendingPkgs.map((p: any) => (
                              <div key={p.id} style={{
                                display: "flex", justifyContent: "space-between", padding: "3px 0",
                                fontSize: 12, color: t.textSub,
                              }}>
                                <span style={{ fontFamily: "monospace" }}>{p.tracking_number}</span>
                                <span style={{ color: "#ef4444", fontWeight: 600 }}>{formatDA(p.return_cost)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "14px 24px", borderTop: `1px solid ${t.divider}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button onClick={() => setShowPayModal(false)} disabled={paying} style={{
                          padding: "9px 18px", borderRadius: 10, border: `1px solid ${t.border}`,
                          background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}>Annuler</button>
                        <button onClick={async () => {
                          setPaying(true);
                          try {
                            // 1. Finalize pending retour packages
                            if (pendingPkgs.length > 0) {
                              await bulkReturnPickup(
                                pendingPkgs.map((p: any) => p.id),
                                selected.phone ?? "",
                              );
                            }
                            // 2. Pay the net amount
                            if (payAmount > 0) {
                              await withdrawFromWallet(selected.id, payAmount, "Paiement expéditeur (retours déduits)");
                            }
                            setShowPayModal(false);
                            // Refresh
                            getWalletSummary(selected.id).then(r => { if (r.success && r.data) setWallet(r.data); });
                            getWalletTransactions(selected.id).then(r => { if (r.success && r.data) setTransactions(r.data); });
                          } catch {
                            alert("Erreur lors du paiement");
                          }
                          setPaying(false);
                        }} disabled={paying} style={{
                          padding: "9px 24px", borderRadius: 10, border: "none",
                          background: paying ? t.textFaint : "#16a34a",
                          color: "#fff", fontSize: 13, fontWeight: 700,
                          cursor: paying ? "default" : "pointer",
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          {paying ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={14} />}
                          Confirmer et payer {formatDA(payAmount)}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── 6. TRANSACTION LIST ── */}
              <div style={{
                background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
                boxShadow: t.shadow, overflow: "hidden",
              }}>
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={14} style={{ color: t.textMuted }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Transactions</span>
                  <span style={{ fontSize: 12, color: t.textFaint }}>({filteredTx.length}{filteredTx.length !== transactions.length ? ` / ${transactions.length}` : ""})</span>
                </div>
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {filteredTx.length === 0 && (
                    <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 13 }}>Aucune transaction</div>
                  )}
                  {filteredTx.map(tx => {
                    const cfg = TXN_LABELS[tx.type] ?? { label: tx.type, color: t.textMuted, icon: Banknote };
                    const Icon = cfg.icon;
                    const isIn = tx.direction === "in";
                    return (
                      <div key={tx.id} style={{
                        padding: "12px 20px", borderBottom: `1px solid ${t.divider}`,
                        display: "flex", alignItems: "center", gap: 12,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: `${cfg.color}15`, display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Icon size={14} style={{ color: cfg.color }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{cfg.label}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>
                            {tx.description ?? ""}
                            {tx.package && <span style={{ fontFamily: "monospace", marginLeft: 4 }}>{tx.package.tracking_number}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isIn ? "#16a34a" : "#ef4444" }}>
                            {isIn ? "+" : "-"}{formatDA(tx.amount)}
                          </div>
                          <div style={{ fontSize: 10, color: t.textFaint }}>Solde: {formatDA(tx.balance_after)}</div>
                        </div>
                        <div style={{ fontSize: 10, color: t.textFaint, whiteSpace: "nowrap" }}>
                          {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
