"use client";

import { useState, useEffect } from "react";
import {
  Settings2, Search, Loader2, Save, Check, X, Network, Building2, Store,
  Banknote, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

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

interface SDConfig {
  id: number; name: string; code: string | null; type: string;
  wilaya: string | null; commune: string | null; has_caisse: boolean;
  sender_margin: number; receiver_margin: number;
  auto_prelevement: boolean; payment_day: number | null;
  cod_collected: number; paid_out: number;
  transfers_sent: number; transfers_pending: number; transfers_received: number;
  balance: number;
  profit_earned?: number; profit_paid?: number; profit_pending?: number;
  receiver_deliveries?: number; origin_deliveries?: number;
}

interface Transfer {
  id: number; amount: number; type: string; status: string;
  description: string | null; reference: string | null;
  from_stop_desk?: { id: number; name: string } | null;
  to_stop_desk?: { id: number; name: string } | null;
  created_by_user?: { first_name: string; last_name: string } | null;
  confirmed_by_user?: { first_name: string; last_name: string } | null;
  confirmed_at: string | null; created_at: string;
}

const TYPE_CFG: Record<string, { color: string; label: string }> = {
  hub: { color: "#10b981", label: "Hub" },
  agence: { color: "#3b82f6", label: "Agence" },
  depot: { color: "#f59e0b", label: "Dépôt" },
};

const STATUS_CFG: Record<string, { color: string; label: string; icon: typeof CheckCircle2 }> = {
  pending:   { color: "#f59e0b", label: "En attente",  icon: Clock },
  confirmed: { color: "#16a34a", label: "Confirmé",    icon: CheckCircle2 },
  rejected:  { color: "#ef4444", label: "Rejeté",      icon: XCircle },
};

export default function SDConfigPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [sds, setSds] = useState<SDConfig[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSD, setSelectedSD] = useState<SDConfig | null>(null);
  const [tab, setTab] = useState<"overview" | "config" | "transfers">("overview");
  const [edited, setEdited] = useState<Partial<SDConfig>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sendType, setSendType] = useState("margin_payment");
  const [sendRef, setSendRef] = useState("");
  const [sendDesc, setSendDesc] = useState("");
  const [sending, setSending] = useState(false);
  const [filterWilaya, setFilterWilaya] = useState("");
  const [filterType, setFilterType] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const [transferType, setTransferType] = useState("");
  const [transferDateFrom, setTransferDateFrom] = useState("");
  const [transferDateTo, setTransferDateTo] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  useEffect(() => {
    setLoading(true);
    const qs: string[] = [];
    if (dateFrom) qs.push(`date_from=${dateFrom}`);
    if (dateTo)   qs.push(`date_to=${dateTo}`);
    const url = "/sd-config" + (qs.length ? `?${qs.join("&")}` : "");
    api<SDConfig[]>(url).then(res => {
      if (res.success && res.data) {
        setSds(res.data);
        if (selectedSD) {
          const fresh = res.data.find(s => s.id === selectedSD.id);
          if (fresh) setSelectedSD(fresh);
        }
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  function selectSD(sd: SDConfig) {
    setSelectedSD(sd);
    setEdited({});
    setTab("overview");
    api<Transfer[]>(`/sd-transfers?stop_desk_id=${sd.id}`).then(res => {
      if (res.success && res.data) setTransfers(res.data);
    });
  }

  async function sendMoney() {
    if (!selectedSD || !sendAmount || parseFloat(sendAmount) <= 0) return;
    setSending(true);
    const res = await api("/sd-transfers", {
      method: "POST",
      body: JSON.stringify({
        from_stop_desk_id: null, // from admin
        to_stop_desk_id: selectedSD.id,
        amount: parseFloat(sendAmount),
        type: sendType,
        description: sendDesc || `Envoi admin → ${selectedSD.name}`,
        reference: sendRef || null,
      }),
    });
    // Stays pending — SD must confirm receipt
    setSending(false);
    if ((res as any).success) {
      setShowSendModal(false);
      setSendAmount(""); setSendRef(""); setSendDesc("");
      setToast(`${formatDA(parseFloat(sendAmount))} envoyé à ${selectedSD.name}`);
      setTimeout(() => setToast(null), 3000);
      // Refresh transfers
      api<Transfer[]>(`/sd-transfers?stop_desk_id=${selectedSD.id}`).then(r => {
        if ((r as any).success && (r as any).data) setTransfers((r as any).data);
      });
    }
  }

  async function saveConfig() {
    if (!selectedSD) return;
    setSaving(true);
    const senderMargin = edited.sender_margin ?? selectedSD.sender_margin;
    const receiverMargin = edited.receiver_margin ?? selectedSD.receiver_margin;
    const autoPrelevement = edited.auto_prelevement ?? selectedSD.auto_prelevement;
    const paymentDay = edited.payment_day ?? selectedSD.payment_day;
    const payload = {
      sender_margin: senderMargin,
      receiver_margin: receiverMargin,
      auto_prelevement: autoPrelevement,
      payment_day: paymentDay,
    };
    const res = await api(`/sd-config/${selectedSD.id}`, { method: "PUT", body: JSON.stringify(payload) });
    if ((res as any).success) {
      const localUpdate = { sender_margin: senderMargin, receiver_margin: receiverMargin, auto_prelevement: autoPrelevement, payment_day: paymentDay };
      setSds(prev => prev.map(s => s.id === selectedSD.id ? { ...s, ...localUpdate } : s));
      setSelectedSD(prev => prev ? { ...prev, ...localUpdate } : prev);
      setEdited({});
      setToast("Configuration sauvegardée");
      setTimeout(() => setToast(null), 3000);
    }
    setSaving(false);
  }

  async function confirmTransfer(id: number) {
    const res = await api(`/sd-transfers/${id}/confirm`, { method: "PATCH" });
    if ((res as any).success) {
      setTransfers(prev => prev.map(tr => tr.id === id ? { ...tr, status: "confirmed" } : tr));
      setToast("Transfert confirmé");
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function rejectTransfer(id: number) {
    const res = await api(`/sd-transfers/${id}/reject`, { method: "PATCH" });
    if ((res as any).success) {
      setTransfers(prev => prev.map(tr => tr.id === id ? { ...tr, status: "rejected" } : tr));
    }
  }

  const wilayas = [...new Set(sds.map(s => s.wilaya).filter(Boolean))] as string[];

  const filtered = sds.filter(s => {
    if (filterWilaya && s.wilaya !== filterWilaya) return false;
    if (filterType && s.type !== filterType) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q) || (s.wilaya ?? "").toLowerCase().includes(q);
  });

  // Totals
  const totalBalance = sds.reduce((s, sd) => s + sd.balance, 0);
  const totalPending = sds.reduce((s, sd) => s + sd.transfers_pending, 0);
  const totalCod = sds.reduce((s, sd) => s + sd.cod_collected, 0);
  const totalProfitEarned = sds.reduce((s, sd) => s + (sd.profit_earned ?? 0), 0);
  const totalProfitPaid = sds.reduce((s, sd) => s + (sd.profit_paid ?? 0), 0);
  const totalProfitPending = sds.reduce((s, sd) => s + (sd.profit_pending ?? 0), 0);

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
        }}>
          <Settings2 size={20} style={{ color: "#6366f1" }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Configuration Stop Desks</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Marges, transferts, soldes — Admin uniquement</p>
        </div>
      </div>

      {/* Global date filter */}
      {(() => {
        const today = new Date().toISOString().split("T")[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
        const monthStart = today.substring(0, 8) + "01";
        const presets = [
          { label: "Aujourd'hui", from: today, to: today },
          { label: "7 jours", from: weekAgo, to: today },
          { label: "Ce mois", from: monthStart, to: today },
          { label: "Tout", from: "", to: "" },
        ];
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Période</span>
            {presets.map(p => {
              const active = dateFrom === p.from && dateTo === p.to;
              return (
                <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to); }} style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${active ? "#6366f1" : t.border}`,
                  background: active ? "rgba(99,102,241,0.1)" : "transparent",
                  color: active ? "#6366f1" : t.textMuted, cursor: "pointer",
                }}>{p.label}</button>
              );
            })}
            <div style={{ width: 1, height: 18, background: t.border, margin: "0 4px" }} />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 11, outline: "none" }}
            />
            <span style={{ fontSize: 11, color: t.textFaint }}>→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 11, outline: "none" }}
            />
          </div>
        );
      })()}

      {/* Global totals */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180, padding: "14px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>COD Total Collecté</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f97316" }}>{formatDA(totalCod)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 180, padding: "14px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Solde Total SDs</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: totalBalance >= 0 ? "#16a34a" : "#ef4444" }}>{formatDA(totalBalance)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 180, padding: "14px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Transferts en attente</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>{formatDA(totalPending)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 180, padding: "14px 18px", borderRadius: 14, background: t.card, border: "1px solid rgba(22,163,74,0.25)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Profit Gagné · Payé · À payer</div>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{formatDA(totalProfitEarned)}</span>
            <span style={{ fontSize: 11, color: t.textMuted }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.textSub }}>{formatDA(totalProfitPaid)}</span>
            <span style={{ fontSize: 11, color: t.textMuted }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: totalProfitPending > 0 ? "#f97316" : t.textMuted }}>{formatDA(totalProfitPending)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* LEFT — SD List */}
        <div style={{
          width: 340, flexShrink: 0, background: t.card, borderRadius: 14,
          border: `1px solid ${t.border}`, overflow: "hidden",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.divider}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
              <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 12, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={filterWilaya} onChange={e => setFilterWilaya(e.target.value)} style={{
                flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${t.inp.border}`,
                background: t.inp.bg, color: t.inp.text, fontSize: 10, cursor: "pointer",
              }}>
                <option value="">Toutes wilayas</option>
                {wilayas.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
                flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${t.inp.border}`,
                background: t.inp.bg, color: t.inp.text, fontSize: 10, cursor: "pointer",
              }}>
                <option value="">Tous types</option>
                <option value="hub">Hub</option>
                <option value="agence">Agence</option>
                <option value="depot">Dépôt</option>
              </select>
            </div>
          </div>
          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            {loading && <div style={{ padding: 30, textAlign: "center", color: t.textMuted }}><Loader2 size={16} className="animate-spin" /></div>}
            {filtered.map(sd => {
              const cfg = TYPE_CFG[sd.type] ?? TYPE_CFG.agence;
              const active = selectedSD?.id === sd.id;
              return (
                <button key={sd.id} onClick={() => selectSD(sd)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                  border: "none", cursor: "pointer", textAlign: "left",
                  background: active ? "rgba(99,102,241,0.08)" : "transparent",
                  borderLeft: active ? "3px solid #6366f1" : "3px solid transparent",
                  transition: "background 100ms",
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.rowHover; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{sd.name}</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{sd.wilaya ?? "—"} · <span style={{ color: cfg.color }}>{cfg.label}</span></div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: sd.balance >= 0 ? "#16a34a" : "#ef4444" }}>{formatDA(sd.balance)}</div>
                    {sd.transfers_pending > 0 && <div style={{ fontSize: 9, color: "#f59e0b", fontWeight: 600 }}>⏳ {formatDA(sd.transfers_pending)}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Detail */}
        <div style={{ flex: 1 }}>
          {!selectedSD ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: t.textMuted }}>
              <Settings2 size={48} style={{ color: t.textFaint, margin: "0 auto 16px" }} />
              <p style={{ fontSize: 15, fontWeight: 600 }}>Sélectionnez un Stop Desk</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* SD Header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}`,
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.text }}>{selectedSD.name}</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: t.textMuted }}>
                    {selectedSD.wilaya} · {selectedSD.commune} · {TYPE_CFG[selectedSD.type]?.label ?? selectedSD.type}
                  </p>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: selectedSD.balance >= 0 ? "#16a34a" : "#ef4444" }}>
                  {formatDA(selectedSD.balance)}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, borderRadius: 10, overflow: "hidden", border: `1px solid ${t.border}`, alignSelf: "flex-start" }}>
                {([["overview", "Vue d'ensemble"], ["config", "Configuration"]] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setTab(key)} style={{
                    padding: "8px 18px", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: tab === key ? "rgba(99,102,241,0.12)" : "transparent",
                    color: tab === key ? "#6366f1" : t.textMuted,
                  }}>{label}</button>
                ))}
              </div>

              {/* Overview */}
              {tab === "overview" && (
                <>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {[
                      { label: "COD Collecté", value: formatDA(selectedSD.cod_collected), color: "#f97316" },
                      { label: "Payé (expéditeurs)", value: formatDA(selectedSD.paid_out), color: "#8b5cf6" },
                      { label: "Transféré", value: formatDA(selectedSD.transfers_sent), color: "#3b82f6" },
                      { label: "En attente", value: formatDA(selectedSD.transfers_pending), color: "#f59e0b" },
                      { label: "Reçu", value: formatDA(selectedSD.transfers_received), color: "#16a34a" },
                      { label: "Solde", value: formatDA(selectedSD.balance), color: selectedSD.balance >= 0 ? "#16a34a" : "#ef4444" },
                    ].map(c => (
                      <div key={c.label} style={{
                        flex: "1 1 150px", padding: "14px 18px", borderRadius: 12,
                        background: t.card, border: `1px solid ${t.border}`,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Profit tracking card */}
                  <div style={{
                    marginTop: 14, padding: "18px 20px", borderRadius: 14,
                    background: t.card, border: "1px solid rgba(22,163,74,0.3)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Banknote size={16} style={{ color: "#16a34a" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                        Profit de ce SD ({(selectedSD.receiver_deliveries ?? 0) + (selectedSD.origin_deliveries ?? 0)} colis livrés)
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Gagné (total)</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{formatDA(selectedSD.profit_earned ?? 0)}</div>
                        <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>
                          {(selectedSD.origin_deliveries ?? 0)} envois × {formatDA(selectedSD.sender_margin)} + {(selectedSD.receiver_deliveries ?? 0)} réceptions × {formatDA(selectedSD.receiver_margin)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Déjà encaissé</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: t.textSub }}>{formatDA(selectedSD.profit_paid ?? 0)}</div>
                        <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>Retiré de la caisse par le SD</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>À encaisser</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: (selectedSD.profit_pending ?? 0) > 0 ? "#f97316" : t.textMuted }}>{formatDA(selectedSD.profit_pending ?? 0)}</div>
                        <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>Restant dû au SD</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Config */}
              {tab === "config" && (
                <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, padding: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Marge Envoi (DA)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="number" min="0" step="10"
                          value={edited.sender_margin ?? selectedSD.sender_margin}
                          onChange={e => setEdited(prev => ({ ...prev, sender_margin: parseFloat(e.target.value) || 0 }))}
                          style={{ width: 100, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: "#f97316", fontSize: 14, fontWeight: 700, textAlign: "right", outline: "none" }}
                        />
                        <span style={{ fontSize: 12, color: t.textFaint }}>DA / colis</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Marge Réception (DA)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="number" min="0" step="10"
                          value={edited.receiver_margin ?? selectedSD.receiver_margin}
                          onChange={e => setEdited(prev => ({ ...prev, receiver_margin: parseFloat(e.target.value) || 0 }))}
                          style={{ width: 100, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: "#3b82f6", fontSize: 14, fontWeight: 700, textAlign: "right", outline: "none" }}
                        />
                        <span style={{ fontSize: 12, color: t.textFaint }}>DA / colis</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Prélèvement automatique</label>
                      <div
                        onClick={() => setEdited(prev => ({ ...prev, auto_prelevement: !(prev.auto_prelevement ?? selectedSD.auto_prelevement) }))}
                        style={{
                          width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                          background: (edited.auto_prelevement ?? selectedSD.auto_prelevement) ? "#16a34a" : (isDark ? "#333" : "#d1d5db"),
                          position: "relative", transition: "background 200ms",
                        }}
                      >
                        <div style={{
                          position: "absolute", top: 3,
                          left: (edited.auto_prelevement ?? selectedSD.auto_prelevement) ? 23 : 3,
                          width: 18, height: 18, borderRadius: "50%", background: "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 180ms",
                        }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6 }}>Jour de paiement</label>
                      {!(edited.auto_prelevement ?? selectedSD.auto_prelevement) ? (
                        <select
                          value={edited.payment_day ?? selectedSD.payment_day ?? ""}
                          onChange={e => setEdited(prev => ({ ...prev, payment_day: e.target.value ? parseInt(e.target.value) : null }))}
                          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 13, cursor: "pointer", outline: "none" }}
                        >
                          <option value="">— Choisir —</option>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>Le {d} du mois</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>Automatique</span>
                      )}
                    </div>
                  </div>
                  {Object.keys(edited).length > 0 && (
                    <button onClick={saveConfig} disabled={saving} style={{
                      padding: "10px 24px", borderRadius: 10, border: "none",
                      background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 700,
                      cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Sauvegarder
                    </button>
                  )}
                </div>
              )}

              {/* Transfers moved to Situation SDs page */}
              {false && (
                <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Banknote size={14} style={{ color: t.textMuted }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Transferts</span>
                    <button onClick={() => setShowSendModal(true)} style={{
                      padding: "5px 14px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700,
                      background: "rgba(16,185,129,0.1)", color: "#16a34a", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                    }}><ArrowDownLeft size={12} /> Envoyer à ce SD</button>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                      {[
                        { v: "", l: "Tous" },
                        { v: "pending", l: "En attente", c: "#f59e0b" },
                        { v: "confirmed", l: "Confirmés", c: "#16a34a" },
                        { v: "rejected", l: "Rejetés", c: "#ef4444" },
                      ].map(f => (
                        <button key={f.v} onClick={() => setTransferStatus(f.v)} style={{
                          padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600,
                          border: `1px solid ${transferStatus === f.v ? (f.c ?? "#f97316") : t.border}`,
                          background: transferStatus === f.v ? `${f.c ?? "#f97316"}15` : "transparent",
                          color: transferStatus === f.v ? (f.c ?? "#f97316") : t.textMuted, cursor: "pointer",
                        }}>{f.l}</button>
                      ))}
                      <select value={transferType} onChange={e => setTransferType(e.target.value)} style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 10, border: `1px solid ${t.border}`,
                        background: t.inp.bg, color: t.inp.text, cursor: "pointer",
                      }}>
                        <option value="">Tous types</option>
                        <option value="cod_transfer">COD</option>
                        <option value="margin_payment">Marge</option>
                        <option value="prelevement">Prélèvement</option>
                        <option value="adjustment">Ajustement</option>
                      </select>
                      <input type="date" value={transferDateFrom} onChange={e => setTransferDateFrom(e.target.value)} style={{ padding: "3px 6px", borderRadius: 6, fontSize: 10, border: `1px solid ${t.border}`, background: t.inp.bg, color: t.inp.text }} />
                      <input type="date" value={transferDateTo} onChange={e => setTransferDateTo(e.target.value)} style={{ padding: "3px 6px", borderRadius: 6, fontSize: 10, border: `1px solid ${t.border}`, background: t.inp.bg, color: t.inp.text }} />
                    </div>
                  </div>
                  <div style={{ maxHeight: 450, overflowY: "auto" }}>
                    {transfers.filter(tr => {
                        if (transferStatus && tr.status !== transferStatus) return false;
                        if (transferType && tr.type !== transferType) return false;
                        if (transferDateFrom && new Date(tr.created_at) < new Date(transferDateFrom + "T00:00:00")) return false;
                        if (transferDateTo && new Date(tr.created_at) > new Date(transferDateTo + "T23:59:59")) return false;
                        return true;
                      }).length === 0 && (
                      <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 13 }}>Aucun transfert</div>
                    )}
                    {transfers.filter(tr => {
                        if (transferStatus && tr.status !== transferStatus) return false;
                        if (transferType && tr.type !== transferType) return false;
                        if (transferDateFrom && new Date(tr.created_at) < new Date(transferDateFrom + "T00:00:00")) return false;
                        if (transferDateTo && new Date(tr.created_at) > new Date(transferDateTo + "T23:59:59")) return false;
                        return true;
                      }).map(tr => {
                      const scfg = STATUS_CFG[tr.status] ?? STATUS_CFG.pending;
                      const SIcon = scfg.icon;
                      const isSending = tr.from_stop_desk?.id === selectedSD?.id;
                      return (
                        <div key={tr.id} style={{
                          padding: "14px 20px", borderBottom: `1px solid ${t.divider}`,
                          display: "flex", alignItems: "center", gap: 12,
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: `${isSending ? "#ef4444" : "#16a34a"}15`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {isSending ? <ArrowUpRight size={14} style={{ color: "#ef4444" }} /> : <ArrowDownLeft size={14} style={{ color: "#16a34a" }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                              {isSending ? `→ ${tr.to_stop_desk?.name ?? "Admin"}` : `← ${tr.from_stop_desk?.name ?? "Admin"}`}
                            </div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{tr.description ?? tr.type}{tr.reference ? ` · Réf: ${tr.reference}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <SIcon size={12} style={{ color: scfg.color }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: scfg.color }}>{scfg.label}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isSending ? "#ef4444" : "#16a34a" }}>
                            {isSending ? "-" : "+"}{formatDA(tr.amount)}
                          </div>
                          {tr.status === "pending" && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => confirmTransfer(tr.id)} style={{
                                padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700,
                                background: "rgba(16,185,129,0.1)", color: "#16a34a", cursor: "pointer",
                              }}>Confirmer</button>
                              <button onClick={() => rejectTransfer(tr.id)} style={{
                                padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700,
                                background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer",
                              }}>Rejeter</button>
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: t.textFaint, whiteSpace: "nowrap" }}>
                            {new Date(tr.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Send money modal */}
      {showSendModal && selectedSD && (
        <div onClick={() => setShowSendModal(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)" }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: isDark ? "#111827" : "#fff", borderRadius: 16, width: "100%", maxWidth: 420,
            border: `1px solid ${t.border}`, overflow: "hidden",
          }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${t.divider}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Envoyer de l'argent</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: t.textMuted }}>Admin → {selectedSD.name}</p>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" }}>Montant *</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min="1" step="100" value={sendAmount} onChange={e => setSendAmount(e.target.value)}
                    autoFocus placeholder="0"
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 16, fontWeight: 700, textAlign: "right" as const, outline: "none" }}
                  />
                  <span style={{ fontSize: 13, color: t.textMuted }}>DA</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" }}>Type</label>
                <select value={sendType} onChange={e => setSendType(e.target.value)} style={{
                  width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.inp.border}`,
                  background: t.inp.bg, color: t.inp.text, fontSize: 13, cursor: "pointer",
                }}>
                  <option value="margin_payment">Paiement marge</option>
                  <option value="adjustment">Ajustement</option>
                  <option value="cod_transfer">Transfert COD</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" }}>Référence</label>
                <input value={sendRef} onChange={e => setSendRef(e.target.value)} placeholder="Optionnel" style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 5, textTransform: "uppercase" }}>Description</label>
                <input value={sendDesc} onChange={e => setSendDesc(e.target.value)} placeholder="Optionnel" style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${t.divider}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowSendModal(false)} style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={sendMoney} disabled={sending || !sendAmount} style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: (!sendAmount || sending) ? t.textFaint : "#16a34a",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: (!sendAmount || sending) ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownLeft size={14} />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#16a34a", color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
