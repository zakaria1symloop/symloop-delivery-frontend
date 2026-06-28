"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT DES PRÉLÈVEMENTS  (report #7)
 *
 *  Prélèvements (frais retenus sur les expéditions) : total, moyenne par colis,
 *  répartition expéditeur / destinataire, par mode de calcul, par Stop Desk,
 *  évolution sur 12 mois et configuration détaillée par centre.
 *
 *  ⚠️  HARDCODED showcase. Les séries partagées proviennent de `./_data` ;
 *  les chiffres propres à ce rapport sont déclarés localement ci-dessous.
 *  Tout se réconcilie autour d'un prélèvement total de 612 000 DA :
 *      • expéditeur / destinataire  Σ = 612 000 DA  (PREL_SPLIT, partagé)
 *      • par mode de calcul         Σ = 612 000 DA  (PREL_MODE_TABLE, local)
 *      • par Stop Desk              Σ = 612 000 DA  (PREL_BY_SD, local)
 *      •   dont part expéditeur     Σ = 372 000 DA
 *      •   dont part destinataire   Σ = 240 000 DA
 *      • évolution 12 mois          Σ = 612 000 DA  (PREL_TREND, local)
 *  Les primitives de graphiques ne sont PAS recréées ici — importées de `./_charts`.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Percent, Wallet, Calculator, Store, UserCheck, CalendarDays, Building2,
  PieChart, TrendingUp, Layers, MapPin, Receipt, FileText, Sheet, Filter,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, Donut, HBars, AreaLine, DataTable, Pill, Badge,
  Segmented, SelectField, ExportButton,
  C, fmt, formatDA, rainbow, type Tokens, type Segment,
} from "../_charts";
import {
  PREL_SPLIT, FINANCE_SUMMARY, MONTHS, PERIOD_OPTIONS, SD_FILTER_OPTIONS,
} from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  LOCAL HARDCODED DATA — specific to the Prélèvements report
 * ════════════════════════════════════════════════════════════════════════ */

/** Prélèvement total — chiffre d'ancrage auquel chaque ventilation se réconcilie. */
const PREL_TOTAL = FINANCE_SUMMARY.prelevementTotal;              // 612 000 DA
/** Part expéditeur / destinataire (séries partagées). */
const PART_EXP = PREL_SPLIT[0].value;                             // 372 000 DA
const PART_DEST = PREL_SPLIT[1].value;                            // 240 000 DA
/** Parc colis de la période (même ancre que le rapport Colis). */
const TOTAL_COLIS = 18432;
/** Colis ayant fait l'objet d'un prélèvement (sous-ensemble du parc). */
const COLIS_PRELEVES = 16240;

const PCT_EXP = ((PART_EXP / PREL_TOTAL) * 100).toFixed(1);       // 60.8
const PCT_DEST = ((PART_DEST / PREL_TOTAL) * 100).toFixed(1);     // 39.2
const MOYENNE_PAR_COLIS = Math.round((PREL_TOTAL / COLIS_PRELEVES) * 10) / 10; // 37.7
const MENSUEL_MOYEN = Math.round(PREL_TOTAL / 12);               // 51 000

/** Évolution mensuelle du prélèvement (Σ = 612 000 DA, creux estival, pic en décembre). */
const PREL_TREND = [36000, 40000, 44000, 47000, 50000, 53000, 57000, 45000, 52000, 58000, 64000, 66000];

/* Configuration & montants par Stop Desk.
 * total ligne = exp + dest ; Σ exp = 372 000, Σ dest = 240 000, Σ total = 612 000. */
type PrelMode = "Pourcentage" | "Montant fixe" | "Mixte";
interface PrelSdRow {
  name: string; wilaya: string; type: PrelMode; valeur: string;
  exp: number; dest: number;
}
const PREL_BY_SD: PrelSdRow[] = [
  { name: "Hub Alger",      wilaya: "Alger",       type: "Pourcentage",  valeur: "1.8 % COD",   exp: 104000, dest: 64000 },
  { name: "SD Oran Centre", wilaya: "Oran",        type: "Pourcentage",  valeur: "1.5 % COD",   exp: 58000,  dest: 36000 },
  { name: "SD Constantine", wilaya: "Constantine", type: "Mixte",        valeur: "1 % + 20 DA", exp: 46000,  dest: 30000 },
  { name: "SD Bab El Oued", wilaya: "Alger",       type: "Montant fixe", valeur: "40 DA/colis", exp: 42000,  dest: 26000 },
  { name: "SD Blida",       wilaya: "Blida",       type: "Pourcentage",  valeur: "1.5 % COD",   exp: 34000,  dest: 22000 },
  { name: "SD El Hadjeb",   wilaya: "Biskra",      type: "Montant fixe", valeur: "35 DA/colis", exp: 28000,  dest: 18000 },
  { name: "SD Annaba",      wilaya: "Annaba",      type: "Mixte",        valeur: "1 % + 15 DA", exp: 22000,  dest: 15000 },
  { name: "SD Sétif",       wilaya: "Sétif",       type: "Montant fixe", valeur: "30 DA/colis", exp: 18000,  dest: 12000 },
  { name: "SD Béjaïa",      wilaya: "Béjaïa",      type: "Pourcentage",  valeur: "1.2 % COD",   exp: 13000,  dest: 8000 },
  { name: "SD Batna",       wilaya: "Batna",       type: "Montant fixe", valeur: "30 DA/colis", exp: 7000,   dest: 9000 },
];
const sdTotal = (r: PrelSdRow) => r.exp + r.dest;
const SUM_EXP = PREL_BY_SD.reduce((a, r) => a + r.exp, 0);        // 372 000
const SUM_DEST = PREL_BY_SD.reduce((a, r) => a + r.dest, 0);      // 240 000
const SUM_TOTAL = SUM_EXP + SUM_DEST;                            // 612 000

/** Prélèvement par Stop Desk (HBars). */
const PREL_SD_BARS: Segment[] = PREL_BY_SD.map((r, i) => ({
  label: r.name, value: sdTotal(r), color: rainbow(i),
}));

/** Mode de calcul — couleur par type (réutilisée dans le tableau & le donut). */
const MODE_COLOR: Record<PrelMode, string> = {
  "Pourcentage": C.violet, "Montant fixe": C.cyan, "Mixte": C.amber,
};
interface PrelModeRow { mode: PrelMode; valeur: string; nbSd: number; total: number; }
const PREL_MODE_TABLE: PrelModeRow[] = [
  { mode: "Pourcentage",  valeur: "1.2 – 1.8 % du COD", nbSd: 4, total: 339000 },
  { mode: "Montant fixe", valeur: "30 – 40 DA / colis", nbSd: 4, total: 160000 },
  { mode: "Mixte",        valeur: "1 % + 15 à 20 DA",   nbSd: 2, total: 113000 },
];
/** Donut "par mode de calcul" — dérivé du tableau pour rester cohérent. */
const PREL_BY_MODE: Segment[] = PREL_MODE_TABLE.map((m) => ({
  label: m.mode, value: m.total, color: MODE_COLOR[m.mode],
}));

/** Options de filtre locales (visuel uniquement). */
const MODE_FILTER_OPTIONS = ["Tous les modes", "Pourcentage", "Montant fixe", "Mixte"];

export default function RapportPrelevementsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("mois");

  return (
    <PageShell t={t}>
      {/* DemoNotice — tout en haut, conformément au cahier des charges */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Percent}
        title="Rapport des Prélèvements"
        subtitle="Frais retenus sur les expéditions — répartition expéditeur / destinataire, par mode de calcul et par Stop Desk · réseau Algérie"
        action={
          <>
            <ExportButton t={t} icon={FileText} label="PDF" color={C.red} />
            <ExportButton t={t} icon={Sheet} label="Excel" color={C.green} />
          </>
        }
      />

      {/* ── Barre de filtres (visuel uniquement) ──────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <Segmented t={t} value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <div style={{ flex: 1 }} />
        <SelectField t={t} icon={Building2} options={SD_FILTER_OPTIONS} />
        <SelectField t={t} icon={Filter} options={MODE_FILTER_OPTIONS} />
      </div>

      {/* ════════════════════════════ KPIs ════════════════════════════════ */}
      <SectionTitle t={t} title="Indicateurs clés" icon={Wallet} sub="période en cours" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(178px, 1fr))", gap: 12, marginBottom: 26 }}>
        <KpiCard t={t} label="Prélèvement total"     value={formatDA(PREL_TOTAL)}        icon={Wallet}      delta={6.4}  goodWhenUp />
        <KpiCard t={t} label="Moyenne / colis"       value={formatDA(MOYENNE_PAR_COLIS)} icon={Calculator}  delta={2.1}  goodWhenUp />
        <KpiCard t={t} label="Part expéditeur"       value={`${PCT_EXP} %`}              icon={Store}       delta={1.2}  goodWhenUp deltaSuffix=" pts" />
        <KpiCard t={t} label="Part destinataire"     value={`${PCT_DEST} %`}             icon={UserCheck}   delta={-1.2} goodWhenUp deltaSuffix=" pts" />
        <KpiCard t={t} label="Prél. mensuel moyen"   value={formatDA(MENSUEL_MOYEN)}     icon={CalendarDays} delta={5.8}  goodWhenUp />
        <KpiCard t={t} label="Stop Desks configurés" value={fmt(PREL_BY_SD.length)}      icon={Building2} />
      </div>

      {/* ════════════════ Répartition (expéditeur/destinataire + mode) ═════ */}
      <SectionTitle t={t} title="Répartition des prélèvements" icon={PieChart} sub="qui paie & comment il est calculé" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 26 }}>
        <ChartCard t={t} title="Expéditeur vs Destinataire" icon={PieChart} sub={`Σ ${formatDA(PREL_TOTAL)}`}>
          <Donut t={t} data={PREL_SPLIT} legend legendMoney centerValue={`${Math.round(PREL_TOTAL / 1000)}k DA`} centerLabel="prélèvement" />
        </ChartCard>

        <ChartCard t={t} title="Par mode de calcul" icon={Layers} sub="Pourcentage · Montant fixe · Mixte">
          <Donut t={t} data={PREL_BY_MODE} legend legendMoney centerValue={`${Math.round(PREL_TOTAL / 1000)}k DA`} centerLabel="total" />
        </ChartCard>
      </div>

      {/* ════════════════════════ Prélèvement par SD ══════════════════════ */}
      <SectionTitle t={t} title="Prélèvement par Stop Desk" icon={Building2} sub={`${PREL_BY_SD.length} centres`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Montant prélevé par Stop Desk" icon={MapPin} sub={`Σ ${formatDA(SUM_TOTAL)}`}>
          <HBars t={t} data={PREL_SD_BARS} money />
        </ChartCard>
      </div>

      {/* ════════════════════════ Évolution 12 mois ═══════════════════════ */}
      <SectionTitle t={t} title="Évolution du prélèvement" icon={TrendingUp} sub="12 derniers mois" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Prélèvement mensuel" icon={TrendingUp} sub={`Σ ${formatDA(PREL_TREND.reduce((a, b) => a + b, 0))}`}>
          <AreaLine t={t} data={PREL_TREND} labels={MONTHS} color={C.violet} suffix=" DA" height={250} />
        </ChartCard>
      </div>

      {/* ════════════════════ Configuration & montants ════════════════════ */}
      <SectionTitle t={t} title="Configuration & montants" icon={Receipt} sub="règles de prélèvement par centre & par mode" />

      <div style={{ marginBottom: 14 }}>
        <ChartCard t={t} title="Configuration & montant par Stop Desk" icon={Building2} sub={`${PREL_BY_SD.length} centres · ${fmt(COLIS_PRELEVES)} colis prélevés`} noPadding>
          <DataTable<PrelSdRow>
            t={t}
            rows={PREL_BY_SD}
            rowKey={(r) => r.name}
            columns={[
              { header: "Stop Desk", render: (r) => <span style={{ fontWeight: 700, color: t.text }}>{r.name}</span> },
              { header: "Wilaya", render: (r) => r.wilaya },
              { header: "Type", render: (r) => <Badge color={MODE_COLOR[r.type]} bg={`${MODE_COLOR[r.type]}18`}>{r.type}</Badge> },
              { header: "Valeur (config)", render: (r) => <span style={{ fontWeight: 600, color: t.textSub }}>{r.valeur}</span> },
              { header: "Part expéditeur", align: "right", render: (r) => formatDA(r.exp) },
              { header: "Part destinataire", align: "right", render: (r) => formatDA(r.dest) },
              { header: "Total prélevé", align: "right", render: (r) => <span style={{ fontWeight: 700, color: t.text }}>{formatDA(sdTotal(r))}</span> },
            ]}
          />
          <TableFooter t={t} cells={[
            { label: "Total réseau", flex: 4 },
            { value: formatDA(SUM_EXP), align: "right" },
            { value: formatDA(SUM_DEST), align: "right" },
            { value: formatDA(SUM_TOTAL), align: "right" },
          ]} />
        </ChartCard>
      </div>

      <div style={{ marginBottom: 8 }}>
        <ChartCard t={t} title="Détail par mode de calcul" icon={Layers} sub="type · valeur · total" noPadding>
          <DataTable<PrelModeRow>
            t={t}
            rows={PREL_MODE_TABLE}
            rowKey={(r) => r.mode}
            columns={[
              { header: "Mode", render: (r) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: MODE_COLOR[r.mode], flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, color: t.text }}>{r.mode}</span>
                </span>
              ) },
              { header: "Valeur (config)", render: (r) => <span style={{ fontWeight: 600, color: t.textSub }}>{r.valeur}</span> },
              { header: "Nb Stop Desks", align: "center", render: (r) => <Pill color={MODE_COLOR[r.mode]}>{r.nbSd}</Pill> },
              { header: "Total prélevé", align: "right", render: (r) => <span style={{ fontWeight: 700, color: t.text }}>{formatDA(r.total)}</span> },
              { header: "Part", align: "right", render: (r) => `${((r.total / SUM_TOTAL) * 100).toFixed(1)} %` },
            ]}
          />
          <TableFooter t={t} cells={[
            { label: "Total", flex: 2 },
            { value: fmt(PREL_MODE_TABLE.reduce((a, r) => a + r.nbSd, 0)), align: "center" },
            { value: formatDA(PREL_MODE_TABLE.reduce((a, r) => a + r.total, 0)), align: "right" },
            { value: "100 %", align: "right" },
          ]} />
        </ChartCard>
      </div>
    </PageShell>
  );
}

/* ── Bandeau de totaux pour les tableaux (réplique du rapport Colis) ──────── */
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
