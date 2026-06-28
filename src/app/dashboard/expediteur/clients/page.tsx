"use client";

import { useCallback, useEffect, useState } from "react";
import { Contact, Search, MapPin, Phone, RefreshCw, Loader2, Users, Banknote, Package } from "lucide-react";
import { useIsDark, useTokens, PageHeader, formatDA, ORANGE } from "../_ui";
import { getExpClients, type ExpClient } from "@/lib/expediteur";

function KpiCard({ label, value, icon: Icon, accent, t }: { label: string; value: string; icon: React.ElementType; accent: string; t: ReturnType<typeof useTokens> }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 160, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", boxShadow: t.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={accent} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, color: t.text }}>{value}</div>
    </div>
  );
}

export default function ClientsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [clients, setClients] = useState<ExpClient[]>([]);
  const [summary, setSummary] = useState({ total_clients: 0, total_orders: 0, total_cod: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async (s?: string) => {
    setLoading(true); setError("");
    try {
      const res = await getExpClients(s);
      if (res.success && res.data) {
        setClients(res.data.clients);
        setSummary(res.data.summary);
      } else setError(res.message || "Erreur de chargement");
    } catch { setError("Erreur de connexion"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="Mes Clients"
        subtitle="Vos destinataires réels — agrégés depuis vos colis livrés"
        icon={Contact}
        t={t}
        action={
          <button onClick={() => load(search)} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 9, background: t.card, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} /> Actualiser
          </button>
        }
      />

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiCard label="Clients uniques" value={String(summary.total_clients)} icon={Users} accent="#3b82f6" t={t} />
        <KpiCard label="Commandes totales" value={String(summary.total_orders)} icon={Package} accent={ORANGE} t={t} />
        <KpiCard label="COD encaissé" value={formatDA(summary.total_cod)} icon={Banknote} accent="#22c55e" t={t} />
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 360, marginBottom: 18 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 12, top: 11 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          placeholder="Rechercher par nom ou téléphone…"
          style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 9, fontSize: 13.5, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none" }}
        />
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13 }}>{error}</div>
      )}

      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}`, background: isDark ? "#0b0e16" : "#fafafa" }}>
                {[["Client", "left"], ["Localisation", "left"], ["Commandes", "center"], ["Livrés", "center"], ["Taux", "center"], ["COD encaissé", "right"], ["Dernière", "right"]].map(([h, al]) => (
                  <th key={h as string} style={{ padding: "12px 16px", textAlign: al as "left" | "center" | "right", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && clients.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 50, textAlign: "center", color: t.textMuted }}><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /></td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 44, textAlign: "center", color: t.textMuted }}>Aucun client pour le moment. Vos destinataires apparaîtront ici dès vos premiers colis.</td></tr>
              ) : clients.map((c) => {
                const rate = c.success_rate;
                const rateColor = rate >= 80 ? "#22c55e" : rate >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <tr key={c.recipient_phone}
                    style={{ borderBottom: `1px solid ${t.divider}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: t.text }}>{c.recipient_name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.textMuted, fontFamily: "monospace", marginTop: 2 }}><Phone size={11} />{c.recipient_phone}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: t.textSub }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><MapPin size={12} color={t.textFaint} />{c.wilaya_name || "—"}</div>
                      {c.commune_name && <div style={{ fontSize: 11.5, color: t.textFaint, marginLeft: 17 }}>{c.commune_name}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700, color: t.text }}>{c.orders_count}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: t.textSub }}>{c.delivered_count}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ fontWeight: 700, color: rateColor }}>{rate}%</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{formatDA(c.total_cod)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: t.textMuted, fontSize: 12, whiteSpace: "nowrap" }}>
                      {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
