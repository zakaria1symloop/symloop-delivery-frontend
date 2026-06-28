"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT DES CHAUFFEURS  (livreurs / drivers performance)
 *
 *  HARDCODED showcase. No API calls — every figure is illustrative and kept
 *  internally consistent with the shared `DRIVERS` mock data in `./_data`:
 *    • 8 chauffeurs actifs · 7 790 livraisons · taux de succès moyen ≈ 87.6 %
 *    • 22 340 000 DA de COD collecté · 765 000 DA de commissions · 214 retards.
 *
 *  Reuses the shared chart/layout primitives from `../_charts` and the design
 *  tokens from `../../_ui`. Report-specific series (ponctualité, flotte, etc.)
 *  live in local consts below — no chart primitive is re-implemented here.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Bike, Truck, Percent, Coins, Wallet, Clock, Activity, AlertTriangle,
  BarChart3, Users, Target, Trophy, Award, Building2, Gauge as GaugeIcon,
  FileText, FileSpreadsheet,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, Gauge, Donut, VBars, HBars,
  DataTable, ProgressCell, Pill, Segmented, SelectField, ExportButton,
  C, fmt, formatDA, rainbow, ORANGE, type Segment,
} from "../_charts";
import { DRIVERS, PERIOD_OPTIONS, SD_FILTER_OPTIONS, fmtCompact } from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  AGGREGATES — derived from the shared DRIVERS array so the headline numbers
 *  always reconcile with the per-driver table below.
 * ════════════════════════════════════════════════════════════════════════ */

const ACTIFS = DRIVERS.length;                                            // 8
const TOTAL_LIV = DRIVERS.reduce((s, d) => s + d.liv, 0);                 // 7 790
const TOTAL_COD = DRIVERS.reduce((s, d) => s + d.cod, 0);                 // 22 340 000
const TOTAL_COMM = DRIVERS.reduce((s, d) => s + d.comm, 0);              // 765 000
const TOTAL_RETARDS = DRIVERS.reduce((s, d) => s + d.retards, 0);        // 214

/** Volume-weighted success rate (livraisons-pondéré) ≈ 87.6 %. */
const AVG_SUCCESS = DRIVERS.reduce((s, d) => s + d.liv * d.taux, 0) / TOTAL_LIV;
/** Implied attempts & failures consistent with the weighted success rate. */
const TENTATIVES = Math.round(TOTAL_LIV / (AVG_SUCCESS / 100));           // ≈ 8 890
const ECHECS = TENTATIVES - TOTAL_LIV;                                    // ≈ 1 100

const COD_MOYEN = Math.round(TOTAL_COD / ACTIFS);                         // 2 792 500
const COMM_MOYENNE = Math.round(TOTAL_COMM / ACTIFS);                     // 95 625
const LIV_MOYENNE = Math.round(TOTAL_LIV / ACTIFS);                       // 974

/* ══════════════════════════════════════════════════════════════════════════
 *  REPORT-SPECIFIC HARDCODED DATA (ponctualité + flotte)
 *  Keyed by driver name → merged onto the shared DRIVERS rows. Ponctualité is
 *  inversely aligned with the `retards` count (more retards → lower on-time %).
 * ════════════════════════════════════════════════════════════════════════ */

const DRIVER_EXTRA: Record<string, { ponct: number; vehicule: string }> = {
  "Karim Benali":    { ponct: 96, vehicule: "Moto" },
  "Riad Boudjema":   { ponct: 95, vehicule: "Moto" },
  "Sofiane Meziane": { ponct: 93, vehicule: "Voiture utilitaire" },
  "Nabil Saïdi":     { ponct: 94, vehicule: "Moto" },
  "Yacine Haddad":   { ponct: 90, vehicule: "Camionnette" },
  "Mohamed Chérif":  { ponct: 87, vehicule: "Voiture utilitaire" },
  "Amine Khelifi":   { ponct: 85, vehicule: "Voiture utilitaire" },
  "Walid Brahimi":   { ponct: 95, vehicule: "Moto" },
};

const PERF_ROWS = DRIVERS.map((d) => ({ ...d, ...DRIVER_EXTRA[d.name] }));
type PerfRow = (typeof PERF_ROWS)[number];

const AVG_PONCT = PERF_ROWS.reduce((s, r) => s + r.ponct, 0) / ACTIFS;    // ≈ 91.9 %

/** Fleet mix (sum = 8 = ACTIFS). */
const FLOTTE: Segment[] = [
  { label: "Moto",              value: 4, color: C.orange },
  { label: "Voiture utilitaire", value: 3, color: C.blue },
  { label: "Camionnette",       value: 1, color: C.violet },
];

/* ── Chart series (first names keep the x-axis legible) ─────────────────────── */
const firstName = (full: string) => full.split(" ")[0];

const LIV_BARS = DRIVERS.map((d) => d.liv);
const LIV_LABELS = DRIVERS.map((d) => firstName(d.name));

const COMM_BARS: Segment[] = DRIVERS.map((d, i) => ({ label: d.name, value: d.comm, color: rainbow(i) }));
const COD_BARS: Segment[] = DRIVERS.map((d, i) => ({ label: d.name, value: d.cod, color: rainbow(i) }));

/* ── KPI band ───────────────────────────────────────────────────────────────
 * The 5 requested headline metrics + 3 bonus operational metrics. */
const KPIS = [
  { label: "Chauffeurs actifs",      value: fmt(ACTIFS),                       icon: Bike,          delta: 2,    goodWhenUp: true,  deltaSuffix: "" },
  { label: "Livraisons",             value: fmt(TOTAL_LIV),                    icon: Truck,         delta: 9.4,  goodWhenUp: true,  deltaSuffix: "%" },
  { label: "Taux de succès moyen",   value: `${AVG_SUCCESS.toFixed(1)} %`,     icon: Percent,       delta: 1.8,  goodWhenUp: true,  deltaSuffix: " pts" },
  { label: "COD collecté",           value: formatDA(TOTAL_COD),               icon: Coins,         delta: 11.2, goodWhenUp: true,  deltaSuffix: "%" },
  { label: "Commissions",            value: formatDA(TOTAL_COMM),              icon: Wallet,        delta: 8.6,  goodWhenUp: true,  deltaSuffix: "%" },
  { label: "Ponctualité moyenne",    value: `${AVG_PONCT.toFixed(1)} %`,       icon: Clock,         delta: 2.3,  goodWhenUp: true,  deltaSuffix: " pts" },
  { label: "Retards cumulés",        value: fmt(TOTAL_RETARDS),                icon: AlertTriangle, delta: -6.5, goodWhenUp: false, deltaSuffix: "%" },
  { label: "Livraisons / chauffeur", value: fmt(LIV_MOYENNE),                  icon: Activity,      delta: 5.1,  goodWhenUp: true,  deltaSuffix: "%" },
] as const;

/** Retards count → pill colour (≥35 critique, ≥25 à surveiller, sinon OK). */
const retardColor = (n: number) => (n >= 35 ? C.red : n >= 25 ? C.amber : C.green);

/* ════════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════════ */

export default function ChauffeursReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("30j");

  const topVolume = PERF_ROWS[0];                               // already sorted by liv desc
  const topPonct = [...PERF_ROWS].sort((a, b) => b.ponct - a.ponct)[0];

  return (
    <PageShell t={t} maxWidth={1320}>
      {/* DEMO BANNER — at the very top, per spec */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Bike}
        title="Rapport des Chauffeurs"
        subtitle="Performance des livreurs — livraisons, taux de succès, COD collecté, commissions et ponctualité"
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
          <SelectField t={t} icon={Bike} options={["Tous les véhicules", "Moto", "Voiture utilitaire", "Camionnette"]} />
        </div>
      </div>

      {/* ── 1. KPIs ─────────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs clés des chauffeurs" icon={Activity} sub="période en cours vs précédente" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(186px, 1fr))", gap: 13, marginBottom: 26 }}>
        {KPIS.map((k) => (
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

      {/* ── 2. Livraisons par chauffeur + Taux de succès moyen ──────────────── */}
      <SectionTitle t={t} title="Livraisons & taux de succès" icon={BarChart3} sub={`${ACTIFS} chauffeurs · ${fmt(TOTAL_LIV)} livraisons`} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Livraisons par chauffeur" icon={Truck} sub="colis livrés sur la période">
            <VBars t={t} data={LIV_BARS} labels={LIV_LABELS} color={ORANGE} height={210} format={(v) => fmt(v)} />
          </ChartCard>
        </div>

        <ChartCard t={t} title="Taux de succès moyen" icon={GaugeIcon} sub="pondéré par volume">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Gauge t={t} value={AVG_SUCCESS} total={100} color={C.green} display={`${AVG_SUCCESS.toFixed(1)} %`} label="livraisons réussies" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, width: "100%", paddingTop: 6, borderTop: `1px solid ${t.divider}` }}>
              <MiniStat t={t} label="Livraisons" value={fmt(TOTAL_LIV)} color={C.green} />
              <MiniStat t={t} label="Tentatives" value={fmt(TENTATIVES)} color={C.blue} />
              <MiniStat t={t} label="Échecs" value={fmt(ECHECS)} color={C.red} />
              <MiniStat t={t} label="Ponctualité" value={`${AVG_PONCT.toFixed(1)} %`} color={ORANGE} />
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── 3. Répartition du COD & flotte ──────────────────────────────────── */}
      <SectionTitle t={t} title="COD collecté & flotte" icon={Coins} sub={`${formatDA(TOTAL_COD)} encaissés`} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="COD collecté par chauffeur" icon={Coins} sub="part de l'encaissement total">
          <Donut t={t} data={COD_BARS} legend legendMoney centerValue={fmtCompact(TOTAL_COD)} centerLabel="COD (DA)" />
        </ChartCard>

        <ChartCard t={t} title="Flotte de véhicules" icon={Bike} sub={`${ACTIFS} chauffeurs`}>
          <Donut t={t} data={FLOTTE} legend centerLabel="chauffeurs" />
        </ChartCard>
      </div>

      {/* ── 4. Commissions par chauffeur ────────────────────────────────────── */}
      <SectionTitle t={t} title="Commissions par chauffeur" icon={Wallet} sub={`${formatDA(TOTAL_COMM)} au total · moyenne ${formatDA(COMM_MOYENNE)}`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Commissions versées" icon={Wallet} sub="cumul sur la période">
          <HBars t={t} data={COMM_BARS} money />
        </ChartCard>
      </div>

      {/* ── 5. Performance détaillée (table) ────────────────────────────────── */}
      <SectionTitle t={t} title="Performance détaillée des chauffeurs" icon={Users} sub={`${ACTIFS} chauffeurs actifs`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} noPadding>
          <DataTable<PerfRow>
            t={t}
            rows={PERF_ROWS}
            rowKey={(d) => d.name}
            columns={[
              {
                header: "Chauffeur",
                render: (d, i) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Pill color={ORANGE}>{i + 1}</Pill>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{`${d.sd} · ${d.vehicule}`}</div>
                    </div>
                  </div>
                ),
              },
              { header: "Livraisons",   align: "right",  render: (d) => fmt(d.liv) },
              { header: "Succès",       align: "left",   width: 150, render: (d) => <ProgressCell t={t} value={d.taux} /> },
              { header: "COD collecté", align: "right",  render: (d) => formatDA(d.cod) },
              { header: "Commission",   align: "right",  render: (d) => formatDA(d.comm) },
              { header: "Retards",      align: "center", render: (d) => <Pill color={retardColor(d.retards)}>{d.retards}</Pill> },
              { header: "Ponctualité",  align: "left",   width: 150, render: (d) => <ProgressCell t={t} value={d.ponct} /> },
            ]}
          />
        </ChartCard>
      </div>

      {/* ── 6. Synthèse ─────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Synthèse & meilleurs profils" icon={Trophy} sub="sur la période" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        <StatTile t={t} icon={Award} label="Meilleur volume" value={topVolume.name} hint={`${fmt(topVolume.liv)} livraisons · ${topVolume.taux} % de succès`} accent={C.green} />
        <StatTile t={t} icon={Target} label="Meilleure ponctualité" value={topPonct.name} hint={`${topPonct.ponct} % à temps · ${topPonct.retards} retards`} accent={C.green} />
        <StatTile t={t} icon={Coins} label="COD moyen / chauffeur" value={formatDA(COD_MOYEN)} hint={`sur ${formatDA(TOTAL_COD)} collectés`} accent={ORANGE} />
        <StatTile t={t} icon={Wallet} label="Commission moyenne" value={formatDA(COMM_MOYENNE)} hint={`sur ${formatDA(TOTAL_COMM)} versés`} accent={ORANGE} />
      </div>
    </PageShell>
  );
}
