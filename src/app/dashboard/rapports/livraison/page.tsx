"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — PERFORMANCE DE LIVRAISON  (page #36)
 *
 *  HARDCODED showcase. No API calls — every figure is illustrative and kept
 *  internally consistent with the shared mock data in `./_data`:
 *    • 18 432 colis  →  15 108 livrés (82.0 %)  →  290 échecs.
 *
 *  Reuses the shared chart/layout primitives from `./_charts` and the design
 *  tokens from `../_ui`. Report-specific series live in local consts below.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Truck, Percent, Clock, CheckCircle2, XCircle, Target, Repeat,
  Activity, AlertTriangle, TrendingUp, Building2, Layers,
  FileText, FileSpreadsheet, Home, Store,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, MiniStat, Gauge, Donut, VBars, HBars, AreaLine, SplitBar,
  DataTable, ProgressCell, Pill, Segmented, SelectField, ExportButton,
  C, fmt, type Segment,
} from "../_charts";
import {
  MONTHS, DELIVERIES_TREND, STOP_DESKS, PERIOD_OPTIONS, SD_FILTER_OPTIONS,
} from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  REPORT-SPECIFIC HARDCODED DATA
 *  (anchored to: 18 432 colis · 15 108 livrés · 2 140 en cours · 894 retours ·
 *   290 échecs — same figures as GLOBAL_KPIS / STATUS_DIST in ./_data)
 * ════════════════════════════════════════════════════════════════════════ */

const TOTAL_COLIS = 18432;
const LIVRES = 15108;
const EN_COURS = 2140;
const RETOURS = 894;
const ECHECS = 290;

/** Headline delivery KPIs (the 5 requested + a 1st-attempt bonus). */
const LIV_KPIS = [
  { label: "Taux de livraison",        value: "82.0 %",     icon: Percent,      delta: 1.6,  goodWhenUp: true,  deltaSuffix: " pts" },
  { label: "Délai moyen de livraison", value: "2.4 j",      icon: Clock,        delta: -0.3, goodWhenUp: false, deltaSuffix: " j"   },
  { label: "Livré à temps (SLA)",      value: "88.6 %",     icon: CheckCircle2, delta: 2.1,  goodWhenUp: true,  deltaSuffix: " pts" },
  { label: "Échecs de livraison",      value: fmt(ECHECS),  icon: XCircle,      delta: 0.8,  goodWhenUp: false, deltaSuffix: "%"    },
  { label: "Réussite 1ʳᵉ tentative",   value: "73.4 %",     icon: Target,       delta: 1.9,  goodWhenUp: true,  deltaSuffix: " pts" },
  { label: "Réussite 2ᵉ tentative",    value: "64.3 %",     icon: Repeat,       delta: 3.2,  goodWhenUp: true,  deltaSuffix: " pts" },
] as const;

/** Outcome of delivery attempts (1ʳᵉ + 2ᵉ + 3ᵉ = 15 108 livrés ; + 290 échecs). */
const ATTEMPTS: Segment[] = [
  { label: "Livré 1ʳᵉ tentative",       value: 13520, color: C.green },
  { label: "Livré 2ᵉ tentative",        value: 1340,  color: C.cyan  },
  { label: "Livré 3ᵉ tentative",        value: 248,   color: C.blue  },
  { label: "Échec après tentatives",    value: 290,   color: C.red   },
];

/** Délai de livraison J+0 → J+5+ (sum = 15 108 livrés ; moyenne pondérée ≈ 2.4 j). */
const DELAY_DIST = [760, 3080, 4720, 3460, 1980, 1108];
const DELAY_LABELS = ["J+0", "J+1", "J+2", "J+3", "J+4", "J+5+"];

/** Ponctualité vs date promise (à temps + en retard = 15 108 ; 88.6 % à temps). */
const ONTIME_SPLIT: Segment[] = [
  { label: "Livré à temps",  value: 13386, color: C.green },
  { label: "Livré en retard", value: 1722, color: C.amber },
];

/** Échecs de livraison par raison (sum = 290). */
const FAIL_REASONS: Segment[] = [
  { label: "Client absent",            value: 96, color: C.amber  },
  { label: "Injoignable (téléphone)",  value: 72, color: C.orange },
  { label: "Client a refusé",          value: 58, color: C.red    },
  { label: "Adresse erronée",          value: 38, color: C.blue   },
  { label: "Hors zone / inaccessible", value: 16, color: C.slate  },
  { label: "Colis endommagé",          value: 10, color: C.pink   },
];

/**
 * Per-SD delivery extras (échecs ∑ = 290) merged onto the shared STOP_DESKS
 * rows so name/wilaya/colis/taux/délai stay consistent with ./_data.
 */
const SD_EXTRA: Record<string, { echecs: number; onTime: number; retent: number }> = {
  "Hub Alger":      { echecs: 64, onTime: 91.2, retent: 68 },
  "SD Oran Centre": { echecs: 52, onTime: 86.4, retent: 61 },
  "SD Constantine": { echecs: 44, onTime: 84.1, retent: 58 },
  "SD Bab El Oued": { echecs: 30, onTime: 89.0, retent: 66 },
  "SD Blida":       { echecs: 22, onTime: 90.3, retent: 69 },
  "SD El Hadjeb":   { echecs: 18, onTime: 88.2, retent: 64 },
  "SD Annaba":      { echecs: 24, onTime: 81.6, retent: 55 },
  "SD Sétif":       { echecs: 14, onTime: 89.5, retent: 67 },
  "SD Béjaïa":      { echecs: 12, onTime: 83.4, retent: 59 },
  "SD Batna":       { echecs: 10, onTime: 80.2, retent: 53 },
};

const LIV_PAR_SD = STOP_DESKS.map((s) => ({
  ...s,
  ...(SD_EXTRA[s.name] ?? { echecs: 0, onTime: 0, retent: 0 }),
}));
type SdRow = (typeof LIV_PAR_SD)[number];

/** Per delivery-mode performance (colis ∑ = 18 432 ; échecs ∑ = 290). */
const LIV_PAR_MODE = [
  { mode: "À domicile", icon: Home,  colis: 11540, taux: 80, delai: 2.6, echecs: 198, onTime: 86.4 },
  { mode: "Stop Desk",  icon: Store, colis: 6892,  taux: 86, delai: 2.0, echecs: 92,  onTime: 92.1 },
];
type ModeRow = (typeof LIV_PAR_MODE)[number];

/* ══════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export default function LivraisonReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("30j");

  return (
    <PageShell t={t} maxWidth={1320}>
      {/* DEMO BANNER — at the very top, per spec */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Truck}
        title="Performance de Livraison"
        subtitle="Taux de livraison, délais, ponctualité, échecs et tentatives — réseau de distribution Algérie"
        action={
          <>
            <ExportButton t={t} icon={FileText} label="PDF" color={C.red} />
            <ExportButton t={t} icon={FileSpreadsheet} label="Excel" color={C.green} />
          </>
        }
      />

      {/* FILTER BAR (visual only) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Segmented t={t} value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SelectField t={t} icon={Building2} options={SD_FILTER_OPTIONS} />
          <SelectField t={t} icon={Layers} options={["Tous les modes", "À domicile", "Stop Desk"]} />
        </div>
      </div>

      {/* ── 1. KPIs ─────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs clés de livraison" icon={Activity} sub="période en cours vs précédente" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(186px, 1fr))", gap: 13, marginBottom: 24 }}>
        {LIV_KPIS.map((k) => (
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

      {/* ── 2. Taux de réussite & tentatives ────────────────────────────── */}
      <SectionTitle t={t} title="Taux de réussite & tentatives" icon={Target} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 24 }}>
        <ChartCard t={t} title="Taux de livraison" icon={Percent} sub="colis livrés / total">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Gauge t={t} value={LIVRES} total={TOTAL_COLIS} color={C.green} label={`${fmt(LIVRES)} / ${fmt(TOTAL_COLIS)} colis`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, width: "100%", paddingTop: 6, borderTop: `1px solid ${t.divider}` }}>
              <MiniStat t={t} label="Livrés"   value={fmt(LIVRES)}   color={C.green} />
              <MiniStat t={t} label="En cours" value={fmt(EN_COURS)} color={C.cyan}  />
              <MiniStat t={t} label="Retours"  value={fmt(RETOURS)}  color={C.amber} />
              <MiniStat t={t} label="Échecs"   value={fmt(ECHECS)}   color={C.red}   />
            </div>
          </div>
        </ChartCard>

        <ChartCard t={t} title="Réussite par tentative" icon={Repeat} sub="répartition des issues">
          <Donut t={t} data={ATTEMPTS} legend centerValue={fmt(LIVRES)} centerLabel="livrés" />
        </ChartCard>
      </div>

      {/* ── 3. Délais, ponctualité & échecs ─────────────────────────────── */}
      <SectionTitle t={t} title="Délais, ponctualité & échecs" icon={Clock} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 24 }}>
        <ChartCard t={t} title="Distribution des délais de livraison" icon={Clock} sub="moyenne 2.4 j · médiane J+2">
          <VBars t={t} data={DELAY_DIST} labels={DELAY_LABELS} color={C.blue} format={(v) => fmt(v)} />
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.divider}` }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: t.textMuted, marginBottom: 9 }}>
              Ponctualité (vs date promise)
            </div>
            <SplitBar t={t} data={ONTIME_SPLIT} />
          </div>
        </ChartCard>

        <ChartCard t={t} title="Échecs par raison" icon={AlertTriangle} sub={`${fmt(ECHECS)} échecs au total`}>
          <HBars t={t} data={FAIL_REASONS} unit=" colis" />
        </ChartCard>
      </div>

      {/* ── 4. Évolution mensuelle ──────────────────────────────────────── */}
      <SectionTitle t={t} title="Évolution des livraisons" icon={TrendingUp} sub="12 derniers mois" />
      <div style={{ marginBottom: 24 }}>
        <ChartCard t={t} title="Livraisons par mois" icon={Truck} sub="colis livrés / mois">
          <AreaLine t={t} data={DELIVERIES_TREND} labels={MONTHS} color={C.green} suffix=" colis" />
        </ChartCard>
      </div>

      {/* ── 5. Performance par Stop Desk ────────────────────────────────── */}
      <SectionTitle t={t} title="Performance par Stop Desk" icon={Building2} sub={`${LIV_PAR_SD.length} centres`} />
      <div style={{ marginBottom: 24 }}>
        <ChartCard t={t} noPadding>
          <DataTable<SdRow>
            t={t}
            rows={LIV_PAR_SD}
            rowKey={(s) => s.name}
            columns={[
              { header: "Stop Desk", render: (s) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700, color: t.text }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: t.textFaint }}>{s.wilaya}</span>
                </div>
              ) },
              { header: "Colis",        align: "right", render: (s) => fmt(s.colis) },
              { header: "Taux livr.",   align: "left",  width: 150, render: (s) => <ProgressCell t={t} value={s.taux} /> },
              { header: "Délai moyen",  align: "right", render: (s) => `${s.delai.toFixed(1)} j` },
              { header: "À temps",      align: "right", render: (s) => `${s.onTime.toFixed(1)} %` },
              { header: "Échecs",       align: "center", render: (s) => <Pill color={C.red}>{s.echecs}</Pill> },
              { header: "2ᵉ tentative", align: "right", render: (s) => `${s.retent} %` },
            ]}
          />
        </ChartCard>
      </div>

      {/* ── 6. Performance par mode de livraison ────────────────────────── */}
      <SectionTitle t={t} title="Performance par mode de livraison" icon={Layers} />
      <ChartCard t={t} noPadding>
        <DataTable<ModeRow>
          t={t}
          rows={LIV_PAR_MODE}
          rowKey={(m) => m.mode}
          columns={[
            { header: "Mode", render: (m) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: t.text }}>
                <m.icon size={15} color={C.orange} /> {m.mode}
              </span>
            ) },
            { header: "Colis",       align: "right", render: (m) => fmt(m.colis) },
            { header: "Part",        align: "right", render: (m) => `${((m.colis / TOTAL_COLIS) * 100).toFixed(1)} %` },
            { header: "Taux livr.",  align: "left", width: 150, render: (m) => <ProgressCell t={t} value={m.taux} /> },
            { header: "Délai moyen", align: "right", render: (m) => `${m.delai.toFixed(1)} j` },
            { header: "À temps",     align: "right", render: (m) => `${m.onTime.toFixed(1)} %` },
            { header: "Échecs",      align: "center", render: (m) => <Pill color={C.red}>{m.echecs}</Pill> },
          ]}
        />
      </ChartCard>
    </PageShell>
  );
}
