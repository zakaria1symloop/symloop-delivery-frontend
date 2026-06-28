"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Receipt, RefreshCw, Loader2, X, Wallet, Lock,
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, ChevronDown, ChevronRight, ChevronLeft,
  CheckCircle2, XCircle, Clock, Settings, AlertTriangle, Save, Banknote,
  ScrollText, Filter,
} from "lucide-react";
import { getStoredUser } from "@/lib/api";
import {
  getOwingReport, getPrelevement, getTransfers,
  postVersement, postDispatch, postTransfer,
  confirmTransfer, rejectTransfer,
  updateGlobalPrelevement, updateSdPrelevement,
  formatDA, SETTLEMENT_LABELS, PRELEVEMENT_LABELS, TRANSFER_STATUS_CFG,
  type OwingReport, type OwingSd, type PrelevementConfig, type PrelevementSd,
  type PrelevementGlobal, type PrelevementSidePayload,
  type FinanceTransfer, type PrelevementType, type SettlementMode,
} from "@/lib/finance";
import {
  getSdCaisses, getCaisseTransactions,
  TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS,
  type CaisseWithBalance, type CaisseTransaction, type TransactionFilters,
} from "@/lib/caisse";

/* ── theme ───────────────────────────────────────────────── */
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
    shadow: "none", overlay: "rgba(0,0,0,0.6)",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", overlay: "rgba(0,0,0,0.35)",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}
type Tokens = ReturnType<typeof useTokens>;

const ORANGE = "#f97316";

/* ── small UI primitives ─────────────────────────────────── */
function PrimaryBtn({ onClick, disabled, children, color = ORANGE, style }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; color?: string; style?: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8,
        padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "#fff",
        background: disabled ? "#9ca3af" : (hov ? `${color}dd` : color),
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1, transition: "background 0.12s",
        ...style,
      }}>{children}</button>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function FinanceSituationPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const user = getStoredUser();
  const isAdmin = user?.user_type === "admin";

  const [tab, setTab] = useState<"soldes" | "prelevement">("soldes");
  const [owing, setOwing] = useState<OwingReport | null>(null);
  const [transfers, setTransfers] = useState<FinanceTransfer[]>([]);
  const [prelevement, setPrelevement] = useState<PrelevementConfig | null>(null);
  // Resolve stop_desk_id → its SD caisse (id + live balance) for the relevé.
  const [sdCaisses, setSdCaisses] = useState<Record<number, CaisseWithBalance>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Flow modal: which flow + prefilled SD(s)
  const [flow, setFlow] = useState<null | { mode: "versement" | "dispatch" | "transfer"; sdId?: number }>(null);
  // Relevé (caisse ledger) drawer: which SD row is open.
  const [releveSd, setReleveSd] = useState<OwingSd | null>(null);

  const flash = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const [owRes, trRes, prRes, cbRes] = await Promise.all([
      getOwingReport(),
      getTransfers(),
      getPrelevement(),
      getSdCaisses(),
    ]);
    if (owRes.success && owRes.data) setOwing(owRes.data);
    else setError(owRes.message || "Impossible de charger la situation financière.");
    if (trRes.success && trRes.data) setTransfers(trRes.data);
    if (prRes.success && prRes.data) setPrelevement(prRes.data);
    if (cbRes.success && cbRes.data) {
      const map: Record<number, CaisseWithBalance> = {};
      for (const c of cbRes.data) if (c.stop_desk) map[c.stop_desk.id] = c;
      setSdCaisses(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin, reload]);

  /* ── admin gate ── */
  if (!isAdmin) {
    return (
      <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, textAlign: "center", paddingTop: 110 }}>
        <Lock size={46} style={{ color: t.textFaint, margin: "0 auto 16px" }} />
        <p style={{ color: t.textSub, fontSize: 16, fontWeight: 700, margin: 0 }}>Accès réservé à l&apos;administrateur</p>
        <p style={{ color: t.textMuted, fontSize: 13, marginTop: 6 }}>Cette page présente la situation financière globale.</p>
      </div>
    );
  }

  const sds = owing?.sds ?? [];

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.22)" }}>
          <Receipt size={20} style={{ color: ORANGE }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Situation Financière</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Qui doit quoi à qui, la caisse globale, les flux et la configuration des prélèvements</p>
        </div>
        <button onClick={reload} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 6, background: "transparent",
          border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 14px",
          fontSize: 12, fontWeight: 600, color: t.textSub, cursor: loading ? "default" : "pointer",
        }}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 2000, maxWidth: 360,
          display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 10,
          background: toast.ok ? "#16a34a" : "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
        }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, fontSize: 13, color: "#ef4444", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {/* Top KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ padding: "18px 20px", borderRadius: 14, background: "linear-gradient(135deg, #f97316 0%, #ea580c 70%)", color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -24, top: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, position: "relative" }}>
            <Wallet size={15} color="rgba(255,255,255,0.85)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Caisse globale</span>
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", position: "relative" }}>
            {loading ? "…" : formatDA(owing?.global.caisse_balance ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 3, position: "relative" }}>Solde physique du compte global</div>
        </div>

        <div style={{ padding: "18px 20px", borderRadius: 14, background: t.card, border: "1.5px solid rgba(245,158,11,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <ArrowUpRight size={15} color="#d97706" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.04em" }}>Les SD nous doivent</span>
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, color: "#f59e0b", letterSpacing: "-0.02em" }}>
            {loading ? "…" : formatDA(owing?.global.total_sd_owes_us ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: t.textFaint, marginTop: 3 }}>Cash collecté pas encore remonté</div>
        </div>

        <div style={{ padding: "18px 20px", borderRadius: 14, background: t.card, border: "1.5px solid rgba(239,68,68,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <ArrowDownLeft size={15} color="#dc2626" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.04em" }}>Nous devons aux SD</span>
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, color: "#ef4444", letterSpacing: "-0.02em" }}>
            {loading ? "…" : formatDA(owing?.global.total_we_owe_sd ?? 0)}
          </div>
          <div style={{ fontSize: 11, color: t.textFaint, marginTop: 3 }}>Commissions / dispatchs à envoyer</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `1px solid ${t.border}` }}>
        {([["soldes", "Soldes & flux"], ["prelevement", "Prélèvement"]] as const).map(([key, label]) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "9px 18px", border: "none", background: "transparent", cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: active ? ORANGE : t.textMuted,
              borderBottom: `2px solid ${active ? ORANGE : "transparent"}`, marginBottom: -1,
            }}>{label}</button>
          );
        })}
      </div>

      {loading && !owing ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Loader2 size={22} color={ORANGE} className="animate-spin" />
        </div>
      ) : tab === "soldes" ? (
        <SoldesTab
          t={t} sds={sds}
          transfers={transfers}
          onFlow={(mode, sdId) => setFlow({ mode, sdId })}
          onReleve={(sd) => setReleveSd(sd)}
          onConfirm={async (id) => {
            const res = await confirmTransfer(id);
            if (res.success) { flash("Transfert confirmé"); reload(); }
            else flash(res.message || "Échec de la confirmation", false);
          }}
          onReject={async (id) => {
            const res = await rejectTransfer(id);
            if (res.success) { flash("Transfert rejeté", false); reload(); }
            else flash(res.message || "Échec du rejet", false);
          }}
        />
      ) : (
        <PrelevementTab
          t={t} config={prelevement}
          onSavedGlobal={async (body) => {
            const res = await updateGlobalPrelevement(body);
            if (res.success) { flash("Prélèvement global enregistré"); reload(); }
            else flash(res.message || "Échec de l'enregistrement", false);
            return res.success;
          }}
          onSavedSd={async (id, body) => {
            const res = await updateSdPrelevement(id, body);
            if (res.success) { flash("Configuration SD enregistrée"); reload(); }
            else flash(res.message || "Échec de l'enregistrement", false);
            return res.success;
          }}
        />
      )}

      {/* Flow modal */}
      {flow && owing && (
        <FlowModal
          t={t} mode={flow.mode} sds={owing.sds} prefillSdId={flow.sdId}
          onClose={() => setFlow(null)}
          onDone={(msg, ok) => { setFlow(null); flash(msg, ok); if (ok) reload(); }}
        />
      )}

      {/* Relevé (caisse ledger) drawer */}
      {releveSd && (
        <ReleveDrawer
          t={t} sd={releveSd}
          caisse={sdCaisses[releveSd.stop_desk_id] ?? null}
          onClose={() => setReleveSd(null)}
        />
      )}
    </div>
  );
}

/* ── Soldes & flux tab ───────────────────────────────────── */
function SoldesTab({ t, sds, transfers, onFlow, onReleve, onConfirm, onReject }: {
  t: Tokens; sds: OwingSd[]; transfers: FinanceTransfer[];
  onFlow: (mode: "versement" | "dispatch" | "transfer", sdId?: number) => void;
  onReleve: (sd: OwingSd) => void;
  onConfirm: (id: number) => void; onReject: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <>
      {/* Flow actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <PrimaryBtn onClick={() => onFlow("versement")} color="#16a34a">
          <ArrowUpRight size={15} /> Versement (SD → Global)
        </PrimaryBtn>
        <PrimaryBtn onClick={() => onFlow("dispatch")} color="#3b82f6">
          <ArrowDownLeft size={15} /> Dispatch (Global → SD)
        </PrimaryBtn>
        <PrimaryBtn onClick={() => onFlow("transfer")} color="#8b5cf6">
          <ArrowLeftRight size={15} /> Transfert (SD ↔ SD)
        </PrimaryBtn>
      </div>

      {/* Owing table */}
      <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden", marginBottom: 22 }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Banknote size={14} color={t.textMuted} />
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Soldes par Stop Desk</span>
          <span style={{ fontSize: 11, color: t.textFaint }}>— cliquez une ligne pour le détail</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: t.textFaint }}>{sds.length} SD</span>
        </div>

        {sds.length === 0 ? (
          <div style={{ padding: "44px 0", textAlign: "center", color: t.textMuted, fontSize: 13 }}>Aucun Stop Desk</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: t.rowHover }}>
                  <th style={thStyle(t, "left")}></th>
                  <th style={thStyle(t, "left")}>Stop Desk</th>
                  <th style={thStyle(t, "center")}>Mode</th>
                  <th style={thStyle(t, "right")}>Solde caisse</th>
                  <th style={thStyle(t, "right")}>Nous doit</th>
                  <th style={thStyle(t, "right")}>On lui doit</th>
                  <th style={thStyle(t, "right")}>Net</th>
                  <th style={thStyle(t, "right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sds.map(sd => {
                  const open = expanded.has(sd.stop_desk_id);
                  const netColor = sd.net > 0 ? "#f59e0b" : sd.net < 0 ? "#ef4444" : "#16a34a";
                  return (
                    <FragmentRow key={sd.stop_desk_id}>
                      <tr
                        onClick={() => toggle(sd.stop_desk_id)}
                        style={{ borderTop: `1px solid ${t.divider}`, cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "10px 8px 10px 16px", width: 28 }}>
                          {open ? <ChevronDown size={14} color={t.textMuted} /> : <ChevronRight size={14} color={t.textMuted} />}
                        </td>
                        <td style={{ padding: "10px 14px", color: t.text, fontWeight: 600 }}>{sd.name}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                            color: sd.settlement_mode === "net" ? "#7c3aed" : "#2563eb",
                            background: sd.settlement_mode === "net" ? "rgba(124,58,237,0.1)" : "rgba(37,99,235,0.1)",
                          }}>{SETTLEMENT_LABELS[sd.settlement_mode] ?? sd.settlement_mode}</span>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: t.textSub, fontVariantNumeric: "tabular-nums" }}>{formatDA(sd.caisse_balance)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: sd.sd_owes_us > 0 ? "#f59e0b" : t.textFaint, fontVariantNumeric: "tabular-nums" }}>
                          {sd.sd_owes_us > 0 ? formatDA(sd.sd_owes_us) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: sd.we_owe_sd > 0 ? "#ef4444" : t.textFaint, fontVariantNumeric: "tabular-nums" }}>
                          {sd.we_owe_sd > 0 ? formatDA(sd.we_owe_sd) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: netColor, fontVariantNumeric: "tabular-nums" }}>
                          {sd.net === 0 ? "À jour" : `${sd.net > 0 ? "+" : "−"}${formatDA(Math.abs(sd.net))}`}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => onReleve(sd)} title="Relevé de caisse (historique des transactions)" style={miniBtn("#f97316")}>
                            <ScrollText size={11} /> Relevé
                          </button>
                          {sd.sd_owes_us > 0 && (
                            <button onClick={() => onFlow("versement", sd.stop_desk_id)} title="Encaisser un versement" style={{ ...miniBtn("#16a34a"), marginLeft: 4 }}>
                              <ArrowUpRight size={11} /> Versement
                            </button>
                          )}
                          {sd.we_owe_sd > 0 && (
                            <button onClick={() => onFlow("dispatch", sd.stop_desk_id)} title="Dispatcher vers ce SD" style={{ ...miniBtn("#3b82f6"), marginLeft: 4 }}>
                              <ArrowDownLeft size={11} /> Dispatch
                            </button>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr style={{ background: t.rowHover }}>
                          <td colSpan={8} style={{ padding: "12px 18px 16px 44px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                              <Detail t={t} label="Collecté (COD)" value={formatDA(sd.breakdown.collected)} color="#16a34a" />
                              <Detail t={t}
                                label={`Comm. expéditeur · ${sd.breakdown.originated_count} colis`}
                                value={formatDA(sd.breakdown.sender_commission)}
                                sub={`${PRELEVEMENT_LABELS[sd.breakdown.sender_type] ?? sd.breakdown.sender_type} · ${sd.breakdown.sender_value}${sd.breakdown.sender_type === "percent" ? "%" : " DA"}`}
                                color="#7c3aed"
                              />
                              <Detail t={t}
                                label={`Comm. destinataire · ${sd.breakdown.delivered_count} colis`}
                                value={formatDA(sd.breakdown.receiver_commission)}
                                sub={`${PRELEVEMENT_LABELS[sd.breakdown.receiver_type] ?? sd.breakdown.receiver_type} · ${sd.breakdown.receiver_value}${sd.breakdown.receiver_type === "percent" ? "%" : " DA"}`}
                                color="#9333ea"
                              />
                              <Detail t={t} label="Commission totale" value={formatDA(sd.breakdown.commission)} color="#6d28d9" />
                              <Detail t={t} label="Versé (remonté)" value={formatDA(sd.breakdown.remitted)} color="#2563eb" />
                              <Detail t={t} label="Dispatché (descendu)" value={formatDA(sd.breakdown.dispatched)} color="#d97706" />
                            </div>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfers list */}
      <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={14} color={t.textMuted} />
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Transferts</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: t.textFaint }}>{transfers.length} mouvement{transfers.length !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ maxHeight: 460, overflowY: "auto" }}>
          {transfers.length === 0 ? (
            <div style={{ padding: "44px 0", textAlign: "center", color: t.textMuted, fontSize: 13 }}>Aucun transfert</div>
          ) : transfers.map(tr => {
            const scfg = TRANSFER_STATUS_CFG[tr.status] ?? TRANSFER_STATUS_CFG.pending;
            const fromLabel = tr.from_stop_desk?.name ?? "Global";
            const toLabel = tr.to_stop_desk?.name ?? "Global";
            return (
              <div key={tr.id} style={{ padding: "12px 18px", borderTop: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 12 }}
                onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ArrowLeftRight size={15} color={ORANGE} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                    {fromLabel} <ArrowUpRight size={11} style={{ verticalAlign: "middle", color: t.textFaint }} /> {toLabel}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>
                    {tr.description || tr.type}
                    {tr.reference && <span style={{ fontFamily: "monospace", marginLeft: 4 }}>Réf: {tr.reference}</span>}
                    {tr.confirmed_by && tr.status === "confirmed" && ` · par ${tr.confirmed_by.first_name} ${tr.confirmed_by.last_name}`}
                  </div>
                </div>
                {tr.status === "pending" ? (
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => onConfirm(tr.id)} style={miniBtn("#16a34a")}><CheckCircle2 size={11} /> Confirmer</button>
                    <button onClick={() => onReject(tr.id)} style={miniBtn("#ef4444")}><XCircle size={11} /> Rejeter</button>
                  </div>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, color: scfg.color, background: `${scfg.color}15`, padding: "3px 10px", borderRadius: 99 }}>{scfg.label}</span>
                )}
                <div style={{ textAlign: "right", minWidth: 96 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text, fontVariantNumeric: "tabular-nums" }}>{formatDA(tr.amount)}</div>
                  <div style={{ fontSize: 10, color: t.textFaint }}>
                    {tr.created_at ? new Date(tr.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }

function Detail({ t, label, value, color, sub }: { t: Tokens; label: string; value: string; color: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, fontWeight: 600, color: t.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function thStyle(t: Tokens, align: "left" | "right" | "center"): React.CSSProperties {
  return { padding: "9px 14px", textAlign: align, fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
}

function miniBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7,
    border: "none", fontSize: 10, fontWeight: 700, background: `${color}15`, color, cursor: "pointer",
  };
}

/* ── Prélèvement tab ─────────────────────────────────────── */
type GlobalSavePayload = { sender?: PrelevementSidePayload; receiver?: PrelevementSidePayload };
type SdSavePayload = {
  sender_type?: PrelevementType; sender_value?: number;
  receiver_type?: PrelevementType; receiver_value?: number;
  settlement_mode?: SettlementMode;
};

function PrelevementTab({ t, config, onSavedGlobal, onSavedSd }: {
  t: Tokens; config: PrelevementConfig | null;
  onSavedGlobal: (body: GlobalSavePayload) => Promise<boolean>;
  onSavedSd: (id: number, body: SdSavePayload) => Promise<boolean>;
}) {
  if (!config) {
    return <div style={{ padding: "44px 0", textAlign: "center", color: t.textMuted, fontSize: 13 }}>Configuration indisponible</div>;
  }
  const grpBorder = `1px solid ${t.border}`;
  return (
    <>
      <GlobalPrelevementCard t={t} initial={config.global} onSave={onSavedGlobal} />
      <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Settings size={14} color={t.textMuted} />
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Prélèvement par Stop Desk</span>
          <span style={{ fontSize: 11, color: t.textFaint }}>— surcharge les valeurs globales</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: t.rowHover }}>
                <th rowSpan={2} style={thStyle(t, "left")}>Stop Desk</th>
                <th colSpan={2} style={{ ...thStyle(t, "center"), borderLeft: grpBorder, color: "#7c3aed" }}>Expéditeur (origine)</th>
                <th colSpan={2} style={{ ...thStyle(t, "center"), borderLeft: grpBorder, color: "#9333ea" }}>Destinataire (livraison)</th>
                <th rowSpan={2} style={{ ...thStyle(t, "center"), borderLeft: grpBorder }}>Mode</th>
                <th rowSpan={2} style={thStyle(t, "right")}></th>
              </tr>
              <tr style={{ background: t.rowHover }}>
                <th style={{ ...thStyle(t, "left"), borderLeft: grpBorder }}>Type</th>
                <th style={thStyle(t, "left")}>Valeur</th>
                <th style={{ ...thStyle(t, "left"), borderLeft: grpBorder }}>Type</th>
                <th style={thStyle(t, "left")}>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {config.sds.map(sd => (
                <SdPrelevementRow key={sd.stop_desk_id} t={t} sd={sd} onSave={onSavedSd} grpBorder={grpBorder} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function GlobalPrelevementCard({ t, initial, onSave }: {
  t: Tokens; initial: PrelevementGlobal; onSave: (body: GlobalSavePayload) => Promise<boolean>;
}) {
  const normType = (v: string): PrelevementType => (v === "fixed" ? "fixed" : "percent");
  const [sType, setSType] = useState<PrelevementType>(normType(initial.sender.type));
  const [sValue, setSValue] = useState(String(initial.sender.value));
  const [rType, setRType] = useState<PrelevementType>(normType(initial.receiver.type));
  const [rValue, setRValue] = useState(String(initial.receiver.value));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSType(normType(initial.sender.type)); setSValue(String(initial.sender.value));
    setRType(normType(initial.receiver.type)); setRValue(String(initial.receiver.value));
  }, [initial.sender.type, initial.sender.value, initial.receiver.type, initial.receiver.value]);

  const senderDirty = (normType(initial.sender.type) !== sType) || (String(initial.sender.value) !== sValue);
  const receiverDirty = (normType(initial.receiver.type) !== rType) || (String(initial.receiver.value) !== rValue);
  const dirty = senderDirty || receiverDirty;

  return (
    <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, padding: "16px 20px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Settings size={14} color={ORANGE} />
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Prélèvement global (par défaut)</span>
        <span style={{ fontSize: 11, color: t.textFaint }}>— appliqué aux SD sans surcharge</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <SideBlock t={t} accent="#7c3aed" title="Prélèvement expéditeur (origine)" hint="Prélevé sur les colis émis par le SD"
          type={sType} value={sValue} onType={setSType} onValue={setSValue} />
        <SideBlock t={t} accent="#9333ea" title="Prélèvement destinataire (livraison)" hint="Prélevé sur les colis livrés par le SD"
          type={rType} value={rValue} onType={setRType} onValue={setRValue} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <PrimaryBtn
          onClick={async () => {
            setSaving(true);
            const body: GlobalSavePayload = {};
            if (senderDirty) body.sender = { type: sType, value: Number(sValue) || 0 };
            if (receiverDirty) body.receiver = { type: rType, value: Number(rValue) || 0 };
            await onSave(body);
            setSaving(false);
          }}
          disabled={saving || !dirty}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
        </PrimaryBtn>
      </div>
    </div>
  );
}

function SideBlock({ t, accent, title, hint, type, value, onType, onValue }: {
  t: Tokens; accent: string; title: string; hint: string;
  type: PrelevementType; value: string;
  onType: (v: PrelevementType) => void; onValue: (v: string) => void;
}) {
  return (
    <div style={{ border: `1px solid ${t.divider}`, borderRadius: 12, padding: "14px 16px", background: t.bg }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: accent, marginTop: 4, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{title}</div>
          <div style={{ fontSize: 10.5, color: t.textFaint }}>{hint}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={lblStyle(t)}>Type</label>
          <select value={type} onChange={e => onType(e.target.value as PrelevementType)} style={selStyle(t)}>
            <option value="percent">Pourcentage</option>
            <option value="fixed">Fixe</option>
          </select>
        </div>
        <div>
          <label style={lblStyle(t)}>Valeur {type === "percent" ? "(%)" : "(DA)"}</label>
          <input type="number" min="0" step={type === "percent" ? "0.1" : "1"} value={value} onChange={e => onValue(e.target.value)} style={{ ...inpStyle(t), width: 130 }} />
        </div>
      </div>
    </div>
  );
}

function SdPrelevementRow({ t, sd, onSave, grpBorder }: {
  t: Tokens; sd: PrelevementSd; grpBorder: string;
  onSave: (id: number, body: SdSavePayload) => Promise<boolean>;
}) {
  const normType = (v: string): PrelevementType => (v === "fixed" ? "fixed" : "percent");
  const [sType, setSType] = useState<PrelevementType>(normType(sd.sender_type));
  const [sValue, setSValue] = useState(String(sd.sender_value));
  const [rType, setRType] = useState<PrelevementType>(normType(sd.receiver_type));
  const [rValue, setRValue] = useState(String(sd.receiver_value));
  const [mode, setMode] = useState<SettlementMode>(sd.settlement_mode === "net" ? "net" : "gross");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSType(normType(sd.sender_type)); setSValue(String(sd.sender_value));
    setRType(normType(sd.receiver_type)); setRValue(String(sd.receiver_value));
    setMode(sd.settlement_mode === "net" ? "net" : "gross");
  }, [sd.sender_type, sd.sender_value, sd.receiver_type, sd.receiver_value, sd.settlement_mode]);

  const dirty =
    (normType(sd.sender_type) !== sType) || (String(sd.sender_value) !== sValue) ||
    (normType(sd.receiver_type) !== rType) || (String(sd.receiver_value) !== rValue) ||
    (sd.settlement_mode !== mode);

  const cellSel: React.CSSProperties = { ...selStyle(t), padding: "5px 8px", fontSize: 12 };
  const cellInp: React.CSSProperties = { ...inpStyle(t), width: 78, padding: "5px 8px", fontSize: 12 };
  const suffix: React.CSSProperties = { marginLeft: 5, fontSize: 11, color: t.textFaint };

  return (
    <tr style={{ borderTop: `1px solid ${t.divider}` }}>
      <td style={{ padding: "9px 14px", color: t.text, fontWeight: 600, whiteSpace: "nowrap" }}>{sd.name}</td>
      {/* sender */}
      <td style={{ padding: "9px 10px", borderLeft: grpBorder }}>
        <select value={sType} onChange={e => setSType(e.target.value as PrelevementType)} style={cellSel}>
          <option value="percent">Pourcentage</option>
          <option value="fixed">Fixe</option>
        </select>
      </td>
      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
        <input type="number" min="0" step={sType === "percent" ? "0.1" : "1"} value={sValue} onChange={e => setSValue(e.target.value)} style={cellInp} />
        <span style={suffix}>{sType === "percent" ? "%" : "DA"}</span>
      </td>
      {/* receiver */}
      <td style={{ padding: "9px 10px", borderLeft: grpBorder }}>
        <select value={rType} onChange={e => setRType(e.target.value as PrelevementType)} style={cellSel}>
          <option value="percent">Pourcentage</option>
          <option value="fixed">Fixe</option>
        </select>
      </td>
      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
        <input type="number" min="0" step={rType === "percent" ? "0.1" : "1"} value={rValue} onChange={e => setRValue(e.target.value)} style={cellInp} />
        <span style={suffix}>{rType === "percent" ? "%" : "DA"}</span>
      </td>
      {/* settlement mode */}
      <td style={{ padding: "9px 10px", borderLeft: grpBorder }}>
        <select value={mode} onChange={e => setMode(e.target.value as SettlementMode)} style={cellSel}>
          <option value="gross">Brut</option>
          <option value="net">Net</option>
        </select>
      </td>
      <td style={{ padding: "9px 14px", textAlign: "right" }}>
        <button
          onClick={async () => {
            setSaving(true);
            await onSave(sd.stop_desk_id, {
              sender_type: sType, sender_value: Number(sValue) || 0,
              receiver_type: rType, receiver_value: Number(rValue) || 0,
              settlement_mode: mode,
            });
            setSaving(false);
          }}
          disabled={saving || !dirty}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "none",
            fontSize: 11, fontWeight: 700, cursor: (saving || !dirty) ? "default" : "pointer",
            background: dirty ? ORANGE : (t.inp.bg), color: dirty ? "#fff" : t.textFaint, opacity: saving ? 0.7 : 1,
          }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Enregistrer
        </button>
      </td>
    </tr>
  );
}

/* ── Flow modal (versement / dispatch / transfer) ────────── */
function FlowModal({ t, mode, sds, prefillSdId, onClose, onDone }: {
  t: Tokens; mode: "versement" | "dispatch" | "transfer"; sds: OwingSd[]; prefillSdId?: number;
  onClose: () => void; onDone: (msg: string, ok: boolean) => void;
}) {
  const cfg = {
    versement: { title: "Versement — SD → Global", color: "#16a34a", Icon: ArrowUpRight, sub: "Le SD remonte du cash vers la caisse globale (l'admin confirmera la réception)." },
    dispatch: { title: "Dispatch — Global → SD", color: "#3b82f6", Icon: ArrowDownLeft, sub: "La caisse globale envoie de l'argent vers un SD (le SD confirmera la réception)." },
    transfer: { title: "Transfert — SD ↔ SD", color: "#8b5cf6", Icon: ArrowLeftRight, sub: "Transfert direct entre deux SD (le SD destinataire confirmera)." },
  }[mode];

  const [fromSd, setFromSd] = useState<number | "">(mode === "transfer" || mode === "versement" ? (prefillSdId ?? "") : "");
  const [toSd, setToSd] = useState<number | "">(mode === "dispatch" ? (prefillSdId ?? "") : "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setErr("");
    const amt = Number(amount);
    if (!amt || amt <= 0) { setErr("Montant invalide."); return; }
    if (mode === "versement" && !fromSd) { setErr("Sélectionnez le SD."); return; }
    if (mode === "dispatch" && !toSd) { setErr("Sélectionnez le SD."); return; }
    if (mode === "transfer") {
      if (!fromSd || !toSd) { setErr("Sélectionnez les deux SD."); return; }
      if (fromSd === toSd) { setErr("Les deux SD doivent être différents."); return; }
    }
    setSubmitting(true);
    const noteVal = note.trim() || undefined;
    let ok = false, msg = "";
    if (mode === "versement") {
      const res = await postVersement({ stop_desk_id: Number(fromSd), amount: amt, note: noteVal });
      ok = res.success; msg = ok ? "Versement enregistré (en attente de confirmation)" : (res.message || "Échec du versement");
    } else if (mode === "dispatch") {
      const res = await postDispatch({ stop_desk_id: Number(toSd), amount: amt, note: noteVal });
      ok = res.success; msg = ok ? "Dispatch envoyé (en attente de confirmation du SD)" : (res.message || "Échec du dispatch");
    } else {
      const res = await postTransfer({ from_stop_desk_id: Number(fromSd), to_stop_desk_id: Number(toSd), amount: amt, note: noteVal });
      ok = res.success; msg = ok ? "Transfert créé (en attente de confirmation)" : (res.message || "Échec du transfert");
    }
    setSubmitting(false);
    if (ok) onDone(msg, true); else setErr(msg);
  }

  const Icon = cfg.Icon;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: t.overlay, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 16, width: "100%", maxWidth: 440, border: `1px solid ${t.border}`, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${cfg.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={17} color={cfg.color} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.text }}>{cfg.title}</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>{cfg.sub}</p>

          {err && (
            <div style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, color: "#ef4444", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>{err}</div>
          )}

          {(mode === "versement" || mode === "transfer") && (
            <div>
              <label style={lblStyle(t)}>{mode === "transfer" ? "SD source" : "Stop Desk"}</label>
              <select value={fromSd} onChange={e => setFromSd(e.target.value ? Number(e.target.value) : "")} style={{ ...selStyle(t), width: "100%" }}>
                <option value="">— Sélectionner —</option>
                {sds.map(s => <option key={s.stop_desk_id} value={s.stop_desk_id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {(mode === "dispatch" || mode === "transfer") && (
            <div>
              <label style={lblStyle(t)}>{mode === "transfer" ? "SD destinataire" : "Stop Desk"}</label>
              <select value={toSd} onChange={e => setToSd(e.target.value ? Number(e.target.value) : "")} style={{ ...selStyle(t), width: "100%" }}>
                <option value="">— Sélectionner —</option>
                {sds.map(s => <option key={s.stop_desk_id} value={s.stop_desk_id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={lblStyle(t)}>Montant</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" min="1" step="100" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
                style={{ ...inpStyle(t), flex: 1, fontSize: 16, fontWeight: 700, textAlign: "right" }} />
              <span style={{ fontSize: 13, color: t.textMuted }}>DA</span>
            </div>
          </div>

          <div>
            <label style={lblStyle(t)}>Note (optionnel)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Référence, commentaire…" style={inpStyle(t)} />
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: `1px solid ${t.divider}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
          <PrimaryBtn onClick={submit} disabled={submitting} color={cfg.color}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirmer
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

/* ── Relevé (caisse ledger) drawer ───────────────────────── */
type ReleveRow = { tx: CaisseTransaction; solde: number | null };

function ReleveDrawer({ t, sd, caisse, onClose }: {
  t: Tokens; sd: OwingSd; caisse: CaisseWithBalance | null; onClose: () => void;
}) {
  const caisseId = caisse?.id ?? null;
  // Anchor for the running balance = the caisse's live balance (balance after
  // the newest transaction). Prefer the authoritative /caisse/balances figure,
  // fall back to the owing report's caisse_balance.
  const currentBalance = caisse?.balance ?? sd.caisse_balance;
  const todayStr = new Date().toISOString().split("T")[0];
  const PER_PAGE = 20;

  const [rows, setRows] = useState<ReleveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // caisse_transactions has NO balance_after, so we compute a running balance
  // client-side. Rows come newest-first; the newest row's "Solde" == the
  // caisse's current balance, and each older row removes the newer row's signed
  // effect. We cache each page's opening (top) balance so sequential paging
  // (Précédent/Suivant) stays exact.
  const anchors = useRef<Map<number, number>>(new Map());
  const reqId = useRef(0);

  // Running balance only reflects the TRUE account balance for the full ledger
  // ending "now": a type filter hides interleaved rows and a date_to in the past
  // hides newer rows — both break the anchor. A date_from only hides older rows
  // (which never affect a newer row's solde), so it stays exact.
  const soldeReliable = !filterType && (!dateTo || dateTo >= todayStr);

  const load = useCallback(async () => {
    if (!caisseId) { setLoading(false); return; }
    const myId = ++reqId.current;
    setLoading(true); setError("");
    if (page === 1) anchors.current.clear();
    const f: TransactionFilters = { page, per_page: PER_PAGE };
    if (filterType) f.type = filterType;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    const res = await getCaisseTransactions(caisseId, f);
    if (myId !== reqId.current) return; // a newer request superseded this one
    if (res.success && res.data) {
      const data = res.data.data;
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
      if (soldeReliable) {
        let running = anchors.current.get(page) ?? currentBalance;
        const computed = data.map<ReleveRow>((tx) => {
          const solde = running;
          running -= tx.direction === "in" ? Number(tx.amount) : -Number(tx.amount);
          return { tx, solde };
        });
        anchors.current.set(page + 1, running);
        setRows(computed);
      } else {
        setRows(data.map<ReleveRow>((tx) => ({ tx, solde: null })));
      }
    } else {
      setError(res.message || "Impossible de charger le relevé.");
      setRows([]);
    }
    setLoading(false);
  }, [caisseId, page, filterType, dateFrom, dateTo, currentBalance, soldeReliable]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const presets: { label: string; from: string; to: string }[] = (() => {
    const monthStart = todayStr.substring(0, 8) + "01";
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    return [
      { label: "Tout", from: "", to: "" },
      { label: "Aujourd'hui", from: todayStr, to: todayStr },
      { label: "7 jours", from: weekAgo, to: todayStr },
      { label: "Ce mois", from: monthStart, to: todayStr },
    ];
  })();

  const th = (align: "left" | "right" | "center"): React.CSSProperties => ({
    padding: "9px 12px", textAlign: align, fontSize: 10, fontWeight: 700, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
    position: "sticky", top: 0, background: t.card, zIndex: 1, borderBottom: `1px solid ${t.divider}`,
  });
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 12, borderBottom: `1px solid ${t.divider}`, verticalAlign: "middle" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: t.overlay, display: "flex", justifyContent: "flex-end" }}>
      <style>{`@keyframes releveIn { from { transform: translateX(24px); opacity: 0.4; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(900px, 96vw)", height: "100%", background: t.card, borderLeft: `1px solid ${t.border}`,
        boxShadow: "-16px 0 48px rgba(0,0,0,0.28)", display: "flex", flexDirection: "column",
        animation: "releveIn 0.18s ease-out", fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 13, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ScrollText size={18} color={ORANGE} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Relevé de caisse — {sd.name}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>
              Historique des transactions {total > 0 ? `· ${total} mouvement${total !== 1 ? "s" : ""}` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Solde caisse</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: currentBalance >= 0 ? ORANGE : "#ef4444", fontVariantNumeric: "tabular-nums" }}>
              {formatDA(currentBalance)}
            </div>
          </div>
          <button onClick={onClose} title="Fermer" style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex", marginLeft: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: "12px 22px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
          <Filter size={13} color={t.textMuted} />
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} style={{ ...selStyle(t), padding: "6px 10px", fontSize: 12 }}>
            <option value="">Tous les types</option>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div style={{ width: 1, height: 18, background: t.border, margin: "0 2px" }} />
          {presets.map(p => {
            const active = dateFrom === p.from && dateTo === p.to;
            return (
              <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to); setPage(1); }} style={{
                padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                border: `1.5px solid ${active ? ORANGE : t.border}`,
                background: active ? "rgba(249,115,22,0.1)" : "transparent",
                color: active ? ORANGE : t.textMuted, cursor: "pointer",
              }}>{p.label}</button>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <span style={{ fontSize: 11, color: t.textFaint }}>Du</span>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ ...inpStyle(t), width: "auto", padding: "6px 9px", fontSize: 12 }} />
            <span style={{ fontSize: 11, color: t.textFaint }}>au</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={{ ...inpStyle(t), width: "auto", padding: "6px 9px", fontSize: 12 }} />
          </div>
        </div>

        {/* Body / table */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {!caisseId ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
              <Wallet size={34} style={{ color: t.textFaint, margin: "0 auto 12px" }} />
              Aucune caisse associée à ce Stop Desk.
            </div>
          ) : error ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>{error}</p>
              <button onClick={load} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <RefreshCw size={13} /> Réessayer
              </button>
            </div>
          ) : loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <Loader2 size={22} color={ORANGE} className="animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
              <Receipt size={34} style={{ color: t.textFaint, margin: "0 auto 12px" }} />
              Aucune transaction pour cette période.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th("left")}>Date / heure</th>
                  <th style={th("left")}>Type</th>
                  <th style={th("left")}>Référence</th>
                  <th style={th("left")}>Description</th>
                  <th style={th("right")}>Entrée</th>
                  <th style={th("right")}>Sortie</th>
                  <th style={th("right")}>Solde</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ tx, solde }) => {
                  const colors = TRANSACTION_TYPE_COLORS[tx.type] || { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
                  const isIn = tx.direction === "in";
                  return (
                    <tr key={tx.id}
                      onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ ...td, color: t.textMuted, whiteSpace: "nowrap" }}>
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td style={td}>
                        <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: colors.bg, color: colors.text }}>
                          {TRANSACTION_TYPE_LABELS[tx.type] || tx.type}
                        </span>
                      </td>
                      <td style={td}>
                        {tx.package ? (
                          <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, color: t.textSub, background: t.rowHover, padding: "2px 6px", borderRadius: 4, border: `1px solid ${t.border}` }}>
                            {tx.package.tracking_number}
                          </span>
                        ) : <span style={{ color: t.textFaint }}>—</span>}
                      </td>
                      <td style={{ ...td, color: t.textSub, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.description || ""}>
                        {tx.description || "—"}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#16a34a", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {isIn ? `+ ${formatDA(tx.amount)}` : <span style={{ color: t.textFaint, fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#ef4444", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {!isIn ? `− ${formatDA(tx.amount)}` : <span style={{ color: t.textFaint, fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 800, color: t.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        {solde != null ? formatDA(solde) : <span style={{ color: t.textFaint, fontWeight: 400 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer: solde note + pagination */}
        <div style={{ padding: "11px 22px", borderTop: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: t.textFaint }}>
            {!soldeReliable && caisseId
              ? "Solde masqué : actif uniquement sur le relevé complet (sans filtre de type, et jusqu'à aujourd'hui)."
              : "Solde = solde de caisse après chaque mouvement."}
          </span>
          {lastPage > 1 && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: t.textMuted }}>Page {page} / {lastPage}</span>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{ display: "flex", padding: "5px 7px", borderRadius: 7, border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage}
                style={{ display: "flex", padding: "5px 7px", borderRadius: 7, border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, cursor: page >= lastPage ? "default" : "pointer", opacity: page >= lastPage ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── shared input styles ─────────────────────────────────── */
function lblStyle(t: Tokens): React.CSSProperties {
  return { display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" };
}
function inpStyle(t: Tokens): React.CSSProperties {
  return { width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 13, outline: "none", boxSizing: "border-box" };
}
function selStyle(t: Tokens): React.CSSProperties {
  return { padding: "8px 11px", borderRadius: 9, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 13, cursor: "pointer", outline: "none" };
}
