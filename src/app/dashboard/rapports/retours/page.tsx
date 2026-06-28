"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT DES RETOURS  (report #37)
 *
 *  HARDCODED showcase page. Every figure is illustrative (Algerian delivery
 *  network) and internally consistent with the shared mock data in `./_data`.
 *  No API calls. All charts/tables are drawn with the shared primitives in
 *  `./_charts` — nothing here re-implements a chart.
 *
 *  Internal-consistency anchors (current period):
 *    • Total colis ......... 18 432   (GLOBAL_KPIS / _data)
 *    • Total retours .......    894   (= Σ RETURN_REASONS = Σ RETURN_STATUS = Σ SD_RETURNS)
 *    • Taux de retour ......  4.85 %  (894 / 18 432)
 *    • Retournés ...........    612   (RETURN_STATUS "Retourné à l'expéditeur")
 *    • En cours ............    282   (894 − 612 → transit + ramassage + à traiter)
 *    • Coût des retours .... 286 080 DA (= 894 × 320 DA / retour)
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  RotateCcw, Percent, Truck, PackageCheck, Coins, Clock,
  Building2, Store, ListChecks, TrendingDown, Activity,
  FileText, FileSpreadsheet, MapPin, ListFilter, CalendarDays,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, Gauge, Donut, HBars, AreaLine, SplitBar,
  DataTable, ProgressCell, Pill, ExportButton, Segmented, SelectField,
  C, fmt, rainbow, formatDA, type Segment,
} from "../_charts";
import {
  RETURN_REASONS, RETURNS_TREND, MONTHS, MERCHANTS,
  SD_FILTER_OPTIONS, WILAYA_FILTER_OPTIONS, PERIOD_OPTIONS,
} from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  LOCAL HARDCODED DATA  (specific to the returns report)
 * ════════════════════════════════════════════════════════════════════════ */

/** Anchor totals — keep every section reconciled to these. */
const TOTAL_COLIS = 18_432;
const TOTAL_RETOURS = 894;              // = Σ RETURN_REASONS
const RETOURNES = 612;                  // completed → back with sender
const EN_COURS = TOTAL_RETOURS - RETOURNES; // 282 in-flight
const TAUX_RETOUR = 4.85;               // 894 / 18 432 · %
const TAUX_CIBLE = 6.0;                 // SLA ceiling
const COUT_PAR_RETOUR = 320;            // DA, reverse-logistics handling
const COUT_RETOURS = TOTAL_RETOURS * COUT_PAR_RETOUR; // 286 080 DA

/** Lifecycle status of the 894 returns (Σ = 894). */
const RETURN_STATUS: Segment[] = [
  { label: "Retourné à l'expéditeur", value: 612, color: C.green },
  { label: "En transit retour",       value: 168, color: C.blue },
  { label: "En attente de ramassage", value: 76,  color: C.amber },
  { label: "À traiter",               value: 38,  color: C.slate },
];

/** Returns per Stop Desk — colis aligned with STOP_DESKS, retours Σ = 894. */
const SD_RETURNS = [
  { sd: "Hub Alger",      colis: 5420, retours: 238 },
  { sd: "SD Oran Centre", colis: 3140, retours: 156 },
  { sd: "SD Constantine", colis: 2460, retours: 142 },
  { sd: "SD Bab El Oued", colis: 2180, retours: 96 },
  { sd: "SD Blida",       colis: 1840, retours: 74 },
  { sd: "SD El Hadjeb",   colis: 1520, retours: 58 },
  { sd: "SD Annaba",      colis: 1180, retours: 62 },
  { sd: "SD Sétif",       colis: 980,  retours: 32 },
  { sd: "SD Béjaïa",      colis: 692,  retours: 22 },
  { sd: "SD Batna",       colis: 540,  retours: 14 },
];

/** Ranking bars for "retours par SD". */
const SD_RETURNS_BARS: Segment[] = SD_RETURNS.map((s, i) => ({
  label: s.sd, value: s.retours, color: rainbow(i),
}));

const RAISON_FILTER_OPTIONS = [
  "Toutes les raisons",
  ...RETURN_REASONS.map((r) => r.label),
];

export default function RapportRetoursPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("mois");

  /* ── derived per-merchant return figures (volume + cost) ── */
  const merchantRows = MERCHANTS.map((m) => {
    const volume = Math.round((m.colis * m.retour) / 100);
    return { ...m, volume, cout: volume * COUT_PAR_RETOUR };
  });

  const gridStyle = (min: number) => ({
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
    gap: 14,
    marginBottom: 22,
  } as const);

  return (
    <PageShell t={t} maxWidth={1440}>
      {/* DEMO BANNER — very top */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={RotateCcw}
        title="Rapport des Retours"
        subtitle="Taux de retour, raisons, répartition par Stop Desk et par expéditeur — réseau de livraison (données illustratives)"
        action={
          <>
            <Segmented t={t} value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
            <ExportButton t={t} icon={FileText} label="PDF" color={C.red} />
            <ExportButton t={t} icon={FileSpreadsheet} label="Excel" color={C.green} />
          </>
        }
      />

      {/* FILTER BAR (visual only) */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
        <SelectField t={t} icon={CalendarDays} options={["Ce mois", "Mois dernier", "Trimestre", "Année"]} />
        <SelectField t={t} icon={Building2} options={SD_FILTER_OPTIONS} />
        <SelectField t={t} icon={MapPin} options={WILAYA_FILTER_OPTIONS} />
        <SelectField t={t} icon={ListFilter} options={RAISON_FILTER_OPTIONS} />
      </div>

      {/* ═══ KPIs ═══ */}
      <SectionTitle t={t} title="Indicateurs clés des retours" icon={RotateCcw} sub="période en cours" />
      <div style={gridStyle(200)}>
        <KpiCard t={t} label="Total retours"        value={fmt(TOTAL_RETOURS)}        icon={RotateCcw}    delta={-2.1} goodWhenUp={false} />
        <KpiCard t={t} label="Taux de retour"       value={`${TAUX_RETOUR.toFixed(2)} %`} icon={Percent}  delta={-0.3} goodWhenUp={false} deltaSuffix=" pts" />
        <KpiCard t={t} label="En cours de retour"   value={fmt(EN_COURS)}             icon={Truck}        delta={-8.2} goodWhenUp={false} />
        <KpiCard t={t} label="Retournés à l'expéditeur" value={fmt(RETOURNES)}        icon={PackageCheck} delta={4.1}  goodWhenUp={true} />
        <KpiCard t={t} label="Coût des retours"     value={formatDA(COUT_RETOURS)}    icon={Coins}        delta={-1.8} goodWhenUp={false} />
        <KpiCard t={t} label="Délai moyen de retour" value="3.2 j"                    icon={Clock}        delta={-0.4} goodWhenUp={false} deltaSuffix=" j" />
      </div>

      {/* ═══ TAUX + RAISONS ═══ */}
      <SectionTitle t={t} title="Taux de retour & raisons" icon={Percent} />
      <div style={gridStyle(360)}>
        <ChartCard t={t} title="Taux de retour" sub={`cible ≤ ${TAUX_CIBLE.toFixed(0)} %`}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Gauge
              t={t}
              value={TAUX_RETOUR}
              total={TAUX_CIBLE}
              color={C.green}
              display={`${TAUX_RETOUR.toFixed(2)} %`}
              label={`sous la cible de ${TAUX_CIBLE.toFixed(0)} %`}
            />
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "center", paddingTop: 4 }}>
              <MiniStat t={t} label="Cible SLA"     value={`≤ ${TAUX_CIBLE.toFixed(0)} %`} />
              <MiniStat t={t} label="Période préc." value="5.15 %" color={C.amber} />
              <MiniStat t={t} label="Meilleur SD"   value="Batna 2.6 %" color={C.green} />
              <MiniStat t={t} label="Pire SD"       value="Constantine 5.8 %" color={C.red} />
            </div>
          </div>
        </ChartCard>

        <ChartCard t={t} title="Retours par raison" sub={`${fmt(TOTAL_RETOURS)} retours`}>
          <Donut t={t} data={RETURN_REASONS} legend centerLabel="retours" />
        </ChartCard>
      </div>

      {/* ═══ RÉPARTITION OPÉRATIONNELLE ═══ */}
      <SectionTitle t={t} title="Répartition opérationnelle" icon={Building2} />
      <div style={gridStyle(360)}>
        <ChartCard t={t} title="Retours par Stop Desk" sub="volume">
          <HBars t={t} data={SD_RETURNS_BARS} unit=" retours" />
        </ChartCard>

        <ChartCard t={t} title="Statut des retours" sub={`${fmt(TOTAL_RETOURS)} retours`}>
          <SplitBar t={t} data={RETURN_STATUS} />
          <div style={{ marginTop: 16, fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: t.text }}>{fmt(RETOURNES)}</strong> retours bouclés et restitués à l'expéditeur,
            soit un taux de récupération de <strong style={{ color: C.green }}>68.5 %</strong>.
            Les <strong style={{ color: t.text }}>{fmt(EN_COURS)}</strong> restants sont en cours de
            ré-acheminement vers le SD d'origine.
          </div>
        </ChartCard>
      </div>

      {/* ═══ QUALITÉ DU TRAITEMENT ═══ */}
      <SectionTitle t={t} title="Qualité du traitement des retours" icon={Activity} />
      <div style={gridStyle(220)}>
        <StatTile t={t} icon={Clock}       label="Délai moyen de retour"   value="3.2 j"   hint="de l'échec à la restitution" />
        <StatTile t={t} icon={Coins}       label="Coût moyen / retour"     value={formatDA(COUT_PAR_RETOUR)} hint="logistique inverse" />
        <StatTile t={t} icon={PackageCheck} label="Taux de récupération"   value="68.5 %"  hint="restitués / total retours" accent={C.green} />
        <StatTile t={t} icon={TrendingDown} label="Manque à gagner COD"    value={formatDA(2_640_000)} hint="COD non recouvré sur retours" accent={C.red} />
      </div>

      {/* ═══ ÉVOLUTION ═══ */}
      <SectionTitle t={t} title="Évolution des retours" icon={TrendingDown} />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} title="Volume mensuel de retours" sub="12 derniers mois">
          <AreaLine t={t} data={RETURNS_TREND} labels={MONTHS} suffix=" retours" color={C.amber} />
        </ChartCard>
      </div>

      {/* ═══ DÉTAIL PAR EXPÉDITEUR ═══ */}
      <SectionTitle t={t} title="Détail par expéditeur" icon={Store} sub="top expéditeurs par volume de retours" />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} noPadding>
          <DataTable
            t={t}
            rows={merchantRows}
            rowKey={(m) => m.name}
            columns={[
              { header: "Expéditeur", render: (m) => <strong style={{ color: t.text }}>{m.name}</strong> },
              { header: "Catégorie", render: (m) => <span style={{ color: t.textMuted }}>{m.category}</span> },
              { header: "Colis", align: "right", render: (m) => fmt(m.colis) },
              { header: "Retours", align: "right", render: (m) => <Pill color={C.amber}>{fmt(m.volume)}</Pill> },
              { header: "Taux retour", render: (m) => <ProgressCell t={t} value={m.retour} invert /> },
              { header: "Coût estimé", align: "right", render: (m) => formatDA(m.cout) },
            ]}
          />
        </ChartCard>
      </div>

      {/* ═══ DÉTAIL DES RAISONS ═══ */}
      <SectionTitle t={t} title="Détail des raisons de retour" icon={ListChecks} />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} noPadding>
          <DataTable
            t={t}
            rows={RETURN_REASONS}
            rowKey={(r) => r.label}
            columns={[
              {
                header: "Raison",
                render: (r) => (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                    <span style={{ color: t.text, fontWeight: 600 }}>{r.label}</span>
                  </span>
                ),
              },
              { header: "Retours", align: "right", render: (r) => fmt(r.value) },
              {
                header: "Part",
                render: (r) => (
                  <ProgressCell t={t} value={Number(((r.value / TOTAL_RETOURS) * 100).toFixed(1))} />
                ),
              },
              { header: "Coût estimé", align: "right", render: (r) => formatDA(r.value * COUT_PAR_RETOUR) },
            ]}
          />
        </ChartCard>
      </div>
    </PageShell>
  );
}
