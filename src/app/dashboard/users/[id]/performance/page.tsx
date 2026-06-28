"use client";

import { useParams } from "next/navigation";
import { Activity, Package, TrendingUp, RotateCcw, Banknote, Truck, Star, MapPin } from "lucide-react";
import { useIsDark, useTokens, PageHeader, BackButton, formatDA, ORANGE, type Tokens } from "../../../_ui";

const DAYS = [
  { d: "Sam", total: 18, delivered: 15, failed: 3 },
  { d: "Dim", total: 24, delivered: 21, failed: 3 },
  { d: "Lun", total: 31, delivered: 27, failed: 4 },
  { d: "Mar", total: 27, delivered: 24, failed: 3 },
  { d: "Mer", total: 35, delivered: 31, failed: 4 },
  { d: "Jeu", total: 29, delivered: 26, failed: 3 },
  { d: "Ven", total: 12, delivered: 10, failed: 2 },
];
const TOP_WILAYAS = [
  { name: "Alger", count: 142 }, { name: "Oran", count: 98 }, { name: "Constantine", count: 71 },
  { name: "Sétif", count: 54 }, { name: "Blida", count: 47 },
];
const STATUS = [
  { label: "Livré", value: 384, color: "#22c55e" },
  { label: "En transit", value: 62, color: "#3b82f6" },
  { label: "En cours", value: 28, color: "#f59e0b" },
  { label: "Retour", value: 39, color: "#ef4444" },
];

export default function UserPerformancePage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const maxDay = Math.max(...DAYS.map((d) => d.total), 1);
  const maxW = Math.max(...TOP_WILAYAS.map((w) => w.count), 1);
  const totalStatus = STATUS.reduce((s, x) => s + x.value, 0);

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <BackButton t={t} href="/dashboard/users" label="Retour aux utilisateurs" />

      <PageHeader title="Performance" subtitle={`Statistiques de l'utilisateur #${id} — 30 derniers jours`} icon={Activity} t={t} />

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <Kpi label="Colis total" value="513" icon={Package} accent={ORANGE} t={t} />
        <Kpi label="Livrés" value="384" icon={TrendingUp} accent="#22c55e" t={t} />
        <Kpi label="Taux de livraison" value="74.9 %" icon={Truck} accent="#3b82f6" t={t} />
        <Kpi label="Taux de retour" value="7.6 %" icon={RotateCcw} accent="#ef4444" t={t} />
        <Kpi label="CA encaissé" value={formatDA(1842500)} icon={Banknote} accent="#16a34a" t={t} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        {/* Bar chart */}
        <div style={{ flex: "1.4 1 360px", minWidth: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: "22px 24px", boxShadow: t.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: t.text, marginBottom: 20 }}>Livraisons — 7 derniers jours</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160 }}>
            {DAYS.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, minHeight: 14 }}>{d.total}</div>
                <div style={{ width: "100%", maxWidth: 38, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 140, borderRadius: 6, overflow: "hidden", background: t.divider }}>
                  <div style={{ height: (d.failed / maxDay) * 140, background: "#ef4444" }} />
                  <div style={{ height: (d.delivered / maxDay) * 140, background: "#22c55e" }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>{d.d}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 14, justifyContent: "center" }}>
            <Legend color="#22c55e" label="Livrés" t={t} />
            <Legend color="#ef4444" label="Échecs" t={t} />
          </div>
        </div>

        {/* Status donut-ish bars */}
        <div style={{ flex: "1 1 280px", minWidth: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: "22px 24px", boxShadow: t.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: t.text, marginBottom: 18 }}>Répartition par statut</div>
          <div style={{ display: "flex", height: 12, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            {STATUS.map((s) => <div key={s.label} style={{ width: `${(s.value / totalStatus) * 100}%`, background: s.color }} />)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {STATUS.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: t.textSub }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />{s.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{s.value} <span style={{ color: t.textMuted, fontWeight: 500, fontSize: 11.5 }}>({Math.round((s.value / totalStatus) * 100)}%)</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Top wilayas */}
        <div style={{ flex: "1 1 360px", minWidth: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: "22px 24px", boxShadow: t.shadow }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: t.text, marginBottom: 18 }}>Top wilayas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {TOP_WILAYAS.map((w, i) => (
              <div key={w.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 550, color: t.text }}>
                    <MapPin size={13} color={i === 0 ? ORANGE : t.textFaint} />{w.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>{w.count} colis</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: t.divider, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(w.count / maxW) * 100}%`, background: i === 0 ? ORANGE : "#3b82f6", borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Satisfaction / rating */}
        <div style={{ flex: "1 1 240px", minWidth: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: "22px 24px", boxShadow: t.shadow, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: t.text, marginBottom: 14 }}>Satisfaction client</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: ORANGE, lineHeight: 1 }}>4.6</div>
          <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={18} color={ORANGE} fill={i < 4 ? ORANGE : "transparent"} />)}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>basé sur 218 avis</div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent, t }: { label: string; value: string; icon: React.ElementType; accent: string; t: Tokens }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 150, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", boxShadow: t.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={17} color={accent} /></div>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{value}</div>
    </div>
  );
}

function Legend({ color, label, t }: { color: string; label: string; t: Tokens }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
    </div>
  );
}
