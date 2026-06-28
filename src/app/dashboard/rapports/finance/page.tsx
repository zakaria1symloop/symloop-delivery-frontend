"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT FINANCIER GLOBAL  (report — finance)
 *
 *  Money-focused executive report: a 6-KPI finance band, the 12-month CA bar
 *  chart, a COD-vs-objectif gauge, the revenue-composition donut, the
 *  prélèvement split (expéditeur vs destinataire), a COD-recovery donut, a
 *  trésorerie / caisse strip and a detailed "résumé financier par Stop Desk"
 *  table plus an expéditeur encours table.
 *
 *  ⚠️  HARDCODED SHOWCASE — every figure is illustrative (Algerian delivery
 *  network). Shared series come from `../_data`; report-specific consts
 *  (COD_OBJECTIF, REVENUE_SPLIT, SD_COD, FINANCE_BY_SD, FIN_NOTES) are defined
 *  locally and kept internally consistent with the shared mock data. All
 *  chart/layout primitives are imported from `../_charts` — none re-implemented.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Wallet, Coins, Banknote, TrendingUp, PiggyBank, Hourglass,
  BarChart3, Target, PieChart, Receipt, Scale, HandCoins, Landmark,
  Building2, Store, FileText, FileSpreadsheet, Activity, CircleDollarSign,
  AlertTriangle,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, VBars, Gauge, Donut, HBars, SplitBar,
  DataTable, ProgressCell, Pill, MoneyDelta, Segmented, ExportButton,
  C, fmt, formatDA, ORANGE, type Tokens,
} from "../_charts";
import {
  MONTHS, REVENUE_TREND, FINANCE_SUMMARY, CAISSE_SUMMARY,
  PREL_SPLIT, COD_SPLIT, STOP_DESKS, MERCHANTS, PERIOD_OPTIONS,
} from "../_data";

/* ════════════════════════════════════════════════════════════════════════════
 *  REPORT-SPECIFIC HARDCODED DATA (consistent with ../_data)
 * ════════════════════════════════════════════════════════════════════════════ */

/* Monthly objectif for the COD gauge — collecté (38.54M) ≈ 91.8 % de la cible. */
const COD_OBJECTIF = 42_000_000;
const COD_RESTE = COD_OBJECTIF - FINANCE_SUMMARY.codCollected;

/* CA trend stats (REVENUE_TREND is the shared 12-month chiffre-d'affaires series). */
const CA_TOTAL = REVENUE_TREND.reduce((s, v) => s + v, 0);
const CA_AVG = Math.round(CA_TOTAL / REVENUE_TREND.length);
const CA_PEAK = Math.max(...REVENUE_TREND);
const CA_PEAK_MONTH = MONTHS[REVENUE_TREND.indexOf(CA_PEAK)];

/* Décomposition du chiffre d'affaires — somme = FINANCE_SUMMARY.ca (4 820 000). */
const REVENUE_SPLIT = [
  { label: "Frais de livraison",            value: 3_980_000, color: C.orange },
  { label: "Prélèvements (commission)",     value:   612_000, color: C.violet },
  { label: "Autres (assurance, stockage…)", value:   228_000, color: C.blue   },
];

/* COD encaissé par Stop Desk (collecté / remis) — parallèle à STOP_DESKS. */
const SD_COD: Record<string, { collected: number; remitted: number }> = {
  "Hub Alger":      { collected: 11_200_000, remitted: 9_900_000 },
  "SD Oran Centre": { collected:  6_400_000, remitted: 5_500_000 },
  "SD Constantine": { collected:  5_100_000, remitted: 4_180_000 },
  "SD Bab El Oued": { collected:  4_300_000, remitted: 3_820_000 },
  "SD Blida":       { collected:  3_700_000, remitted: 3_320_000 },
  "SD El Hadjeb":   { collected:  2_900_000, remitted: 2_540_000 },
  "SD Annaba":      { collected:  2_180_000, remitted: 1_760_000 },
  "SD Sétif":       { collected:  1_480_000, remitted: 1_360_000 },
  "SD Béjaïa":      { collected:  1_100_000, remitted:   980_000 },
  "SD Batna":       { collected:    720_000, remitted:   580_000 },
};

export interface FinanceSdRow {
  name: string; wilaya: string;
  codCollected: number; codRemitted: number; codPending: number;
  remitRate: number; fees: number; prel: number; solde: number;
}

/* Merge shared STOP_DESKS (ca / prel / solde) with local COD figures. */
const FINANCE_BY_SD: FinanceSdRow[] = STOP_DESKS.map((s) => {
  const cod = SD_COD[s.name] ?? { collected: 0, remitted: 0 };
  const pending = cod.collected - cod.remitted;
  return {
    name: s.name,
    wilaya: s.wilaya,
    codCollected: cod.collected,
    codRemitted: cod.remitted,
    codPending: pending,
    remitRate: cod.collected ? Math.round((cod.remitted / cod.collected) * 100) : 0,
    fees: s.ca,
    prel: s.prel,
    solde: s.solde,
  };
}).sort((a, b) => b.codCollected - a.codCollected);

/* Réseau totals (computed from the table above so the footer always reconciles). */
const SD_TOTALS = FINANCE_BY_SD.reduce(
  (acc, r) => ({
    codCollected: acc.codCollected + r.codCollected,
    codRemitted: acc.codRemitted + r.codRemitted,
    codPending: acc.codPending + r.codPending,
    fees: acc.fees + r.fees,
    prel: acc.prel + r.prel,
    solde: acc.solde + r.solde,
  }),
  { codCollected: 0, codRemitted: 0, codPending: 0, fees: 0, prel: 0, solde: 0 },
);

/* Top expéditeurs par encours (solde à reverser) — dérivé de MERCHANTS. */
const TOP_ENCOURS = [...MERCHANTS].sort((a, b) => b.solde - a.solde).slice(0, 6);

/* Points d'attention financiers ────────────────────────────────────────────── */
type Tone = "good" | "warn" | "bad" | "info";
const TONE: Record<Tone, { color: string; tag: string }> = {
  good: { color: C.green, tag: "Positif" },
  warn: { color: C.amber, tag: "À surveiller" },
  bad:  { color: C.red,   tag: "Alerte" },
  info: { color: C.blue,  tag: "Info" },
};
interface FinNote { icon: React.ElementType; tone: Tone; title: string; detail: string; }

const FIN_NOTES: FinNote[] = [
  {
    icon: Coins, tone: "warn",
    title: "COD en attente de remise",
    detail: "6 720 000 DA non encore reversés aux expéditeurs, soit ~17 % du COD collecté (38 540 000 DA).",
  },
  {
    icon: Target, tone: "info",
    title: "Objectif COD presque atteint",
    detail: `38 540 000 DA collectés sur 42 000 000 DA visés (91.8 %) — reste ${formatDA(COD_RESTE)} à recouvrer.`,
  },
  {
    icon: Wallet, tone: "bad",
    title: "Stop Desks débiteurs",
    detail: "Constantine (−210 000 DA), Annaba (−86 000 DA) et Batna (−32 000 DA) présentent un solde de caisse négatif.",
  },
  {
    icon: PiggyBank, tone: "good",
    title: "Marge nette solide",
    detail: "3 680 000 DA après prélèvements & frais, soit ~76 % du chiffre d'affaires (4 820 000 DA).",
  },
];

/* ════════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════════ */

export default function FinanceReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("mois");

  const caPct = ((FINANCE_SUMMARY.prelevementTotal / FINANCE_SUMMARY.ca) * 100).toFixed(1);
  const remitGlobalPct = Math.round((FINANCE_SUMMARY.codRemitted / FINANCE_SUMMARY.codCollected) * 100);

  return (
    <PageShell t={t}>
      {/* Demo banner — at the very top */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Landmark}
        title="Rapport Financier Global"
        subtitle="Chiffre d'affaires, recouvrement COD, prélèvements, marges et trésorerie du réseau"
        action={
          <>
            <Segmented t={t} value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
            <ExportButton t={t} icon={FileText} label="PDF" color={C.red} />
            <ExportButton t={t} icon={FileSpreadsheet} label="Excel" color={C.green} />
          </>
        }
      />

      {/* ── 1. KPI BAND (finance) ────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs financiers clés" icon={Activity} sub="6 métriques · vs période précédente" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12, marginBottom: 26 }}>
        <KpiCard t={t} label="Chiffre d'affaires"   value={formatDA(FINANCE_SUMMARY.ca)}              icon={TrendingUp} delta={14.2} goodWhenUp />
        <KpiCard t={t} label="COD collecté"          value={formatDA(FINANCE_SUMMARY.codCollected)}    icon={Coins}      delta={11.5} goodWhenUp />
        <KpiCard t={t} label="Frais encaissés"       value={formatDA(FINANCE_SUMMARY.feesCollected)}   icon={Banknote}   delta={13.0} goodWhenUp />
        <KpiCard t={t} label="Prélèvement total"     value={formatDA(FINANCE_SUMMARY.prelevementTotal)} icon={Wallet}    delta={6.4}  goodWhenUp />
        <KpiCard t={t} label="Marge nette"           value={formatDA(FINANCE_SUMMARY.marginNet)}       icon={PiggyBank}  delta={9.7}  goodWhenUp />
        <KpiCard t={t} label="COD en attente"        value={formatDA(FINANCE_SUMMARY.codPending)}      icon={Hourglass}  delta={3.4}  goodWhenUp={false} />
      </div>

      {/* ── 2. CA / MOIS + GAUGE COD ─────────────────────────────────────────── */}
      <SectionTitle t={t} title="Évolution & objectifs" icon={BarChart3} sub="12 derniers mois" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Chiffre d'affaires par mois" icon={BarChart3} sub={`Pic : ${formatDA(CA_PEAK)} en ${CA_PEAK_MONTH}`}>
            <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
              <MiniStat t={t} label="Total période" value={formatDA(CA_TOTAL)} />
              <MiniStat t={t} label="Moyenne / mois" value={formatDA(CA_AVG)} />
              <MiniStat t={t} label="Pic mensuel" value={`${formatDA(CA_PEAK)} (${CA_PEAK_MONTH})`} color={C.green} />
              <MiniStat t={t} label="Prélèvement / CA" value={`${caPct} %`} color={ORANGE} />
            </div>
            <VBars t={t} data={REVENUE_TREND} labels={MONTHS} color={ORANGE} height={210} />
          </ChartCard>
        </div>

        <ChartCard t={t} title="COD collecté vs objectif" icon={Target} sub="objectif mensuel">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Gauge
              t={t}
              value={FINANCE_SUMMARY.codCollected}
              total={COD_OBJECTIF}
              color={C.green}
              label="de l'objectif"
            />
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
              <MiniStat t={t} label="Objectif" value={formatDA(COD_OBJECTIF)} />
              <MiniStat t={t} label="Collecté" value={formatDA(FINANCE_SUMMARY.codCollected)} color={C.green} />
              <MiniStat t={t} label="Reste" value={formatDA(COD_RESTE)} color={C.amber} />
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── 3. COMPOSITION DES REVENUS + PRÉLÈVEMENT + RECOUVREMENT ───────────── */}
      <SectionTitle t={t} title="Composition & recouvrement" icon={PieChart} sub="structure des revenus" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Répartition des revenus" icon={PieChart} sub={formatDA(FINANCE_SUMMARY.ca)}>
          <Donut
            t={t}
            data={REVENUE_SPLIT}
            legend
            legendMoney
            centerValue={formatDA(FINANCE_SUMMARY.ca).replace(" DA", "")}
            centerLabel="DA — CA"
            size={168}
            thickness={26}
          />
        </ChartCard>

        <ChartCard t={t} title="Prélèvement : expéditeur vs destinataire" icon={Receipt} sub={formatDA(FINANCE_SUMMARY.prelevementTotal)}>
          <HBars t={t} data={PREL_SPLIT} money />
          <div style={{ height: 14 }} />
          <SplitBar t={t} data={PREL_SPLIT} legend={false} />
          <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap" }}>
            <MiniStat t={t} label="Total prélevé" value={formatDA(FINANCE_SUMMARY.prelevementTotal)} color={C.violet} />
            <MiniStat t={t} label="Part du CA" value={`${caPct} %`} />
          </div>
        </ChartCard>

        <ChartCard t={t} title="Recouvrement du COD" icon={HandCoins} sub={`${remitGlobalPct} % remis`}>
          <Donut
            t={t}
            data={COD_SPLIT}
            legend
            legendMoney
            centerValue={`${remitGlobalPct}%`}
            centerLabel="remis"
            size={168}
            thickness={26}
          />
        </ChartCard>
      </div>

      {/* ── 4. TRÉSORERIE & CAISSES ──────────────────────────────────────────── */}
      <SectionTitle t={t} title="Trésorerie & caisses" icon={Scale} sub="positions de caisse du réseau" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 26 }}>
        <StatTile t={t} icon={Landmark}        label="Caisse globale"            value={formatDA(CAISSE_SUMMARY.global)} hint="solde consolidé du réseau" accent={C.green} />
        <StatTile t={t} icon={CircleDollarSign} label="Dû par les Stop Desks"     value={formatDA(CAISSE_SUMMARY.sdOweUs)} hint="encours à récupérer" accent={C.amber} />
        <StatTile t={t} icon={Wallet}          label="Dû aux Stop Desks"         value={formatDA(CAISSE_SUMMARY.weOweSd)} hint="à reverser au réseau" accent={C.red} />
        <StatTile t={t} icon={Coins}           label="COD remis aux expéditeurs" value={formatDA(FINANCE_SUMMARY.codRemitted)} hint={`≈ ${remitGlobalPct} % du COD collecté`} accent={C.green} />
      </div>

      {/* ── 5. RÉSUMÉ FINANCIER PAR STOP DESK ────────────────────────────────── */}
      <SectionTitle t={t} title="Résumé financier par Stop Desk" icon={Building2} sub={`${FINANCE_BY_SD.length} stop desks`} />
      <div style={{ marginBottom: 14 }}>
        <ChartCard t={t} title="Détail financier — Stop Desks" icon={Building2} noPadding>
          <DataTable
            t={t}
            rows={FINANCE_BY_SD}
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
              { header: "COD collecté", align: "right", render: (s) => formatDA(s.codCollected) },
              { header: "COD remis",    align: "right", render: (s) => formatDA(s.codRemitted) },
              {
                header: "En attente", align: "right",
                render: (s) => <span style={{ color: s.codPending > 0 ? C.amber : t.textSub, fontWeight: 700 }}>{formatDA(s.codPending)}</span>,
              },
              { header: "Taux de remise", render: (s) => <ProgressCell t={t} value={s.remitRate} /> },
              { header: "Frais",        align: "right", render: (s) => formatDA(s.fees) },
              { header: "Prélèvement",  align: "right", render: (s) => formatDA(s.prel) },
              { header: "Solde caisse", align: "right", render: (s) => <MoneyDelta value={s.solde} /> },
            ]}
          />
          {/* Footer total row (reconciles with the table above). */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: `2px solid ${t.border}`, background: t.rowHover, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: t.textMuted }}>Total réseau</span>
            <span style={{ flex: 1 }} />
            <MiniStat t={t} label="COD collecté" value={formatDA(SD_TOTALS.codCollected)} />
            <MiniStat t={t} label="COD remis" value={formatDA(SD_TOTALS.codRemitted)} color={C.green} />
            <MiniStat t={t} label="En attente" value={formatDA(SD_TOTALS.codPending)} color={C.amber} />
            <MiniStat t={t} label="Frais" value={formatDA(SD_TOTALS.fees)} />
            <MiniStat t={t} label="Prélèvement" value={formatDA(SD_TOTALS.prel)} color={C.violet} />
          </div>
        </ChartCard>
      </div>

      {/* ── 6. ENCOURS EXPÉDITEURS ───────────────────────────────────────────── */}
      <SectionTitle t={t} title="Soldes expéditeurs & encours" icon={Store} sub="montants à reverser" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Top expéditeurs — soldes à reverser" icon={Store} noPadding>
          <DataTable
            t={t}
            rows={TOP_ENCOURS}
            rowKey={(m) => m.name}
            columns={[
              {
                header: "Expéditeur",
                render: (m, i) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Pill color={C.violet}>{i + 1}</Pill>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{m.category}</div>
                    </div>
                  </div>
                ),
              },
              { header: "Colis", align: "right", render: (m) => fmt(m.colis) },
              { header: "CA généré", align: "right", render: (m) => formatDA(m.ca) },
              { header: "Taux retour", render: (m) => <ProgressCell t={t} value={m.retour} max={15} invert suffix="%" /> },
              { header: "Solde à reverser", align: "right", render: (m) => formatDA(m.solde) },
            ]}
          />
        </ChartCard>
      </div>

      {/* ── 7. POINTS D'ATTENTION FINANCIERS ─────────────────────────────────── */}
      <SectionTitle t={t} title="Points d'attention" icon={AlertTriangle} sub="lecture financière" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIN_NOTES.map((n, i) => (
          <FinNoteCard key={i} t={t} n={n} />
        ))}
      </div>
    </PageShell>
  );
}

/* ── Note card (local — uses tokens, no chart primitive duplicated) ──────────── */
function FinNoteCard({ t, n }: { t: Tokens; n: FinNote }) {
  const { color, tag } = TONE[n.tone];
  const Icon = n.icon;
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
          <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{n.title}</span>
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color, background: `${color}15`, padding: "2px 7px", borderRadius: 99 }}>{tag}</span>
        </div>
        <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>{n.detail}</div>
      </div>
    </div>
  );
}
