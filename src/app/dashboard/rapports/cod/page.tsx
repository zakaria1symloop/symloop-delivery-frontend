"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT COD / RECOUVREMENT  (report — cash-on-delivery)
 *
 *  COD-focused report: a 6-KPI band (COD total, collecté, remis, en attente,
 *  taux de remise, délai moyen de remise), a "collecté vs remis" gauge, a
 *  recovery-status donut, a 3-segment COD-lifecycle split bar (remis · en
 *  attente · à collecter), a remittance-health stat strip, the 12-month
 *  "COD remis" area-line + a companion "COD collecté" bar chart, a top-SD COD
 *  ranking, a detailed "COD par Stop Desk" table, a "COD par expéditeur" table
 *  and a points-d'attention block.
 *
 *  ⚠️  HARDCODED SHOWCASE — every figure is illustrative (Algerian delivery
 *  network). Shared series come from `../_data` (FINANCE_SUMMARY, COD_SPLIT,
 *  COD_TREND, STOP_DESKS, MERCHANTS…). Report-specific consts (COD_TOTAL,
 *  COD_LIFECYCLE, COD_REMIS_TREND, COD_BY_SD, COD_BY_MERCHANT, COD_NOTES) are
 *  defined locally and kept internally consistent with the shared mock data:
 *    collecté (38.54M) = remis (31.82M) + en attente (6.72M)
 *    COD total (47M)   = collecté (38.54M) + non encore collecté (8.46M)
 *  All chart/layout primitives are imported from `../_charts` — none re-built.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  HandCoins, Wallet, Coins, Banknote, Hourglass, Percent, Clock,
  Target, PieChart, BarChart3, Activity, Building2, Store, TrendingUp,
  CircleDollarSign, AlertTriangle, FileText, FileSpreadsheet, Layers,
  CalendarClock, Gauge as GaugeIcon, Timer,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, Gauge, Donut, HBars, VBars, AreaLine,
  SplitBar, DataTable, ProgressCell, Pill, Segmented, ExportButton,
  C, fmt, formatDA, ORANGE, rainbow, type Tokens, type Segment,
} from "../_charts";
import {
  MONTHS, COD_TREND, FINANCE_SUMMARY, COD_SPLIT,
  STOP_DESKS, MERCHANTS, PERIOD_OPTIONS, fmtCompact,
} from "../_data";

/* ════════════════════════════════════════════════════════════════════════════
 *  REPORT-SPECIFIC HARDCODED DATA (consistent with ../_data)
 * ════════════════════════════════════════════════════════════════════════════ */

/* COD pipeline — single source of truth for this page.
 *   collecté = remis + en attente            (38.54M = 31.82M + 6.72M)
 *   COD total = collecté + non encore collecté (47.00M = 38.54M + 8.46M) */
const COD_COLLECTED = FINANCE_SUMMARY.codCollected; // 38 540 000
const COD_REMITTED = FINANCE_SUMMARY.codRemitted;   // 31 820 000
const COD_PENDING = FINANCE_SUMMARY.codPending;     //  6 720 000
const COD_IN_TRANSIT = 8_460_000;                   // COD on packages not yet delivered
const COD_TOTAL = COD_COLLECTED + COD_IN_TRANSIT;   // 47 000 000

/* Headline ratios (computed so the whole page reconciles). */
const REMIT_RATE = (COD_REMITTED / COD_COLLECTED) * 100;          // 82.56 %
const PENDING_SHARE = (COD_PENDING / COD_COLLECTED) * 100;        // 17.44 %
const COLLECT_RATE = (COD_COLLECTED / COD_TOTAL) * 100;           // 82.0 %
const AVG_REMIT_DELAY = 3.2;                                      // jours

/* COD lifecycle (non-overlapping) — sums to COD_TOTAL (47M). */
const COD_LIFECYCLE: Segment[] = [
  { label: "Remis à l'expéditeur",  value: COD_REMITTED,   color: C.green },
  { label: "Collecté · en attente", value: COD_PENDING,    color: C.amber },
  { label: "Non encore collecté",   value: COD_IN_TRANSIT, color: C.slate },
];

/* 12-month "COD remis" series — sums to 31 820 000 (= COD_REMITTED).
 * Tracks COD_TREND (collecté) at ~82-84 % with a slight remittance lag. */
const COD_REMIS_TREND = [
  1_980_000, 2_210_000, 2_480_000, 2_640_000, 2_780_000, 2_720_000,
  2_860_000, 2_520_000, 2_740_000, 2_840_000, 3_060_000, 2_990_000,
];

const REMIS_TOTAL = COD_REMIS_TREND.reduce((s, v) => s + v, 0);
const REMIS_AVG = Math.round(REMIS_TOTAL / COD_REMIS_TREND.length);
const REMIS_PEAK = Math.max(...COD_REMIS_TREND);
const REMIS_PEAK_MONTH = MONTHS[COD_REMIS_TREND.indexOf(REMIS_PEAK)];

const COLLECT_TOTAL = COD_TREND.reduce((s, v) => s + v, 0);
const COLLECT_AVG = Math.round(COLLECT_TOTAL / COD_TREND.length);
const COLLECT_PEAK = Math.max(...COD_TREND);
const COLLECT_PEAK_MONTH = MONTHS[COD_TREND.indexOf(COLLECT_PEAK)];

/* COD encaissé / remis par Stop Desk — collecté sums to 38.54M, remis to 31.82M
 * so the table footer reconciles exactly with the KPI band. */
const COD_SD_RAW: Record<string, { collected: number; remitted: number; delai: number }> = {
  "Hub Alger":      { collected: 10_940_000, remitted: 9_200_000, delai: 2.6 },
  "SD Oran Centre": { collected:  6_180_000, remitted: 5_100_000, delai: 3.1 },
  "SD Constantine": { collected:  4_920_000, remitted: 3_960_000, delai: 3.9 },
  "SD Bab El Oued": { collected:  4_260_000, remitted: 3_560_000, delai: 2.8 },
  "SD Blida":       { collected:  3_640_000, remitted: 3_040_000, delai: 2.7 },
  "SD El Hadjeb":   { collected:  2_880_000, remitted: 2_360_000, delai: 3.0 },
  "SD Annaba":      { collected:  2_140_000, remitted: 1_700_000, delai: 4.1 },
  "SD Sétif":       { collected:  1_560_000, remitted: 1_300_000, delai: 2.9 },
  "SD Béjaïa":      { collected:  1_180_000, remitted:   960_000, delai: 3.4 },
  "SD Batna":       { collected:    840_000, remitted:   640_000, delai: 4.3 },
};

export interface CodSdRow {
  name: string; wilaya: string;
  collected: number; remitted: number; pending: number;
  remitRate: number; delai: number;
}

const COD_BY_SD: CodSdRow[] = STOP_DESKS.map((s) => {
  const cod = COD_SD_RAW[s.name] ?? { collected: 0, remitted: 0, delai: 0 };
  return {
    name: s.name,
    wilaya: s.wilaya,
    collected: cod.collected,
    remitted: cod.remitted,
    pending: cod.collected - cod.remitted,
    remitRate: cod.collected ? Math.round((cod.remitted / cod.collected) * 100) : 0,
    delai: cod.delai,
  };
}).sort((a, b) => b.collected - a.collected);

/* Réseau totals — derived from the table so the footer always reconciles. */
const SD_TOTALS = COD_BY_SD.reduce(
  (acc, r) => ({
    collected: acc.collected + r.collected,
    remitted: acc.remitted + r.remitted,
    pending: acc.pending + r.pending,
  }),
  { collected: 0, remitted: 0, pending: 0 },
);

/* Top Stop Desks par COD collecté (HBars). */
const TOP_SD_COLLECTED: Segment[] = COD_BY_SD
  .slice(0, 8)
  .map((s, i) => ({ label: s.name, value: s.collected, color: rainbow(i) }));

/* Remittance extremes (fastest / slowest SD) for the health strip. */
const FASTEST_SD = [...COD_BY_SD].sort((a, b) => a.delai - b.delai)[0];
const SLOWEST_SD = [...COD_BY_SD].sort((a, b) => b.delai - a.delai)[0];

/* COD par expéditeur — collecté local, en attente = MERCHANTS.solde (reuse),
 * remis = collecté − en attente. Top 8 expéditeurs. */
const COD_MERCHANT_COLLECTED: Record<string, number> = {
  "Boutique Electronique": 9_800_000,
  "Mode Dz":               7_600_000,
  "Cosmétique Plus":       5_200_000,
  "Tech Store DZ":         4_600_000,
  "Maison & Déco":         3_300_000,
  "Sport Zone":            2_700_000,
  "Bébé Confort":          2_100_000,
  "Parfum Élégance":       1_800_000,
};

export interface CodMerchantRow {
  name: string; category: string; colis: number;
  collected: number; remitted: number; pending: number; remitRate: number;
}

const COD_BY_MERCHANT: CodMerchantRow[] = MERCHANTS.map((m) => {
  const collected = COD_MERCHANT_COLLECTED[m.name] ?? 0;
  const pending = m.solde;
  const remitted = collected - pending;
  return {
    name: m.name,
    category: m.category,
    colis: m.colis,
    collected,
    remitted,
    pending,
    remitRate: collected ? Math.round((remitted / collected) * 100) : 0,
  };
}).sort((a, b) => b.collected - a.collected);

/* Points d'attention COD ─────────────────────────────────────────────────────── */
type Tone = "good" | "warn" | "bad" | "info";
const TONE: Record<Tone, { color: string; tag: string }> = {
  good: { color: C.green, tag: "Positif" },
  warn: { color: C.amber, tag: "À surveiller" },
  bad:  { color: C.red,   tag: "Alerte" },
  info: { color: C.blue,  tag: "Info" },
};
interface CodNote { icon: React.ElementType; tone: Tone; title: string; detail: string; }

const COD_NOTES: CodNote[] = [
  {
    icon: Hourglass, tone: "warn",
    title: "COD en attente de remise",
    detail: `${formatDA(COD_PENDING)} collectés mais pas encore reversés aux expéditeurs, soit ~${PENDING_SHARE.toFixed(1)} % du COD collecté.`,
  },
  {
    icon: Timer, tone: "bad",
    title: "Délais de remise hors SLA",
    detail: "SD Annaba (4.1 j) et SD Batna (4.3 j) dépassent le SLA réseau de 3 j — taux de remise les plus faibles (76-79 %).",
  },
  {
    icon: HandCoins, tone: "good",
    title: "Hub Alger très performant",
    detail: "Plus gros collecteur (10 940 000 DA) avec un délai de remise moyen de 2.6 j et 84 % de COD déjà reversé.",
  },
  {
    icon: CircleDollarSign, tone: "info",
    title: "COD encore en circulation",
    detail: `${formatDA(COD_IN_TRANSIT)} de COD sur des colis non livrés (COD total ${formatDA(COD_TOTAL)}). Taux de collecte global : ${COLLECT_RATE.toFixed(1)} %.`,
  },
];

/* ════════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════════ */

export default function CodReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("mois");

  return (
    <PageShell t={t}>
      {/* Demo banner — at the very top */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={HandCoins}
        title="Rapport COD / Recouvrement"
        subtitle="Encaissement à la livraison, remise aux expéditeurs, délais de reversement et soldes en attente"
        action={
          <>
            <Segmented t={t} value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
            <ExportButton t={t} icon={FileText} label="PDF" color={C.red} />
            <ExportButton t={t} icon={FileSpreadsheet} label="Excel" color={C.green} />
          </>
        }
      />

      {/* ── 1. KPI BAND (COD) ────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs COD clés" icon={Activity} sub="6 métriques · vs période précédente" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12, marginBottom: 26 }}>
        <KpiCard t={t} label="COD total"               value={formatDA(COD_TOTAL)}     icon={Wallet}    delta={9.1}  goodWhenUp />
        <KpiCard t={t} label="COD collecté"            value={formatDA(COD_COLLECTED)} icon={Coins}     delta={11.5} goodWhenUp />
        <KpiCard t={t} label="COD remis"               value={formatDA(COD_REMITTED)}  icon={Banknote}  delta={12.8} goodWhenUp />
        <KpiCard t={t} label="COD en attente"          value={formatDA(COD_PENDING)}   icon={Hourglass} delta={3.4}  goodWhenUp={false} />
        <KpiCard t={t} label="Taux de remise"          value={`${REMIT_RATE.toFixed(1)} %`} icon={Percent} delta={2.1} goodWhenUp deltaSuffix=" pts" />
        <KpiCard t={t} label="Délai moyen de remise"   value={`${AVG_REMIT_DELAY} j`}  icon={Clock}     delta={-0.4} goodWhenUp={false} deltaSuffix=" j" />
      </div>

      {/* ── 2. RECOUVREMENT & REMISE ─────────────────────────────────────────── */}
      <SectionTitle t={t} title="Recouvrement & remise" icon={GaugeIcon} sub="collecté → remis → en attente" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Collecté vs remis" icon={Target} sub={`${REMIT_RATE.toFixed(1)} % remis`}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Gauge t={t} value={COD_REMITTED} total={COD_COLLECTED} color={C.green} label="du COD collecté remis" />
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
              <MiniStat t={t} label="Collecté" value={formatDA(COD_COLLECTED)} />
              <MiniStat t={t} label="Remis" value={formatDA(COD_REMITTED)} color={C.green} />
              <MiniStat t={t} label="En attente" value={formatDA(COD_PENDING)} color={C.amber} />
            </div>
          </div>
        </ChartCard>

        <ChartCard t={t} title="Statut du COD collecté" icon={PieChart} sub={formatDA(COD_COLLECTED)}>
          <Donut
            t={t}
            data={COD_SPLIT}
            legend
            legendMoney
            centerValue={`${REMIT_RATE.toFixed(1)}%`}
            centerLabel="remis"
            size={168}
            thickness={26}
          />
        </ChartCard>

        <ChartCard t={t} title="Cycle de vie du COD" icon={Layers} sub={formatDA(COD_TOTAL)}>
          <SplitBar t={t} data={COD_LIFECYCLE} height={30} />
          <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            <MiniStat t={t} label="COD total" value={formatDA(COD_TOTAL)} />
            <MiniStat t={t} label="Collecté (remis + attente)" value={formatDA(COD_COLLECTED)} color={ORANGE} />
            <MiniStat t={t} label="Taux de collecte" value={`${COLLECT_RATE.toFixed(1)} %`} color={C.green} />
          </div>
        </ChartCard>
      </div>

      {/* ── 3. SANTÉ DE LA REMISE (strip) ────────────────────────────────────── */}
      <SectionTitle t={t} title="Santé de la remise" icon={CalendarClock} sub="délais & reversements" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 26 }}>
        <StatTile t={t} icon={Banknote} label="COD remis aux expéditeurs" value={formatDA(COD_REMITTED)} hint={`≈ ${REMIT_RATE.toFixed(1)} % du COD collecté`} accent={C.green} />
        <StatTile t={t} icon={Clock}    label="Délai moyen de remise"     value={`${AVG_REMIT_DELAY} j`} hint="SLA réseau : 3 j" accent={C.amber} />
        <StatTile t={t} icon={TrendingUp} label="Remise la plus rapide"   value={FASTEST_SD ? `${FASTEST_SD.delai} j` : "—"} hint={FASTEST_SD?.name} accent={C.green} />
        <StatTile t={t} icon={Timer}    label="Remise la plus lente"      value={SLOWEST_SD ? `${SLOWEST_SD.delai} j` : "—"} hint={SLOWEST_SD?.name} accent={C.red} />
      </div>

      {/* ── 4. ÉVOLUTION MENSUELLE ────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Évolution mensuelle" icon={BarChart3} sub="12 derniers mois" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="COD remis par mois" icon={Banknote} sub={`Pic : ${formatDA(REMIS_PEAK)} en ${REMIS_PEAK_MONTH}`}>
            <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
              <MiniStat t={t} label="Total remis" value={formatDA(REMIS_TOTAL)} color={C.green} />
              <MiniStat t={t} label="Moyenne / mois" value={formatDA(REMIS_AVG)} />
              <MiniStat t={t} label="Pic mensuel" value={`${formatDA(REMIS_PEAK)} (${REMIS_PEAK_MONTH})`} color={C.green} />
              <MiniStat t={t} label="Taux de remise" value={`${REMIT_RATE.toFixed(1)} %`} color={ORANGE} />
            </div>
            <AreaLine t={t} data={COD_REMIS_TREND} labels={MONTHS} color={C.green} suffix=" DA" height={230} />
          </ChartCard>
        </div>

        <ChartCard t={t} title="COD collecté par mois" icon={Coins} sub={`Pic : ${COLLECT_PEAK_MONTH}`}>
          <div style={{ display: "flex", gap: 18, marginBottom: 14, flexWrap: "wrap" }}>
            <MiniStat t={t} label="Total collecté" value={formatDA(COLLECT_TOTAL)} />
            <MiniStat t={t} label="Moyenne / mois" value={formatDA(COLLECT_AVG)} color={ORANGE} />
          </div>
          <VBars t={t} data={COD_TREND} labels={MONTHS} color={ORANGE} height={196} format={(v) => fmtCompact(v)} />
        </ChartCard>
      </div>

      {/* ── 5. COD PAR STOP DESK ──────────────────────────────────────────────── */}
      <SectionTitle t={t} title="COD par Stop Desk" icon={Building2} sub={`${COD_BY_SD.length} stop desks`} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 14 }}>
        <ChartCard t={t} title="Top Stop Desks — COD collecté" icon={HandCoins} sub="classement">
          <HBars t={t} data={TOP_SD_COLLECTED} money />
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard t={t} title="Détail COD — Stop Desks" icon={Building2} noPadding>
            <DataTable
              t={t}
              rows={COD_BY_SD}
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
                { header: "Collecté", align: "right", render: (s) => formatDA(s.collected) },
                { header: "Remis",    align: "right", render: (s) => <span style={{ color: C.green, fontWeight: 700 }}>{formatDA(s.remitted)}</span> },
                {
                  header: "En attente", align: "right",
                  render: (s) => <span style={{ color: s.pending > 0 ? C.amber : t.textSub, fontWeight: 700 }}>{formatDA(s.pending)}</span>,
                },
                { header: "Taux de remise", render: (s) => <ProgressCell t={t} value={s.remitRate} /> },
                {
                  header: "Délai", align: "right",
                  render: (s) => <span style={{ color: s.delai > 3 ? C.red : C.green, fontWeight: 700 }}>{s.delai} j</span>,
                },
              ]}
            />
            {/* Footer total row (reconciles with the KPI band: 38.54M / 31.82M / 6.72M). */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: `2px solid ${t.border}`, background: t.rowHover, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: t.textMuted }}>Total réseau</span>
              <span style={{ flex: 1 }} />
              <MiniStat t={t} label="Collecté" value={formatDA(SD_TOTALS.collected)} />
              <MiniStat t={t} label="Remis" value={formatDA(SD_TOTALS.remitted)} color={C.green} />
              <MiniStat t={t} label="En attente" value={formatDA(SD_TOTALS.pending)} color={C.amber} />
            </div>
          </ChartCard>
        </div>
      </div>

      {/* ── 6. COD PAR EXPÉDITEUR ─────────────────────────────────────────────── */}
      <SectionTitle t={t} title="COD par expéditeur" icon={Store} sub={`top ${COD_BY_MERCHANT.length} expéditeurs`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Recouvrement par expéditeur" icon={Store} noPadding>
          <DataTable
            t={t}
            rows={COD_BY_MERCHANT}
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
              { header: "COD collecté", align: "right", render: (m) => formatDA(m.collected) },
              { header: "COD remis",    align: "right", render: (m) => <span style={{ color: C.green, fontWeight: 700 }}>{formatDA(m.remitted)}</span> },
              {
                header: "En attente", align: "right",
                render: (m) => <span style={{ color: m.pending > 0 ? C.amber : t.textSub, fontWeight: 700 }}>{formatDA(m.pending)}</span>,
              },
              { header: "Taux de remise", render: (m) => <ProgressCell t={t} value={m.remitRate} /> },
            ]}
          />
        </ChartCard>
      </div>

      {/* ── 7. POINTS D'ATTENTION ─────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Points d'attention" icon={AlertTriangle} sub="lecture recouvrement" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {COD_NOTES.map((n, i) => (
          <CodNoteCard key={i} t={t} n={n} />
        ))}
      </div>
    </PageShell>
  );
}

/* ── Note card (local — uses tokens, no chart primitive duplicated) ──────────── */
function CodNoteCard({ t, n }: { t: Tokens; n: CodNote }) {
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
