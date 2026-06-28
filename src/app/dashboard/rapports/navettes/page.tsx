"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT DES NAVETTES  (line-hauls inter Stop-Desks)
 *
 *  ⚠️  HARDCODED showcase. No API calls — every figure is illustrative and kept
 *  internally consistent. Chart/layout primitives are NOT recreated here: they
 *  are imported from `../_charts` (tokens from `../../_ui`).
 *
 *  Shared anchor (from `../_data` → NAVETTES, 7 lignes principales) :
 *    • route / départ / arrivée / ponctualité / retards / colis / sacs
 *  Report-specific monthly aggregates are declared locally below and reconcile :
 *      Σ trajets  = 248        (= dernier point de NAVETTES_TREND)
 *      Σ colis    = 55 800      (= KPI « Volume transporté », Σ HBars volume)
 *      Σ sacs     = 5 940       (= KPI « Sacs acheminés »)
 *      Σ distance = 73 018 km   (= KPI « Distance parcourue »)
 *      Ponctualité réseau = 90.9 %  (pondérée par trajets → Gauge + KPI + footer)
 *      Navettes effectuées 242 = 220 à l'heure + 22 en retard ; 6 annulées (= 248)
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Bus, Truck, Navigation, Timer, Clock, Boxes, Package, Container,
  MapPin, Target, PieChart, Activity, TrendingUp, AlertTriangle, Route,
  ArrowRight, CheckCircle2, FileText, Sheet,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, MiniStat, Gauge, Donut, HBars, VBars, AreaLine, SplitBar,
  DataTable, ProgressCell, Pill, Badge, Segmented, SelectField, ExportButton,
  C, fmt, rainbow, type Segment, type Tokens,
} from "../_charts";
import { NAVETTES, MONTHS, PERIOD_OPTIONS } from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  REPORT-SPECIFIC HARDCODED DATA
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Monthly aggregates per ligne — merged onto the shared NAVETTES rows so
 * route / ponctualité / retards stay consistent with `../_data`.
 *   distanceKm  → distance routière (aller simple)
 *   trajets     → nb de navettes ce mois        (Σ = 248)
 *   colisMois   → colis acheminés ce mois       (Σ = 55 800)
 *   sacsMois    → sacs acheminés ce mois        (Σ = 5 940)
 *   remplissage → taux de remplissage moyen %
 *   retardMoyen → retard moyen (min) sur la ligne
 */
const LINE_EXTRA: Record<string, {
  distanceKm: number; trajets: number; colisMois: number;
  sacsMois: number; remplissage: number; retardMoyen: number;
}> = {
  "Alger → Oran":        { distanceKm: 432, trajets: 44, colisMois: 11800, sacsMois: 1240, remplissage: 91, retardMoyen: 12 },
  "Alger → Constantine": { distanceKm: 431, trajets: 40, colisMois: 9600,  sacsMois: 1020, remplissage: 84, retardMoyen: 22 },
  "Alger → Sétif":       { distanceKm: 301, trajets: 38, colisMois: 7400,  sacsMois: 790,  remplissage: 88, retardMoyen: 8  },
  "Oran → Tlemcen":      { distanceKm: 173, trajets: 30, colisMois: 4800,  sacsMois: 510,  remplissage: 74, retardMoyen: 16 },
  "Alger → Annaba":      { distanceKm: 599, trajets: 26, colisMois: 5200,  sacsMois: 560,  remplissage: 79, retardMoyen: 28 },
  "Alger → Blida":       { distanceKm: 47,  trajets: 52, colisMois: 14200, sacsMois: 1520, remplissage: 95, retardMoyen: 5  },
  "Constantine → Batna": { distanceKm: 118, trajets: 18, colisMois: 2800,  sacsMois: 300,  remplissage: 68, retardMoyen: 24 },
};

const LINES = NAVETTES.map((n) => {
  const [org, dst] = n.route.split(" → ");
  return {
    route: n.route, org, dst,
    ponctualite: n.ponctualite, retards: n.retards,
    ...LINE_EXTRA[n.route],
  };
});
type LineRow = (typeof LINES)[number];

/* ── Derived totals (single source of truth for KPIs + footers) ───────────── */
const round1 = (n: number) => +n.toFixed(1);
const totalTrajets   = LINES.reduce((a, l) => a + l.trajets, 0);                 // 248
const totalColisMois = LINES.reduce((a, l) => a + l.colisMois, 0);               // 55 800
const totalSacsMois  = LINES.reduce((a, l) => a + l.sacsMois, 0);                // 5 940
const totalRetards   = LINES.reduce((a, l) => a + l.retards, 0);                 // 37
const totalDistance  = LINES.reduce((a, l) => a + l.trajets * l.distanceKm, 0);  // 73 018
const PONCT = round1(LINES.reduce((a, l) => a + l.ponctualite * l.trajets, 0) / totalTrajets); // 90.9
const REMPL = round1(LINES.reduce((a, l) => a + l.remplissage * l.trajets, 0) / totalTrajets); // 85.3
const RETARD_MOYEN = Math.round(LINES.reduce((a, l) => a + l.retardMoyen * l.trajets, 0) / totalTrajets); // 15

/* ── Ponctualité snapshot (ce mois) ───────────────────────────────────────── */
const TOTAL_NAVETTES = totalTrajets;                              // 248
const ANNULEES   = 6;
const EFFECTUEES = TOTAL_NAVETTES - ANNULEES;                     // 242
const ON_TIME    = Math.round((PONCT / 100) * EFFECTUEES);        // 220
const LATE       = EFFECTUEES - ON_TIME;                          // 22
const EN_TRANSIT = 6;                                             // navettes en route maintenant
const RETARD_MAX = 38;                                            // min (Alger → Constantine)

/** Distribution des navettes effectuées par tranche de retard (Σ = 242). */
const RETARD_BUCKETS = [ON_TIME, 11, 7, 3, 1];
const RETARD_LABELS  = ["À l'heure", "6–15 min", "16–30 min", "31–60 min", "> 60 min"];

/** Ponctualité globale (à l'heure / en retard / annulée — Σ = 248). */
const PONCT_SPLIT: Segment[] = [
  { label: "À l'heure", value: ON_TIME,   color: C.green },
  { label: "En retard", value: LATE,      color: C.amber },
  { label: "Annulée",   value: ANNULEES,  color: C.red   },
];

/** Statut des navettes du jour (snapshot temps réel — Σ = 38). */
const NAV_STATUT_TODAY: Segment[] = [
  { label: "Arrivée",    value: 22, color: C.green },
  { label: "En transit", value: EN_TRANSIT, color: C.blue },
  { label: "Programmée", value: 7,  color: C.slate },
  { label: "Retardée",   value: 2,  color: C.amber },
  { label: "Annulée",    value: 1,  color: C.red   },
];

/** Navettes par mois (12 derniers mois ; dernier point = 248 = ce mois). */
const NAVETTES_TREND = [186, 198, 207, 214, 226, 238, 251, 198, 232, 248, 261, 248];

/** Volume acheminé par ligne (ce mois) — HBars (Σ = 55 800). */
const fillColor = (v: number) => (v >= 90 ? C.green : v >= 80 ? C.blue : v >= 72 ? C.amber : C.red);
const VOLUME_PAR_LIGNE: Segment[] = LINES.map((l, i) => ({ label: l.route, value: l.colisMois, color: rainbow(i) }));
const REMPL_PAR_LIGNE: Segment[]  = LINES.map((l) => ({ label: l.route, value: l.remplissage, color: fillColor(l.remplissage) }));

/* ── Navettes en cours (aujourd'hui) — NAVETTES enrichies (snapshot live) ──── */
const LIVE_EXTRA: Record<string, {
  arriveeReel: string; retardMin: number; statut: string;
  vehicule: string; chauffeur: string;
}> = {
  "Alger → Oran":        { arriveeReel: "13:34", retardMin: 14, statut: "Arrivée",    vehicule: "Camion 12T · 16-2841-119",  chauffeur: "Karim Benali" },
  "Alger → Constantine": { arriveeReel: "12:48", retardMin: 38, statut: "Arrivée",    vehicule: "Camion 10T · 16-3127-119",  chauffeur: "Riad Boudjema" },
  "Alger → Sétif":       { arriveeReel: "10:46", retardMin: 6,  statut: "Arrivée",    vehicule: "Fourgon 5T · 19-4410-119",  chauffeur: "Walid Brahimi" },
  "Oran → Tlemcen":      { arriveeReel: "—",     retardMin: 11, statut: "En transit", vehicule: "Fourgon 5T · 31-2208-122",  chauffeur: "Sofiane Meziane" },
  "Alger → Annaba":      { arriveeReel: "—",     retardMin: 0,  statut: "En transit", vehicule: "Camion 10T · 16-2990-119",  chauffeur: "Mohamed Chérif" },
  "Alger → Blida":       { arriveeReel: "08:52", retardMin: 0,  statut: "Arrivée",    vehicule: "Fourgon 3.5T · 09-1180-122", chauffeur: "Nabil Saïdi" },
  "Constantine → Batna": { arriveeReel: "—",     retardMin: 34, statut: "Retardée",   vehicule: "Fourgon 5T · 25-3361-121",  chauffeur: "Yacine Haddad" },
};

const TRIPS = NAVETTES.map((n) => {
  const [org, dst] = n.route.split(" → ");
  return { ...n, org, dst, ...LIVE_EXTRA[n.route] };
});
type TripRow = (typeof TRIPS)[number];
const tripsColis = TRIPS.reduce((a, t) => a + t.colis, 0);  // 5 440
const tripsSacs  = TRIPS.reduce((a, t) => a + t.sacs, 0);   // 171

/* ── Visual-only filter options ───────────────────────────────────────────── */
const LINE_FILTER_OPTIONS = ["Toutes les lignes", ...NAVETTES.map((n) => n.route)];
const VEHICLE_FILTER_OPTIONS = ["Tous les véhicules", "Camion 12T", "Camion 10T", "Fourgon 5T", "Fourgon 3.5T"];

/* ── Statut → couleur (badges) ────────────────────────────────────────────── */
const STATUT_COLOR: Record<string, string> = {
  "Arrivée": C.green, "En transit": C.blue, "Programmée": C.slate,
  "Retardée": C.amber, "Annulée": C.red,
};
function StatutBadge({ statut }: { statut: string }) {
  const c = STATUT_COLOR[statut] ?? C.slate;
  return <Badge color={c} bg={`${c}1a`}>{statut}</Badge>;
}
function RetardCell({ min }: { min: number }) {
  if (min <= 0) return <span style={{ color: C.green, fontWeight: 700 }}>à l&apos;heure</span>;
  const c = min >= 30 ? C.red : C.amber;
  return <span style={{ color: c, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>+{min} min</span>;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export default function NavettesReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("mois");

  const ligne = (org: string, dst: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: t.text }}>
      {org}<ArrowRight size={13} color={t.textFaint} />{dst}
    </span>
  );

  return (
    <PageShell t={t} maxWidth={1320}>
      {/* DEMO BANNER — at the very top, per spec */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Bus}
        title="Rapport des Navettes"
        subtitle="Liaisons inter Stop-Desks : ponctualité, retards, volume transporté et performance par ligne — réseau Algérie"
        action={
          <>
            <ExportButton t={t} icon={FileText} label="PDF" color={C.red} />
            <ExportButton t={t} icon={Sheet} label="Excel" color={C.green} />
          </>
        }
      />

      {/* ── Filter bar (visual only) ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <Segmented t={t} value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SelectField t={t} icon={Route} options={LINE_FILTER_OPTIONS} />
          <SelectField t={t} icon={Truck} options={VEHICLE_FILTER_OPTIONS} />
        </div>
      </div>

      {/* ── 1. KPIs ──────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs clés des navettes" icon={Activity} sub="ce mois vs mois précédent" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(184px, 1fr))", gap: 12, marginBottom: 26 }}>
        <KpiCard t={t} label="Navettes (ce mois)"   value={fmt(TOTAL_NAVETTES)}     icon={Truck}      delta={6.0}  goodWhenUp />
        <KpiCard t={t} label="En transit"           value={fmt(EN_TRANSIT)}         icon={Navigation} delta={2}    goodWhenUp deltaSuffix="" />
        <KpiCard t={t} label="Ponctualité"          value={`${PONCT} %`}            icon={Timer}      delta={2.1}  goodWhenUp deltaSuffix=" pts" />
        <KpiCard t={t} label="Retard moyen"         value={`${RETARD_MOYEN} min`}   icon={Clock}      delta={-3}   goodWhenUp={false} deltaSuffix=" min" />
        <KpiCard t={t} label="Volume transporté"    value={`${fmt(totalColisMois)} colis`} icon={Boxes} delta={9.1} goodWhenUp />
        <KpiCard t={t} label="Sacs acheminés"       value={fmt(totalSacsMois)}      icon={Package}    delta={7.2}  goodWhenUp />
        <KpiCard t={t} label="Taux de remplissage"  value={`${REMPL} %`}            icon={Container}  delta={2.4}  goodWhenUp deltaSuffix=" pts" />
        <KpiCard t={t} label="Distance parcourue"   value={`${fmt(totalDistance)} km`} icon={MapPin}  delta={4.8}  goodWhenUp />
      </div>

      {/* ── 2. Ponctualité & statut ──────────────────────────────────────── */}
      <SectionTitle t={t} title="Ponctualité & statut" icon={Target} sub={`${EFFECTUEES} navettes effectuées · ${ANNULEES} annulées`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 26 }}>
        <ChartCard t={t} title="Ponctualité des navettes" icon={Timer} sub="à l'heure / en retard / annulée">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Gauge t={t} value={ON_TIME} total={EFFECTUEES} color={C.green} display={`${PONCT} %`} label={`${fmt(ON_TIME)} / ${fmt(EFFECTUEES)} à l'heure`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, width: "100%", paddingTop: 6, borderTop: `1px solid ${t.divider}` }}>
              <MiniStat t={t} label="À l'heure"    value={fmt(ON_TIME)}        color={C.green} />
              <MiniStat t={t} label="En retard"    value={fmt(LATE)}           color={C.amber} />
              <MiniStat t={t} label="Retard moy."  value={`${RETARD_MOYEN} min`} color={t.text} />
              <MiniStat t={t} label="Retard max"   value={`${RETARD_MAX} min`}   color={C.red} />
            </div>
            <div style={{ width: "100%", paddingTop: 14, borderTop: `1px solid ${t.divider}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: t.textMuted, marginBottom: 9 }}>Répartition globale</div>
              <SplitBar t={t} data={PONCT_SPLIT} />
            </div>
          </div>
        </ChartCard>

        <ChartCard t={t} title="Statut des navettes" icon={PieChart} sub="snapshot du jour · 38 navettes">
          <Donut t={t} data={NAV_STATUT_TODAY} legend centerValue={fmt(38)} centerLabel="aujourd'hui" />
        </ChartCard>
      </div>

      {/* ── 3. Volume & remplissage par ligne ────────────────────────────── */}
      <SectionTitle t={t} title="Volume & remplissage par ligne" icon={Boxes} sub="cumul du mois · 7 lignes principales" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 26 }}>
        <ChartCard t={t} title="Volume par ligne" icon={Boxes} sub={`Σ ${fmt(totalColisMois)} colis`}>
          <HBars t={t} data={VOLUME_PAR_LIGNE} unit=" colis" />
        </ChartCard>

        <ChartCard t={t} title="Taux de remplissage par ligne" icon={Container} sub={`moyenne réseau ${REMPL} %`}>
          <HBars t={t} data={REMPL_PAR_LIGNE} unit=" %" />
        </ChartCard>
      </div>

      {/* ── 4. Évolution mensuelle ───────────────────────────────────────── */}
      <SectionTitle t={t} title="Évolution des navettes" icon={TrendingUp} sub="12 derniers mois" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Navettes par mois" icon={Bus} sub={`Σ ${fmt(NAVETTES_TREND.reduce((a, b) => a + b, 0))} navettes`}>
          <AreaLine t={t} data={NAVETTES_TREND} labels={MONTHS} color={C.violet} suffix=" navettes" height={250} />
        </ChartCard>
      </div>

      {/* ── 5. Distribution des retards ──────────────────────────────────── */}
      <SectionTitle t={t} title="Distribution des retards" icon={AlertTriangle} sub={`${EFFECTUEES} navettes effectuées`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Navettes par tranche de retard" icon={Clock} sub={`ponctualité ${PONCT} % · retard moyen ${RETARD_MOYEN} min`}>
          <VBars t={t} data={RETARD_BUCKETS} labels={RETARD_LABELS} color={C.amber} format={(v) => fmt(v)} height={210} />
        </ChartCard>
      </div>

      {/* ── 6. Navettes en cours (DataTable trajets) ─────────────────────── */}
      <SectionTitle t={t} title="Navettes en cours" icon={Navigation} sub={`aujourd'hui · ${TRIPS.length} liaisons inter-hubs`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} noPadding>
          <DataTable<TripRow>
            t={t}
            rows={TRIPS}
            rowKey={(r) => r.route}
            columns={[
              { header: "Trajet", render: (r) => ligne(r.org, r.dst) },
              { header: "Départ",        align: "center", render: (r) => r.depart },
              { header: "Arr. prévue",   align: "center", render: (r) => r.arrivee },
              { header: "Arr. réelle",   align: "center", render: (r) => <span style={{ fontWeight: 700, color: t.text }}>{r.arriveeReel}</span> },
              { header: "Retard",        align: "center", render: (r) => <RetardCell min={r.retardMin} /> },
              { header: "Statut",        align: "center", render: (r) => <StatutBadge statut={r.statut} /> },
              { header: "Volume", align: "right", render: (r) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700, color: t.text }}>{fmt(r.colis)} colis</span>
                  <span style={{ fontSize: 11, color: t.textFaint }}>{r.sacs} sacs</span>
                </div>
              ) },
              { header: "Véhicule / chauffeur", render: (r) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 600, color: t.textSub }}>{r.chauffeur}</span>
                  <span style={{ fontSize: 11, color: t.textFaint }}>{r.vehicule}</span>
                </div>
              ) },
            ]}
          />
          <TableFooter t={t} cells={[
            { label: `Total · ${TRIPS.length} navettes`, flex: 6 },
            { value: `${fmt(tripsColis)} colis`, align: "right" },
            { value: `${fmt(tripsSacs)} sacs`, align: "left" },
          ]} />
        </ChartCard>
      </div>

      {/* ── 7. Performance par ligne (DataTable + footer totals) ─────────── */}
      <SectionTitle t={t} title="Performance par ligne" icon={Route} sub={`cumul du mois · ${LINES.length} lignes`} />
      <ChartCard t={t} noPadding>
        <DataTable<LineRow>
          t={t}
          rows={LINES}
          rowKey={(l) => l.route}
          columns={[
            { header: "Ligne", render: (l) => ligne(l.org, l.dst) },
            { header: "Distance",   align: "right",  render: (l) => `${fmt(l.distanceKm)} km` },
            { header: "Trajets",    align: "right",  render: (l) => fmt(l.trajets) },
            { header: "Volume",     align: "right",  render: (l) => `${fmt(l.colisMois)} colis` },
            { header: "Sacs",       align: "right",  render: (l) => fmt(l.sacsMois) },
            { header: "Remplissage", align: "left", width: 150, render: (l) => <ProgressCell t={t} value={l.remplissage} /> },
            { header: "Ponctualité", align: "left", width: 150, render: (l) => <ProgressCell t={t} value={l.ponctualite} /> },
            { header: "Retards",    align: "center", render: (l) => <Pill color={C.amber}>{l.retards}</Pill> },
            { header: "Retard moy.", align: "right", render: (l) => `${l.retardMoyen} min` },
          ]}
        />
        <TableFooter t={t} cells={[
          { label: "Total réseau", flex: 1 },
          { value: `${fmt(totalDistance)} km`, align: "right" },
          { value: fmt(totalTrajets), align: "right" },
          { value: `${fmt(totalColisMois)} colis`, align: "right" },
          { value: fmt(totalSacsMois), align: "right" },
          { value: `${REMPL} %`, align: "left" },
          { value: `${PONCT} %`, align: "left" },
          { value: fmt(totalRetards), align: "center" },
          { value: `${RETARD_MOYEN} min`, align: "right" },
        ]} />
      </ChartCard>

      {/* Footnote */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, fontSize: 11.5, color: t.textFaint }}>
        <CheckCircle2 size={13} color={C.green} />
        Données illustratives — réconciliées autour de {fmt(TOTAL_NAVETTES)} navettes / {fmt(totalColisMois)} colis acheminés ce mois.
      </div>
    </PageShell>
  );
}

/* ── Local totals strip for the data tables (mirrors the Colis report) ─────── */
function TableFooter({
  t, cells,
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
