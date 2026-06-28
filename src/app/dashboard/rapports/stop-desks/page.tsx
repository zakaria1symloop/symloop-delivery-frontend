"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT PAR STOP DESK  (report #8)
 *
 *  HARDCODED showcase — every figure is illustrative (Algerian Hub / Sub-SD
 *  network) and kept internally consistent:
 *    • 10 Stop Desks  ·  19 952 colis traités  ·  taux moyen ≈ 82.8 %
 *    • CA total 5 392 000 DA  ·  prélèvement total 684 000 DA  ·  effectif 63
 *
 *  Reuses ONLY the shared primitives from `../_charts` (charts, cards, table,
 *  cells) and the design tokens from `../_ui`. The base SD rows come from the
 *  shared mock data in `../_data`; report-specific fields (capacité, retours)
 *  are layered on locally and all totals are derived (never re-typed by hand).
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Building2, Package, Percent, Wallet, Clock, Users, Activity, TrendingUp,
  BarChart3, Trophy, Coins, MapPin, Layers, RotateCcw, Scale,
  Gauge as GaugeIcon, FileText, FileSpreadsheet,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, VBars, HBars, Donut, SplitBar,
  DataTable, ProgressCell, Pill, MoneyDelta, Badge,
  Segmented, SelectField, ExportButton,
  C, fmt, formatDA, rainbow, ORANGE, type Tokens, type Segment,
} from "../_charts";
import {
  STOP_DESKS, PERIOD_OPTIONS, SD_FILTER_OPTIONS, WILAYA_FILTER_OPTIONS,
} from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  REPORT-SPECIFIC HARDCODED DATA
 *  Layered onto the shared STOP_DESKS rows so name/wilaya/colis/taux/délai/ca/
 *  prel/solde/staff stay consistent with ../_data.
 * ════════════════════════════════════════════════════════════════════════ */

/** Per-SD extras: monthly retours (∑ = 894, matches global) + processing capacity. */
const SD_META: Record<string, { retours: number; capacite: number }> = {
  "Hub Alger":      { retours: 184, capacite: 6000 },
  "SD Oran Centre": { retours: 148, capacite: 3600 },
  "SD Constantine": { retours: 124, capacite: 3200 },
  "SD Bab El Oued": { retours: 94,  capacite: 2400 },
  "SD Blida":       { retours: 72,  capacite: 2200 },
  "SD El Hadjeb":   { retours: 64,  capacite: 1800 },
  "SD Annaba":      { retours: 88,  capacite: 1600 },
  "SD Sétif":       { retours: 38,  capacite: 1400 },
  "SD Béjaïa":      { retours: 42,  capacite: 1000 },
  "SD Batna":       { retours: 40,  capacite: 900 },
};

/** Short labels for the dense VBars / Donut axes. */
const SHORT: Record<string, string> = {
  "Hub Alger": "Alger", "SD Oran Centre": "Oran", "SD Constantine": "Const.",
  "SD Bab El Oued": "Bab Oued", "SD Blida": "Blida", "SD El Hadjeb": "Hadjeb",
  "SD Annaba": "Annaba", "SD Sétif": "Sétif", "SD Béjaïa": "Béjaïa", "SD Batna": "Batna",
};

/** The enriched, fully-derived per-SD rows used everywhere on the page. */
const SD_ROWS = STOP_DESKS.map((s) => {
  const m = SD_META[s.name] ?? { retours: 0, capacite: s.colis };
  return {
    ...s,
    ...m,
    short: SHORT[s.name] ?? s.name,
    retourRate: +((m.retours / s.colis) * 100).toFixed(1),
    charge: Math.round((s.colis / m.capacite) * 100),
  };
});
type SdRow = (typeof SD_ROWS)[number];

/* ── Derived network totals (single source of truth for KPIs + footnotes) ───── */
const NB_SD = SD_ROWS.length;
const COLIS_TOTAL = SD_ROWS.reduce((a, r) => a + r.colis, 0);          // 19 952
const CA_TOTAL = SD_ROWS.reduce((a, r) => a + r.ca, 0);               // 5 392 000
const PREL_TOTAL = SD_ROWS.reduce((a, r) => a + r.prel, 0);          // 684 000
const RETOURS_TOTAL = SD_ROWS.reduce((a, r) => a + r.retours, 0);     // 894
const STAFF_TOTAL = SD_ROWS.reduce((a, r) => a + r.staff, 0);        // 63
const CAP_TOTAL = SD_ROWS.reduce((a, r) => a + r.capacite, 0);       // 24 100
const SOLDE_NET = SD_ROWS.reduce((a, r) => a + r.solde, 0);          // 2 340 000
const TAUX_MOYEN = SD_ROWS.reduce((a, r) => a + r.colis * r.taux, 0) / COLIS_TOTAL; // 82.8
const DELAI_MOYEN = SD_ROWS.reduce((a, r) => a + r.colis * r.delai, 0) / COLIS_TOTAL; // 2.44
const CHARGE_MOYENNE = (COLIS_TOTAL / CAP_TOTAL) * 100;              // 82.8
const DEBITEURS = SD_ROWS.filter((r) => r.solde < 0).length;        // 3
const CREDITEURS = NB_SD - DEBITEURS;                                // 7
const SATURES = SD_ROWS.filter((r) => r.charge >= 90).length;       // 2

/* ── Colour helpers (mirror the ProgressCell thresholds for consistency) ────── */
const tauxColor = (v: number) => (v >= 85 ? C.green : v >= 78 ? C.amber : C.red);
const loadColor = (v: number) => (v >= 90 ? C.red : v >= 80 ? C.amber : C.green);

/* ── Headline KPIs (4 requested + 4 for depth) ──────────────────────────────── */
const SD_KPIS = [
  { label: "Stop Desks actifs",       value: fmt(NB_SD),                       icon: Building2,  delta: 1,    goodWhenUp: true,  deltaSuffix: " SD"  },
  { label: "Colis traités",           value: fmt(COLIS_TOTAL),                 icon: Package,    delta: 9.4,  goodWhenUp: true,  deltaSuffix: "%"    },
  { label: "Taux de livraison moyen", value: `${TAUX_MOYEN.toFixed(1)} %`,     icon: Percent,    delta: 1.4,  goodWhenUp: true,  deltaSuffix: " pts" },
  { label: "CA total Stop Desks",     value: formatDA(CA_TOTAL),               icon: TrendingUp, delta: 12.6, goodWhenUp: true,  deltaSuffix: "%"    },
  { label: "Prélèvement total",       value: formatDA(PREL_TOTAL),             icon: Wallet,     delta: 6.1,  goodWhenUp: true,  deltaSuffix: "%"    },
  { label: "Délai moyen réseau",      value: `${DELAI_MOYEN.toFixed(1)} j`,    icon: Clock,      delta: -0.2, goodWhenUp: false, deltaSuffix: " j"   },
  { label: "Effectif total",          value: fmt(STAFF_TOTAL),                 icon: Users,      delta: 3,    goodWhenUp: true,  deltaSuffix: " ag." },
  { label: "Taux de charge moyen",    value: `${CHARGE_MOYENNE.toFixed(1)} %`, icon: GaugeIcon,  delta: 3.5,  goodWhenUp: false, deltaSuffix: " pts" },
] as const;

/* ── Chart series (all derived from SD_ROWS) ────────────────────────────────── */
const BY_VOLUME = [...SD_ROWS].sort((a, b) => b.colis - a.colis);
const VOL_DATA = BY_VOLUME.map((s) => s.colis);
const VOL_LABELS = BY_VOLUME.map((s) => s.short);

const CA_BY_SD: Segment[] = [...SD_ROWS]
  .sort((a, b) => b.ca - a.ca)
  .map((s, i) => ({ label: s.short, value: s.ca, color: rainbow(i) }));

const TAUX_BY_SD: Segment[] = [...SD_ROWS]
  .sort((a, b) => b.taux - a.taux)
  .map((s) => ({ label: s.name, value: s.taux, color: tauxColor(s.taux) }));

/** Network capacity utilisation (charge vs free) for the SplitBar. */
const CHARGE_SPLIT: Segment[] = [
  { label: "Charge actuelle",       value: COLIS_TOTAL, color: ORANGE },
  { label: "Capacité disponible",   value: Math.max(CAP_TOTAL - COLIS_TOTAL, 0), color: C.slate },
];

/* ════════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════════ */

export default function StopDesksReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("30j");

  return (
    <PageShell t={t} maxWidth={1320}>
      {/* DEMO BANNER — at the very top, per spec */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Building2}
        title="Rapport par Stop Desk"
        subtitle="Performance détaillée du réseau Hub / Sub-SD — volumes, taux, délais, retours, finances et capacité"
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
          <SelectField t={t} icon={MapPin} options={WILAYA_FILTER_OPTIONS} />
        </div>
      </div>

      {/* ── 1. KPIs ─────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs clés du réseau" icon={Activity} sub={`${NB_SD} Stop Desks · vs période précédente`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 13, marginBottom: 26 }}>
        {SD_KPIS.map((k) => (
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

      {/* ── 2. Volume & chiffre d'affaires par SD ───────────────────────── */}
      <SectionTitle t={t} title="Volume & chiffre d'affaires" icon={BarChart3} sub="classement des Stop Desks" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Top Stop Desks par volume" icon={Trophy} sub={`${fmt(COLIS_TOTAL)} colis traités`}>
            <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
              <MiniStat t={t} label="Total réseau" value={fmt(COLIS_TOTAL)} />
              <MiniStat t={t} label="Moyenne / SD" value={fmt(Math.round(COLIS_TOTAL / NB_SD))} />
              <MiniStat t={t} label="Leader" value={`${BY_VOLUME[0].short} · ${fmt(BY_VOLUME[0].colis)}`} color={C.green} />
              <MiniStat t={t} label="Effectif" value={`${fmt(STAFF_TOTAL)} agents`} color={ORANGE} />
            </div>
            <VBars t={t} data={VOL_DATA} labels={VOL_LABELS} color={ORANGE} height={210} format={(v) => fmt(v)} />
          </ChartCard>
        </div>

        <ChartCard t={t} title="Répartition du CA par SD" icon={Coins} sub={formatDA(CA_TOTAL)}>
          <Donut t={t} data={CA_BY_SD} legend legendMoney centerValue={`${(CA_TOTAL / 1_000_000).toFixed(2)}M`} centerLabel="DA" size={168} thickness={26} />
        </ChartCard>
      </div>

      {/* ── 3. Tableau comparatif détaillé ──────────────────────────────── */}
      <SectionTitle t={t} title="Comparatif détaillé par Stop Desk" icon={Building2} sub={`${NB_SD} centres · indicateurs complets`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} noPadding>
          <DataTable<SdRow>
            t={t}
            rows={SD_ROWS}
            rowKey={(s) => s.name}
            columns={[
              {
                header: "Stop Desk",
                render: (s) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Building2 size={14} color={ORANGE} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{`${s.wilaya} · ${s.staff} agents`}</div>
                    </div>
                  </div>
                ),
              },
              { header: "Colis",        align: "right", render: (s) => fmt(s.colis) },
              { header: "Taux livr.",   align: "left", width: 150, render: (s) => <ProgressCell t={t} value={s.taux} /> },
              { header: "Délai moyen",  align: "right", render: (s) => `${s.delai.toFixed(1)} j` },
              {
                header: "Retours", align: "center",
                render: (s) => (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <Pill color={s.retourRate >= 6 ? C.red : s.retourRate >= 4 ? C.amber : C.green}>{s.retours}</Pill>
                    <span style={{ fontSize: 10, color: t.textFaint }}>{s.retourRate}%</span>
                  </div>
                ),
              },
              { header: "CA",           align: "right", render: (s) => formatDA(s.ca) },
              { header: "Prélèvement",  align: "right", render: (s) => formatDA(s.prel) },
              { header: "Charge / Capacité", align: "left", width: 160, render: (s) => <LoadCell t={t} charge={s.charge} colis={s.colis} capacite={s.capacite} /> },
            ]}
          />
        </ChartCard>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, padding: "0 4px", fontSize: 11.5, color: t.textMuted }}>
          <span><strong style={{ color: t.text }}>{fmt(COLIS_TOTAL)}</strong> colis</span>
          <span><strong style={{ color: t.text }}>{TAUX_MOYEN.toFixed(1)} %</strong> taux moyen</span>
          <span><strong style={{ color: t.text }}>{fmt(RETOURS_TOTAL)}</strong> retours</span>
          <span><strong style={{ color: t.text }}>{formatDA(CA_TOTAL)}</strong> CA</span>
          <span><strong style={{ color: t.text }}>{formatDA(PREL_TOTAL)}</strong> prélèvement</span>
        </div>
      </div>

      {/* ── 4. Taux de livraison par SD ──────────────────────────────────── */}
      <SectionTitle t={t} title="Taux de livraison par Stop Desk" icon={Percent} sub="classé du meilleur au plus faible" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Taux de livraison" icon={TrendingUp} sub={`moyenne réseau ${TAUX_MOYEN.toFixed(1)} %`}>
            <HBars t={t} data={TAUX_BY_SD} unit=" %" />
          </ChartCard>
        </div>
        <div style={{ display: "grid", gridTemplateRows: "auto auto auto", gap: 14 }}>
          <StatTile t={t} icon={TrendingUp} label="Meilleur taux" value={`${TAUX_BY_SD[0].value} %`} hint={TAUX_BY_SD[0].label} accent={C.green} />
          <StatTile t={t} icon={RotateCcw} label="Taux le plus faible" value={`${TAUX_BY_SD[TAUX_BY_SD.length - 1].value} %`} hint={TAUX_BY_SD[TAUX_BY_SD.length - 1].label} accent={C.red} />
          <StatTile t={t} icon={Clock} label="Délai moyen réseau" value={`${DELAI_MOYEN.toFixed(1)} j`} hint={`${RETOURS_TOTAL} retours sur la période`} accent={ORANGE} />
        </div>
      </div>

      {/* ── 5. Charge & capacité du réseau ──────────────────────────────── */}
      <SectionTitle t={t} title="Charge & capacité du réseau" icon={GaugeIcon} sub="taux d'occupation mensuel" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Occupation des Stop Desks" icon={Layers} sub={`${CHARGE_MOYENNE.toFixed(1)} % de la capacité`}>
          <SplitBar t={t} data={CHARGE_SPLIT} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.divider}` }}>
            <MiniStat t={t} label="Charge moyenne" value={`${CHARGE_MOYENNE.toFixed(1)} %`} color={loadColor(Math.round(CHARGE_MOYENNE))} />
            <MiniStat t={t} label="Capacité totale" value={`${fmt(CAP_TOTAL)} / mois`} />
            <MiniStat t={t} label="SD ≥ 90 % charge" value={fmt(SATURES)} color={C.red} />
            <MiniStat t={t} label="Marge disponible" value={fmt(Math.max(CAP_TOTAL - COLIS_TOTAL, 0))} color={C.green} />
          </div>
        </ChartCard>
      </div>

      {/* ── 6. Soldes & prélèvements par SD (2ᵉ table) ──────────────────── */}
      <SectionTitle t={t} title="Soldes & prélèvements par Stop Desk" icon={Scale} sub={`solde net ${formatDA(SOLDE_NET)}`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
        <StatTile t={t} icon={Wallet} label="Solde net du réseau" value={formatDA(SOLDE_NET)} hint="après prélèvements & remises" accent={C.green} />
        <StatTile t={t} icon={Coins} label="Prélèvement total" value={formatDA(PREL_TOTAL)} hint={`sur ${fmt(COLIS_TOTAL)} colis`} accent={ORANGE} />
        <StatTile t={t} icon={TrendingUp} label="SD créditeurs" value={fmt(CREDITEURS)} hint="solde positif (nous leur devons)" accent={C.green} />
        <StatTile t={t} icon={RotateCcw} label="SD débiteurs" value={fmt(DEBITEURS)} hint="solde négatif (ils nous doivent)" accent={C.red} />
      </div>
      <ChartCard t={t} noPadding>
        <DataTable<SdRow>
          t={t}
          rows={[...SD_ROWS].sort((a, b) => b.solde - a.solde)}
          rowKey={(s) => s.name}
          columns={[
            {
              header: "Stop Desk",
              render: (s) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700, color: t.text }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: t.textFaint }}>{s.wilaya}</span>
                </div>
              ),
            },
            { header: "CA",          align: "right", render: (s) => formatDA(s.ca) },
            { header: "Prélèvement", align: "right", render: (s) => formatDA(s.prel) },
            { header: "Solde",       align: "right", render: (s) => <MoneyDelta value={s.solde} /> },
            {
              header: "Statut", align: "center",
              render: (s) => (s.solde >= 0
                ? <Badge color={C.green} bg={`${C.green}18`}>Créditeur</Badge>
                : <Badge color={C.red} bg={`${C.red}18`}>Débiteur</Badge>),
            },
          ]}
        />
      </ChartCard>
    </PageShell>
  );
}

/* ── Local cell: charge / capacité utilisation bar (report-specific, not a
 *  duplicated chart primitive — visualises each SD's colis vs its capacity). ─── */
function LoadCell({ t, charge, colis, capacite }: { t: Tokens; charge: number; colis: number; capacite: number }) {
  const pct = Math.min(charge, 100);
  const color = loadColor(charge);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 130 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: t.textFaint, fontVariantNumeric: "tabular-nums" }}>{fmt(colis)} / {fmt(capacite)}</span>
        <span style={{ fontWeight: 800, color }}>{charge}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: t.divider, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}
