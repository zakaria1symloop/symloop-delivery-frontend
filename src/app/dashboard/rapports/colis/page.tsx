"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT DES COLIS  (report #2)
 *
 *  Volumes, statuts, types de service, évolution sur 12 mois, répartition
 *  domicile / stop-desk, et détails par jour de semaine et par Stop Desk.
 *
 *  ⚠️  HARDCODED showcase. Shared series come from `./_data`; figures that are
 *  specific to this report are declared locally below. Everything is internally
 *  consistent around a total parc de 18 432 colis :
 *      • statuts      Σ = 18 432   (STATUS_DIST)
 *      • services     Σ = 18 432   (SERVICE_TYPES)
 *      • modes        Σ = 18 432   (DELIVERY_MODES)
 *      • poids        Σ = 18 432   (WEIGHT_BANDS, local)
 *      • jour semaine Σ = 18 432 colis / 15 108 livrés / 894 retours (local)
 *  Chart primitives are NOT recreated here — they are imported from `./_charts`.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Boxes, Package, PackagePlus, PackageCheck, Truck, XCircle, RotateCcw,
  Percent, Scale, PieChart, Layers, TrendingUp, Home, Building2,
  CalendarDays, MapPin, FileText, Sheet, Filter,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, Donut, HBars, AreaLine, SplitBar, DataTable,
  ProgressCell, Pill, Segmented, SelectField, ExportButton,
  C, fmt, formatDA, type Tokens,
} from "../_charts";
import {
  STATUS_DIST, SERVICE_TYPES, DELIVERY_MODES, PACKAGES_TREND, MONTHS,
  STOP_DESKS, type StopDeskRow, PERIOD_OPTIONS, SD_FILTER_OPTIONS,
  SERVICE_FILTER_OPTIONS,
} from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  LOCAL HARDCODED DATA — specific to the Colis report
 * ════════════════════════════════════════════════════════════════════════ */

/** Total parc colis — single anchor figure every breakdown reconciles to. */
const TOTAL_COLIS = 18432;

/** Répartition par tranche de poids (Σ = 18 432, cohérent avec le poids moyen). */
const WEIGHT_BANDS: { label: string; value: number; color: string }[] = [
  { label: "< 1 kg",    value: 6420, color: C.cyan },
  { label: "1 – 3 kg",  value: 7840, color: C.green },
  { label: "3 – 5 kg",  value: 2680, color: C.amber },
  { label: "5 – 10 kg", value: 1080, color: C.violet },
  { label: "> 10 kg",   value: 412,  color: C.red },
];

/** Volume par jour de semaine (Σ colis = 18 432, Σ livrés = 15 108, Σ retours = 894). */
interface WeekdayRow {
  day: string;
  colis: number;
  livres: number;
  taux: number;
  retours: number;
}
const WEEKDAY_VOLUME: WeekdayRow[] = [
  { day: "Lundi",    colis: 3120, livres: 2590, taux: 83, retours: 156 },
  { day: "Mardi",    colis: 3340, livres: 2806, taux: 84, retours: 162 },
  { day: "Mercredi", colis: 3210, livres: 2632, taux: 82, retours: 158 },
  { day: "Jeudi",    colis: 3060, livres: 2479, taux: 81, retours: 150 },
  { day: "Vendredi", colis: 1180, livres: 920,  taux: 78, retours: 72 },
  { day: "Samedi",   colis: 2640, livres: 2218, taux: 84, retours: 124 },
  { day: "Dimanche", colis: 1882, livres: 1463, taux: 78, retours: 72 },
];

/* Headline figures derived from the shared status distribution. */
const LIVRES = STATUS_DIST.find((s) => s.label === "Livré")?.value ?? 0;        // 15 108
const RETOURS = STATUS_DIST.find((s) => s.label === "Retour")?.value ?? 0;      // 894
const ECHECS = STATUS_DIST.find((s) => s.label === "Échec")?.value ?? 0;        // 290
/** En cours = tous les statuts hors livré / retour / échec. */
const EN_COURS = STATUS_DIST
  .filter((s) => !["Livré", "Retour", "Échec"].includes(s.label))
  .reduce((sum, s) => sum + s.value, 0);                                        // 2 140
const CREES_CE_MOIS = PACKAGES_TREND[PACKAGES_TREND.length - 1];               // 1 872
const ANNULES = 268;                                                            // demandes annulées avant prise en charge
const TAUX_LIVRAISON = ((LIVRES / TOTAL_COLIS) * 100).toFixed(1);              // 82.0
const POIDS_MOYEN = "2.3 kg";

export default function RapportColisPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("mois");

  const sdTotal = STOP_DESKS.reduce((sum, s) => sum + s.colis, 0);

  return (
    <PageShell t={t}>
      {/* DemoNotice — at the very top, per spec */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Boxes}
        title="Rapport des Colis"
        subtitle="Volumes, statuts, types de service et évolution du parc colis — réseau de livraison Algérie"
        action={
          <>
            <ExportButton t={t} icon={FileText} label="PDF" color={C.red} />
            <ExportButton t={t} icon={Sheet} label="Excel" color={C.green} />
          </>
        }
      />

      {/* ── Filter bar (visual only) ───────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <Segmented t={t} value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <div style={{ flex: 1 }} />
        <SelectField t={t} icon={Building2} options={SD_FILTER_OPTIONS} />
        <SelectField t={t} icon={Filter} options={SERVICE_FILTER_OPTIONS} />
      </div>

      {/* ════════════════════════════ KPIs ════════════════════════════════ */}
      <SectionTitle t={t} title="Indicateurs clés" icon={Package} sub="période en cours" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(178px, 1fr))", gap: 12, marginBottom: 26 }}>
        <KpiCard t={t} label="Total colis"        value={fmt(TOTAL_COLIS)}  icon={Package}      delta={12.4} goodWhenUp />
        <KpiCard t={t} label="Créés ce mois"      value={fmt(CREES_CE_MOIS)} icon={PackagePlus}  delta={8.1}  goodWhenUp />
        <KpiCard t={t} label="En cours"           value={fmt(EN_COURS)}      icon={Truck}        delta={-4.2} goodWhenUp={false} />
        <KpiCard t={t} label="Livrés"             value={fmt(LIVRES)}        icon={PackageCheck} delta={9.8}  goodWhenUp />
        <KpiCard t={t} label="Annulés"            value={fmt(ANNULES)}       icon={XCircle}      delta={0.8}  goodWhenUp={false} />
        <KpiCard t={t} label="Poids moyen"        value={POIDS_MOYEN}        icon={Scale}        delta={1.2}  goodWhenUp />
        <KpiCard t={t} label="Retours"            value={fmt(RETOURS)}       icon={RotateCcw}    delta={-2.1} goodWhenUp={false} />
        <KpiCard t={t} label="Taux de livraison"  value={`${TAUX_LIVRAISON} %`} icon={Percent}   delta={1.6}  goodWhenUp deltaSuffix=" pts" />
      </div>

      {/* ════════════════════ Répartition (donut + services) ═══════════════ */}
      <SectionTitle t={t} title="Répartition des colis" icon={PieChart} sub="statuts & types de service" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 26 }}>
        <ChartCard t={t} title="Colis par statut" icon={PieChart} sub={`${STATUS_DIST.length} statuts`}>
          <Donut t={t} data={STATUS_DIST} legend centerLabel="colis" centerValue={fmt(TOTAL_COLIS)} />
        </ChartCard>

        <ChartCard t={t} title="Colis par type de service" icon={Layers} sub="Livraison · Échange · Recouvrement · Ramassage">
          <HBars t={t} data={SERVICE_TYPES} unit=" colis" />
        </ChartCard>
      </div>

      {/* ════════════════════════ Évolution 12 mois ═══════════════════════ */}
      <SectionTitle t={t} title="Évolution des colis" icon={TrendingUp} sub="12 derniers mois" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Volume mensuel de colis créés" icon={TrendingUp} sub={`Σ ${fmt(PACKAGES_TREND.reduce((a, b) => a + b, 0))} colis`}>
          <AreaLine t={t} data={PACKAGES_TREND} labels={MONTHS} suffix=" colis" height={250} />
        </ChartCard>
      </div>

      {/* ════════════════════ Modes : domicile vs stop desk + poids ═══════ */}
      <SectionTitle t={t} title="Mode de livraison & poids" icon={Home} sub="domicile / stop-desk · tranches de poids" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 14 }}>
        <ChartCard t={t} title="Domicile vs Stop Desk" icon={Home}>
          <SplitBar t={t} data={DELIVERY_MODES} height={30} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <StatTile t={t} icon={Home} label="À domicile" accent={C.orange}
              value={fmt(DELIVERY_MODES[0].value)}
              hint={`${((DELIVERY_MODES[0].value / TOTAL_COLIS) * 100).toFixed(1)} % du volume`} />
            <StatTile t={t} icon={Building2} label="Stop Desk" accent={C.indigo}
              value={fmt(DELIVERY_MODES[1].value)}
              hint={`${((DELIVERY_MODES[1].value / TOTAL_COLIS) * 100).toFixed(1)} % du volume`} />
          </div>
        </ChartCard>

        <ChartCard t={t} title="Colis par tranche de poids" icon={Scale} sub={`poids moyen ${POIDS_MOYEN}`}>
          <HBars t={t} data={WEIGHT_BANDS} unit=" colis" />
        </ChartCard>
      </div>

      {/* ════════════════════════ Tables détaillées ═══════════════════════ */}
      <SectionTitle t={t} title="Détails par dimension" icon={CalendarDays} sub="jour de semaine · Stop Desk" />

      <div style={{ marginBottom: 14 }}>
        <ChartCard t={t} title="Volume par jour de semaine" icon={CalendarDays} sub="cumul sur la période" noPadding>
          <DataTable<WeekdayRow>
            t={t}
            rows={WEEKDAY_VOLUME}
            rowKey={(r) => r.day}
            columns={[
              { header: "Jour", render: (r) => <span style={{ fontWeight: 700, color: t.text }}>{r.day}</span> },
              { header: "Colis", align: "right", render: (r) => fmt(r.colis) },
              { header: "% du volume", align: "right", render: (r) => `${((r.colis / TOTAL_COLIS) * 100).toFixed(1)} %` },
              { header: "Livrés", align: "right", render: (r) => fmt(r.livres) },
              { header: "Taux de livraison", render: (r) => <ProgressCell t={t} value={r.taux} /> },
              { header: "Retours", align: "right", render: (r) => <Pill color={C.amber}>{fmt(r.retours)}</Pill> },
            ]}
          />
          <TableFooter t={t} cells={[
            { label: "Total", flex: 2 },
            { value: fmt(TOTAL_COLIS), align: "right" },
            { value: "100 %", align: "right" },
            { value: fmt(LIVRES), align: "right" },
            { value: `${TAUX_LIVRAISON} %`, align: "left" },
            { value: fmt(RETOURS), align: "right" },
          ]} />
        </ChartCard>
      </div>

      <div style={{ marginBottom: 8 }}>
        <ChartCard t={t} title="Volume par Stop Desk" icon={MapPin} sub={`${STOP_DESKS.length} centres`} noPadding>
          <DataTable<StopDeskRow>
            t={t}
            rows={STOP_DESKS}
            rowKey={(s) => s.name}
            columns={[
              { header: "Stop Desk", render: (s) => <span style={{ fontWeight: 700, color: t.text }}>{s.name}</span> },
              { header: "Wilaya", render: (s) => s.wilaya },
              { header: "Colis", align: "right", render: (s) => fmt(s.colis) },
              { header: "Part", align: "right", render: (s) => `${((s.colis / sdTotal) * 100).toFixed(1)} %` },
              { header: "Taux de livraison", render: (s) => <ProgressCell t={t} value={s.taux} /> },
              { header: "Délai moyen", align: "right", render: (s) => `${s.delai.toFixed(1)} j` },
              { header: "CA", align: "right", render: (s) => formatDA(s.ca) },
            ]}
          />
          <TableFooter t={t} cells={[
            { label: "Total réseau", flex: 2 },
            { value: fmt(sdTotal), align: "right" },
            { value: "100 %", align: "right" },
            { value: "", align: "left" },
            { value: "", align: "right" },
            { value: formatDA(STOP_DESKS.reduce((a, s) => a + s.ca, 0)), align: "right" },
          ]} />
        </ChartCard>
      </div>
    </PageShell>
  );
}

/* ── Small local footer row for the data tables (totals strip) ─────────────── */
function TableFooter({
  t,
  cells,
}: {
  t: Tokens;
  cells: { label?: string; value?: string; flex?: number; align?: "left" | "right" | "center" }[];
}) {
  return (
    <div style={{ display: "flex", padding: "10px 12px", borderTop: `2px solid ${t.border}`, background: t.rowHover }}>
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            flex: c.flex ?? 1,
            textAlign: c.align ?? "left",
            fontSize: 11.5,
            fontWeight: 800,
            color: c.label ? t.textMuted : t.text,
            textTransform: c.label ? "uppercase" : undefined,
            letterSpacing: c.label ? "0.04em" : undefined,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {c.label ?? c.value}
        </div>
      ))}
    </div>
  );
}
