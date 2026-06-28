"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — VUE D'ENSEMBLE  (report #1)
 *
 *  Executive overview of the whole delivery network: a 12-KPI band, the 12-month
 *  deliveries trend, the package-status mix, three "Top 5" mini-tables, a
 *  financial / quality synthesis strip and a "Faits saillants" highlight grid.
 *
 *  ⚠️  HARDCODED SHOWCASE — every figure is illustrative. Shared series come from
 *  `../_data`; report-specific consts (TOP_* + HIGHLIGHTS) are derived locally and
 *  kept internally consistent with the shared mock data. All chart/layout
 *  primitives are imported from `../_charts` — none are re-implemented here.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  LayoutDashboard, Activity, BarChart3, Trophy, Sparkles, Wallet,
  Building2, MapPin, Store, FileText, FileSpreadsheet,
  TrendingUp, Truck, Coins, RotateCcw, Route, MessageSquareWarning,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, AreaLine, Donut, DataTable, ProgressCell, Pill,
  Segmented, ExportButton,
  C, fmt, formatDA, ORANGE, type Tokens,
} from "../_charts";
import {
  GLOBAL_KPIS, DELIVERIES_TREND, MONTHS, STATUS_DIST,
  STOP_DESKS, WILAYAS, MERCHANTS, FINANCE_SUMMARY, SLA_SUMMARY, PERIOD_OPTIONS,
} from "../_data";

/* ── Report-specific derived data (kept consistent with ../_data) ───────────── */

const TOP_STOP_DESKS = [...STOP_DESKS].sort((a, b) => b.colis - a.colis).slice(0, 5);
const TOP_WILAYAS = [...WILAYAS].sort((a, b) => b.colis - a.colis).slice(0, 5);
const TOP_MERCHANTS = [...MERCHANTS].sort((a, b) => b.colis - a.colis).slice(0, 5);

/* Trend axis stats (DELIVERIES_TREND is the shared 12-month livraisons series). */
const TREND_TOTAL = DELIVERIES_TREND.reduce((s, v) => s + v, 0);
const TREND_AVG = Math.round(TREND_TOTAL / DELIVERIES_TREND.length);
const TREND_PEAK = Math.max(...DELIVERIES_TREND);
const TREND_PEAK_MONTH = MONTHS[DELIVERIES_TREND.indexOf(TREND_PEAK)];

/* ── Faits saillants (alerts / notable facts) ───────────────────────────────── */

type Tone = "good" | "warn" | "bad" | "info";
const TONE: Record<Tone, { color: string; tag: string }> = {
  good: { color: C.green, tag: "Positif" },
  warn: { color: C.amber, tag: "À surveiller" },
  bad: { color: C.red, tag: "Alerte" },
  info: { color: C.blue, tag: "Info" },
};

interface Highlight {
  icon: React.ElementType;
  tone: Tone;
  title: string;
  detail: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: TrendingUp, tone: "good",
    title: "Taux de livraison en hausse",
    detail: "82.0 % ce mois (+1.6 pts vs période précédente), tiré par les hubs d'Alger et de Blida (≥ 85 %).",
  },
  {
    icon: Truck, tone: "good",
    title: "Délai moyen amélioré",
    detail: "2.4 jours en moyenne (−0.3 j), meilleur niveau des six derniers mois sur le réseau.",
  },
  {
    icon: Coins, tone: "warn",
    title: "COD en attente de remise",
    detail: "6 720 000 DA non encore reversés aux expéditeurs, soit ~17 % du COD collecté (38 540 000 DA).",
  },
  {
    icon: Wallet, tone: "bad",
    title: "Soldes Stop Desk négatifs",
    detail: "3 SD débiteurs : Constantine (−210 000 DA), Annaba (−86 000 DA) et Batna (−32 000 DA).",
  },
  {
    icon: RotateCcw, tone: "warn",
    title: "Taux de retour élevé — Mode Dz",
    detail: "9.4 % de retours sur 2 980 colis, presque le double de la moyenne réseau (~4.8 %).",
  },
  {
    icon: BarChart3, tone: "info",
    title: "Pic d'activité en novembre",
    detail: `${fmt(TREND_PEAK)} livraisons sur le mois (+10 % vs octobre), point haut de l'année.`,
  },
  {
    icon: Route, tone: "warn",
    title: "Navette Alger → Annaba à surveiller",
    detail: "Ponctualité 81 % (11 retards) — la liaison la moins fiable du réseau ce mois-ci.",
  },
  {
    icon: MessageSquareWarning, tone: "good",
    title: "SLA réclamations tenu",
    detail: "91.4 % des réclamations résolues dans les délais, satisfaction client à 94.2 %.",
  },
];

/* ════════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════════ */

export default function OverviewReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("30j");

  return (
    <PageShell t={t}>
      {/* Demo banner — at the very top */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={LayoutDashboard}
        title="Vue d'ensemble"
        subtitle="Synthèse exécutive du réseau — volumes, performance, finance et qualité en un coup d'œil"
        action={
          <>
            <Segmented t={t} value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
            <ExportButton t={t} icon={FileText} label="PDF" color={C.red} />
            <ExportButton t={t} icon={FileSpreadsheet} label="Excel" color={C.green} />
          </>
        }
      />

      {/* ── 1. KPI BAND (12 metrics) ─────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs clés" icon={Activity} sub="12 métriques · vs période précédente" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(192px, 1fr))", gap: 12, marginBottom: 26 }}>
        {GLOBAL_KPIS.map((k) => (
          <KpiCard
            key={k.label}
            t={t}
            label={k.label}
            value={k.value}
            icon={k.icon}
            delta={k.delta}
            goodWhenUp={k.goodWhenUp}
            deltaSuffix={k.deltaSuffix}
          />
        ))}
      </div>

      {/* ── 2. TREND + STATUS MIX ────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Évolution & répartition" icon={BarChart3} sub="12 derniers mois" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Évolution des livraisons" icon={TrendingUp} sub={`Pic : ${fmt(TREND_PEAK)} en ${TREND_PEAK_MONTH}`}>
            <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
              <MiniStat t={t} label="Total période" value={fmt(TREND_TOTAL)} />
              <MiniStat t={t} label="Moyenne / mois" value={fmt(TREND_AVG)} />
              <MiniStat t={t} label="Pic mensuel" value={`${fmt(TREND_PEAK)} (${TREND_PEAK_MONTH})`} color={C.green} />
              <MiniStat t={t} label="Colis / jour" value={fmt(614)} color={ORANGE} />
            </div>
            <AreaLine t={t} data={DELIVERIES_TREND} labels={MONTHS} suffix=" colis" height={236} />
          </ChartCard>
        </div>

        <ChartCard t={t} title="Colis par statut" icon={BarChart3} sub={`${fmt(STATUS_DIST.reduce((s, d) => s + d.value, 0))} colis`}>
          <Donut t={t} data={STATUS_DIST} legend centerLabel="colis" size={168} thickness={26} />
        </ChartCard>
      </div>

      {/* ── 3. TOP 5 MINI-TABLES ─────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Classements" icon={Trophy} sub="Top 5 du réseau" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Top 5 Stop Desks" icon={Building2} noPadding>
          <DataTable
            t={t}
            rows={TOP_STOP_DESKS}
            rowKey={(s) => s.name}
            columns={[
              {
                header: "Stop Desk",
                render: (s, i) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Pill color={ORANGE}>{i + 1}</Pill>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{s.wilaya}</div>
                    </div>
                  </div>
                ),
              },
              { header: "Colis", align: "right", render: (s) => fmt(s.colis) },
              { header: "Taux", render: (s) => <ProgressCell t={t} value={s.taux} /> },
            ]}
          />
        </ChartCard>

        <ChartCard t={t} title="Top 5 Wilayas" icon={MapPin} noPadding>
          <DataTable
            t={t}
            rows={TOP_WILAYAS}
            rowKey={(w) => w.code}
            columns={[
              {
                header: "Wilaya",
                render: (w, i) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Pill color={C.blue}>{i + 1}</Pill>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{`Code ${w.code} · ${w.communes} communes`}</div>
                    </div>
                  </div>
                ),
              },
              { header: "Colis", align: "right", render: (w) => fmt(w.colis) },
              { header: "Taux", render: (w) => <ProgressCell t={t} value={w.taux} /> },
            ]}
          />
        </ChartCard>

        <ChartCard t={t} title="Top 5 Expéditeurs" icon={Store} noPadding>
          <DataTable
            t={t}
            rows={TOP_MERCHANTS}
            rowKey={(m) => m.name}
            columns={[
              {
                header: "Expéditeur",
                render: (m, i) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Pill color={C.violet}>{i + 1}</Pill>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{`${m.category} · ${fmt(m.colis)} colis`}</div>
                    </div>
                  </div>
                ),
              },
              { header: "CA", align: "right", render: (m) => formatDA(m.ca) },
            ]}
          />
        </ChartCard>
      </div>

      {/* ── 4. FINANCE / QUALITY SYNTHESIS ───────────────────────────────────── */}
      <SectionTitle t={t} title="Synthèse financière & qualité" icon={Wallet} sub="Sur la période" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 26 }}>
        <StatTile t={t} icon={Wallet} label="Marge nette" value={formatDA(FINANCE_SUMMARY.marginNet)} hint="après prélèvements & frais" accent={C.green} />
        <StatTile t={t} icon={Coins} label="COD remis aux expéditeurs" value={formatDA(FINANCE_SUMMARY.codRemitted)} hint="≈ 83 % du COD collecté" accent={C.green} />
        <StatTile t={t} icon={Coins} label="COD en attente de remise" value={formatDA(FINANCE_SUMMARY.codPending)} hint="à reverser aux expéditeurs" accent={C.amber} />
        <StatTile t={t} icon={MessageSquareWarning} label="Satisfaction client" value={SLA_SUMMARY.satisfaction} hint={`réclamations résolues à ${SLA_SUMMARY.resolvedInTime}`} accent={C.green} />
      </div>

      {/* ── 5. FAITS SAILLANTS ───────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Faits saillants" icon={Sparkles} sub="Alertes & faits notables" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {HIGHLIGHTS.map((h, i) => (
          <HighlightCard key={i} t={t} h={h} />
        ))}
      </div>
    </PageShell>
  );
}

/* ── Highlight card (local — uses tokens, no chart primitive duplicated) ─────── */
function HighlightCard({ t, h }: { t: Tokens; h: Highlight }) {
  const { color, tag } = TONE[h.tone];
  const Icon = h.icon;
  return (
    <div
      style={{
        display: "flex", gap: 12, padding: "14px 15px",
        background: t.card, borderRadius: 13, border: `1px solid ${t.border}`,
        boxShadow: t.shadow, borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={17} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{h.title}</span>
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color, background: `${color}15`, padding: "2px 7px", borderRadius: 99 }}>{tag}</span>
        </div>
        <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>{h.detail}</div>
      </div>
    </div>
  );
}
