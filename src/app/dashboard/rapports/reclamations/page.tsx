"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT DES RÉCLAMATIONS
 *
 *  HARDCODED showcase page. Every figure is illustrative (Algerian delivery
 *  network) and internally consistent. No API calls. All charts/tables are drawn
 *  with the shared primitives in `./_charts` — nothing here re-implements a chart.
 *
 *  Internal-consistency anchors (current period):
 *    • Total réclamations ...... 312   (= Σ STATUS_DIST = Σ TYPE_DIST = Σ PRIORITY_DIST = Σ SD_RECLAMATIONS.total)
 *    • Résolues (resolved+closed) 262  (= Σ SD_RECLAMATIONS.resolved)
 *    • Ouvertes (open+in_progress)  50 (= 312 − 262)
 *    • Taux de résolution ...... 84.0 % (262 / 312)
 *    • Temps moyen de résolution  1.8 j (SLA_SUMMARY.avgResolution)
 *    • Résolues dans les délais   91.4 % (SLA_SUMMARY.resolvedInTime)
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  MessageSquareWarning, Inbox, CheckCircle2, Percent, Timer, Smile,
  AlertTriangle, Building2, ListChecks, Clock, ShieldCheck,
  Hourglass, Flame, Tag, Activity, TrendingUp, MessageSquare,
  FileText, FileSpreadsheet, MapPin, ListFilter, CalendarDays,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, Gauge, Donut, HBars, AreaLine, SplitBar,
  DataTable, ProgressCell, Pill, Badge, ExportButton, Segmented, SelectField,
  C, fmt, type Segment,
} from "../_charts";
import {
  RECLAM_TREND, MONTHS, SLA_SUMMARY,
  SD_FILTER_OPTIONS, WILAYA_FILTER_OPTIONS, PERIOD_OPTIONS,
} from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  LOCAL HARDCODED DATA  (specific to the réclamations report)
 * ════════════════════════════════════════════════════════════════════════ */

/** Anchor totals — keep every section reconciled to these. */
const TOTAL = 312;                          // total réclamations (période)
const RESOLUES = 262;                       // resolved + closed
const OUVERTES = TOTAL - RESOLUES;          // 50 = open + in_progress
const TAUX_RESOLUTION = Number(((RESOLUES / TOTAL) * 100).toFixed(1)); // 84.0 %
const TAUX_CIBLE = 90;                      // SLA target (%)

/** Status distribution — open / in_progress / resolved / closed (Σ = 312). */
const STATUS_DIST: Segment[] = [
  { label: "Ouverte",   value: 34,  color: C.amber },  // open
  { label: "En cours",  value: 16,  color: C.blue },   // in_progress
  { label: "Résolue",   value: 198, color: C.green },  // resolved
  { label: "Clôturée",  value: 64,  color: C.teal },   // closed
];

/** Type distribution — colis / paiement / ramassage / général / autre (Σ = 312). */
const TYPE_DIST: Segment[] = [
  { label: "Problème colis",   value: 132, color: C.red },
  { label: "Litige paiement",  value: 78,  color: C.violet },
  { label: "Ramassage",        value: 46,  color: C.amber },
  { label: "Général / service", value: 38, color: C.blue },
  { label: "Autre",            value: 18,  color: C.slate },
];

/** Priority distribution (Σ = 312). */
const PRIORITY_DIST: Segment[] = [
  { label: "Faible",  value: 96,  color: C.slate },
  { label: "Moyenne", value: 128, color: C.blue },
  { label: "Haute",   value: 64,  color: C.amber },
  { label: "Urgente", value: 24,  color: C.red },
];

/** Réclamations per Stop Desk — total Σ = 312, resolved Σ = 262. */
interface SdReclam { sd: string; wilaya: string; total: number; resolved: number; delai: number; }
const SD_RECLAMATIONS: SdReclam[] = [
  { sd: "Hub Alger",      wilaya: "Alger",       total: 78, resolved: 66, delai: 1.6 },
  { sd: "SD Oran Centre", wilaya: "Oran",        total: 52, resolved: 44, delai: 1.9 },
  { sd: "SD Constantine", wilaya: "Constantine", total: 46, resolved: 36, delai: 2.4 },
  { sd: "SD Bab El Oued", wilaya: "Alger",       total: 34, resolved: 29, delai: 1.7 },
  { sd: "SD Blida",       wilaya: "Blida",       total: 28, resolved: 25, delai: 1.5 },
  { sd: "SD El Hadjeb",   wilaya: "Biskra",      total: 22, resolved: 18, delai: 2.0 },
  { sd: "SD Annaba",      wilaya: "Annaba",      total: 20, resolved: 15, delai: 2.6 },
  { sd: "SD Sétif",       wilaya: "Sétif",       total: 14, resolved: 12, delai: 1.7 },
  { sd: "SD Béjaïa",      wilaya: "Béjaïa",      total: 10, resolved: 9,  delai: 1.8 },
  { sd: "SD Batna",       wilaya: "Batna",       total: 8,  resolved: 8,  delai: 1.4 },
];

/** Per-type detail rows: count, mean resolution time, resolution rate. */
interface TypeDetail { label: string; color: string; value: number; delai: number; taux: number; }
const TYPE_DETAIL: TypeDetail[] = [
  { label: "Problème colis",    color: C.red,    value: 132, delai: 2.1, taux: 81.1 },
  { label: "Litige paiement",   color: C.violet, value: 78,  delai: 2.6, taux: 79.5 },
  { label: "Ramassage",         color: C.amber,  value: 46,  delai: 1.4, taux: 89.1 },
  { label: "Général / service", color: C.blue,   value: 38,  delai: 1.1, taux: 92.1 },
  { label: "Autre",             color: C.slate,  value: 18,  delai: 1.6, taux: 88.9 },
];

/** Status / priority colour + label helpers (badge / pill rendering). */
const STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: "Ouverte",  color: C.amber },
  in_progress: { label: "En cours", color: C.blue },
  resolved:    { label: "Résolue",  color: C.green },
  closed:      { label: "Clôturée", color: C.teal },
};
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:    { label: "Faible",  color: C.slate },
  medium: { label: "Moyenne", color: C.blue },
  high:   { label: "Haute",   color: C.amber },
  urgent: { label: "Urgente", color: C.red },
};

/** Most recent individual réclamations (audit-style feed). */
interface ReclamRow {
  ref: string; type: string; sd: string; expediteur: string;
  priority: keyof typeof PRIORITY_META; status: keyof typeof STATUS_META; age: string;
}
const RECENT_RECLAMATIONS: ReclamRow[] = [
  { ref: "RC-1187", type: "Litige paiement (COD)",   sd: "SD Constantine", expediteur: "Mode Dz",               priority: "high",   status: "resolved",    age: "1 j" },
  { ref: "RC-1186", type: "Colis endommagé",         sd: "Hub Alger",      expediteur: "Tech Store DZ",         priority: "medium", status: "in_progress", age: "2 j" },
  { ref: "RC-1185", type: "Retard de livraison",     sd: "SD Oran Centre", expediteur: "Cosmétique Plus",       priority: "low",    status: "resolved",    age: "3 j" },
  { ref: "RC-1182", type: "Colis perdu",             sd: "SD Annaba",      expediteur: "Sport Zone",            priority: "urgent", status: "open",        age: "5 j" },
  { ref: "RC-1180", type: "Erreur d'adresse",        sd: "SD Bab El Oued", expediteur: "Maison & Déco",         priority: "low",    status: "closed",      age: "4 j" },
  { ref: "RC-1176", type: "Litige paiement (COD)",   sd: "SD Constantine", expediteur: "Mode Dz",               priority: "high",   status: "open",        age: "12 j" },
  { ref: "RC-1174", type: "Ramassage manqué",        sd: "SD Blida",       expediteur: "Boutique Electronique", priority: "medium", status: "resolved",    age: "6 j" },
  { ref: "RC-1170", type: "Réclamation générale",    sd: "Hub Alger",      expediteur: "Parfum Élégance",       priority: "low",    status: "closed",      age: "7 j" },
];

const TYPE_FILTER_OPTIONS = ["Tous les types", ...TYPE_DIST.map((t) => t.label)];
const STATUS_FILTER_OPTIONS = ["Tous les statuts", "Ouverte", "En cours", "Résolue", "Clôturée"];

export default function RapportReclamationsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("mois");

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
        icon={MessageSquareWarning}
        title="Rapport des Réclamations"
        subtitle="Volume, statuts, types, respect des délais (SLA) et répartition par Stop Desk — réseau de livraison (données illustratives)"
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
        <SelectField t={t} icon={Tag} options={TYPE_FILTER_OPTIONS} />
        <SelectField t={t} icon={ListFilter} options={STATUS_FILTER_OPTIONS} />
      </div>

      {/* ═══ KPIs ═══ */}
      <SectionTitle t={t} title="Indicateurs clés des réclamations" icon={MessageSquareWarning} sub="période en cours" />
      <div style={gridStyle(200)}>
        <KpiCard t={t} label="Total réclamations"           value={fmt(TOTAL)}                 icon={MessageSquare} delta={-6.8}  goodWhenUp={false} />
        <KpiCard t={t} label="Ouvertes"                     value={fmt(OUVERTES)}              icon={Inbox}         delta={-12.5} goodWhenUp={false} />
        <KpiCard t={t} label="Résolues"                     value={fmt(RESOLUES)}              icon={CheckCircle2}  delta={4.2}   goodWhenUp={true} />
        <KpiCard t={t} label="Taux de résolution"           value={`${TAUX_RESOLUTION.toFixed(1)} %`} icon={Percent} delta={2.8}  goodWhenUp={true}  deltaSuffix=" pts" />
        <KpiCard t={t} label="Temps moyen de résolution"    value={SLA_SUMMARY.avgResolution}  icon={Timer}         delta={-0.4}  goodWhenUp={false} deltaSuffix=" j" />
        <KpiCard t={t} label="Satisfaction client"          value={SLA_SUMMARY.satisfaction}   icon={Smile}         delta={1.3}   goodWhenUp={true}  deltaSuffix=" pts" />
      </div>

      {/* ═══ STATUT & TAUX DE RÉSOLUTION ═══ */}
      <SectionTitle t={t} title="Statut & taux de résolution" icon={ListChecks} />
      <div style={gridStyle(360)}>
        <ChartCard t={t} title="Réclamations par statut" sub={`${fmt(TOTAL)} réclamations`}>
          <Donut t={t} data={STATUS_DIST} legend centerValue={fmt(TOTAL)} centerLabel="réclamations" />
        </ChartCard>

        <ChartCard t={t} title="Taux de résolution" sub={`cible ≥ ${TAUX_CIBLE} %`}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Gauge
              t={t}
              value={RESOLUES}
              total={TOTAL}
              color={C.green}
              label={`${fmt(RESOLUES)} / ${fmt(TOTAL)} traitées`}
            />
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "center", paddingTop: 4 }}>
              <MiniStat t={t} label="Cible SLA"     value={`≥ ${TAUX_CIBLE} %`} />
              <MiniStat t={t} label="Période préc." value="81.2 %" color={C.amber} />
              <MiniStat t={t} label="Meilleur SD"   value="Batna 100 %" color={C.green} />
              <MiniStat t={t} label="Pire SD"       value="Annaba 75 %" color={C.red} />
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ═══ TYPE & PRIORITÉ ═══ */}
      <SectionTitle t={t} title="Réclamations par type & priorité" icon={Tag} />
      <div style={gridStyle(360)}>
        <ChartCard t={t} title="Réclamations par type" sub={`${fmt(TOTAL)} réclamations`}>
          <HBars t={t} data={TYPE_DIST} unit=" récl." />
        </ChartCard>

        <ChartCard t={t} title="Répartition par priorité" sub={`${fmt(TOTAL)} réclamations`}>
          <SplitBar t={t} data={PRIORITY_DIST} />
          <div style={{ marginTop: 16, fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: C.red }}>{fmt(PRIORITY_DIST[3].value)}</strong> réclamations
            <strong style={{ color: t.text }}> urgentes</strong> en file prioritaire, traitées en
            <strong style={{ color: t.text }}> moins de 24 h</strong> en moyenne. Les
            réclamations <strong style={{ color: t.text }}>{fmt(PRIORITY_DIST[2].value)}</strong> de
            priorité haute concernent surtout les litiges COD et les colis perdus.
          </div>
        </ChartCard>
      </div>

      {/* ═══ SLA — RESPECT DES DÉLAIS ═══ */}
      <SectionTitle t={t} title="Respect des délais (SLA)" icon={ShieldCheck} />
      <div style={gridStyle(280)}>
        <StatTile t={t} icon={Clock}     label="Temps de résolution moyen" value={SLA_SUMMARY.avgResolution}  hint="de l'ouverture à la clôture" accent={C.blue} />
        <StatTile t={t} icon={ShieldCheck} label="Résolues dans les délais" value={SLA_SUMMARY.resolvedInTime} hint="traitées sous 48 h (cible ≥ 90 %)" accent={C.green} />
        <StatTile t={t} icon={Hourglass} label="Plus ancienne ouverte"     value="12 j"                       hint="RC-1176 · Litige COD · SD Constantine" accent={C.red} />
      </div>

      {/* ═══ ÉVOLUTION ═══ */}
      <SectionTitle t={t} title="Évolution des réclamations" icon={TrendingUp} />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} title="Nouvelles réclamations par mois" sub="12 derniers mois">
          <AreaLine t={t} data={RECLAM_TREND} labels={MONTHS} suffix=" réclamations" color={C.violet} />
        </ChartCard>
      </div>

      {/* ═══ DÉTAIL PAR STOP DESK ═══ */}
      <SectionTitle t={t} title="Réclamations par Stop Desk" icon={Building2} sub="volume, résolution et délai moyen" />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} noPadding>
          <DataTable
            t={t}
            rows={SD_RECLAMATIONS}
            rowKey={(s) => s.sd}
            columns={[
              { header: "Stop Desk", render: (s) => <strong style={{ color: t.text }}>{s.sd}</strong> },
              { header: "Wilaya", render: (s) => <span style={{ color: t.textMuted }}>{s.wilaya}</span> },
              { header: "Total", align: "right", render: (s) => fmt(s.total) },
              { header: "Résolues", align: "right", render: (s) => <Pill color={C.green}>{fmt(s.resolved)}</Pill> },
              { header: "Ouvertes", align: "right", render: (s) => <Pill color={C.amber}>{fmt(s.total - s.resolved)}</Pill> },
              { header: "Taux de résolution", render: (s) => <ProgressCell t={t} value={Number(((s.resolved / s.total) * 100).toFixed(1))} /> },
              { header: "Délai moyen", align: "right", render: (s) => `${s.delai.toFixed(1)} j` },
            ]}
          />
        </ChartCard>
      </div>

      {/* ═══ DÉTAIL PAR TYPE ═══ */}
      <SectionTitle t={t} title="Détail par type de réclamation" icon={Flame} />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} noPadding>
          <DataTable
            t={t}
            rows={TYPE_DETAIL}
            rowKey={(r) => r.label}
            columns={[
              {
                header: "Type",
                render: (r) => (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                    <span style={{ color: t.text, fontWeight: 600 }}>{r.label}</span>
                  </span>
                ),
              },
              { header: "Réclamations", align: "right", render: (r) => fmt(r.value) },
              { header: "Part", render: (r) => <ProgressCell t={t} value={Number(((r.value / TOTAL) * 100).toFixed(1))} /> },
              { header: "Délai moyen", align: "right", render: (r) => `${r.delai.toFixed(1)} j` },
              { header: "Taux de résolution", render: (r) => <ProgressCell t={t} value={r.taux} /> },
            ]}
          />
        </ChartCard>
      </div>

      {/* ═══ RÉCLAMATIONS RÉCENTES ═══ */}
      <SectionTitle t={t} title="Réclamations récentes" icon={Activity} sub="dernières entrées du registre" />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} noPadding>
          <DataTable
            t={t}
            rows={RECENT_RECLAMATIONS}
            rowKey={(r) => r.ref}
            columns={[
              { header: "Réf.", render: (r) => <strong style={{ color: t.text, fontVariantNumeric: "tabular-nums" }}>{r.ref}</strong> },
              { header: "Type", render: (r) => <span style={{ color: t.textSub }}>{r.type}</span> },
              { header: "Stop Desk", render: (r) => <span style={{ color: t.textMuted }}>{r.sd}</span> },
              { header: "Expéditeur", render: (r) => <span style={{ color: t.textMuted }}>{r.expediteur}</span> },
              {
                header: "Priorité",
                render: (r) => <Pill color={PRIORITY_META[r.priority].color}>{PRIORITY_META[r.priority].label}</Pill>,
              },
              {
                header: "Statut",
                render: (r) => {
                  const m = STATUS_META[r.status];
                  return <Badge color={m.color} bg={`${m.color}18`}>{m.label}</Badge>;
                },
              },
              { header: "Âge", align: "right", render: (r) => r.age },
            ]}
          />
        </ChartCard>
      </div>

      {/* FOOTNOTE */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 4px", fontSize: 11.5, color: t.textFaint }}>
        <AlertTriangle size={13} />
        <span>
          Données illustratives — réseau de livraison algérien. Total {fmt(TOTAL)} réclamations,
          {" "}{fmt(RESOLUES)} résolues ({TAUX_RESOLUTION.toFixed(1)} %), {fmt(OUVERTES)} encore ouvertes,
          {" "}temps moyen de résolution {SLA_SUMMARY.avgResolution}.
        </span>
      </div>
    </PageShell>
  );
}
