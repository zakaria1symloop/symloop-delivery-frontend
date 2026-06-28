"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT GÉOGRAPHIQUE  (report #11)
 *
 *  HARDCODED showcase of the network's geographic footprint across Algeria —
 *  every figure is illustrative and kept internally consistent:
 *    • 14 wilayas détaillées (top par volume)  ·  4 régions actives
 *    • Totaux colis / livrés / CA / délai dérivés des lignes WILAYAS (../_data)
 *    • Heatmap, classements et répartition régionale tous calculés (jamais ressaisis)
 *
 *  Reuses ONLY the shared primitives from `../_charts` (charts, cards, table,
 *  cells) and the design tokens from `../_ui`. The base wilaya rows come from the
 *  shared mock data in `../_data`; report-specific fields (région, délai, communes
 *  desservies, top communes) are layered on locally and every total is derived.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Map, MapPin, Globe, Building2, Layers, Percent, Package, TrendingUp,
  Trophy, BarChart3, Clock, LayoutGrid, PieChart, Crown, Navigation,
  Compass, Activity, FileText, FileSpreadsheet,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, HBars, Donut, DataTable, ProgressCell, Pill, Badge,
  Segmented, SelectField, ExportButton,
  C, fmt, formatDA, rainbow, ORANGE, type Tokens, type Segment,
} from "../_charts";
import { WILAYAS, PERIOD_OPTIONS, WILAYA_FILTER_OPTIONS } from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  REPORT-SPECIFIC HARDCODED DATA
 *  Layered onto the shared WILAYAS rows so code/name/colis/livres/retours/taux/
 *  ca/communes stay consistent with ../_data. Region / délai / communes
 *  desservies are added here and every aggregate below is DERIVED.
 * ════════════════════════════════════════════════════════════════════════ */

type Region = "Centre" | "Est" | "Ouest" | "Sud";

const REGION_COLOR: Record<Region, string> = {
  Centre: C.orange,
  Est: C.blue,
  Ouest: C.violet,
  Sud: C.amber,
};

/** Per-wilaya extras (région, délai moyen en j, communes effectivement desservies). */
const WILAYA_META: Record<number, { region: Region; delai: number; communesServed: number }> = {
  16: { region: "Centre", delai: 1.9, communesServed: 57 }, // Alger
  31: { region: "Ouest",  delai: 2.4, communesServed: 26 }, // Oran
  25: { region: "Est",    delai: 2.7, communesServed: 12 }, // Constantine
  9:  { region: "Centre", delai: 2.0, communesServed: 25 }, // Blida
  19: { region: "Est",    delai: 2.3, communesServed: 38 }, // Sétif
  23: { region: "Est",    delai: 2.8, communesServed: 12 }, // Annaba
  5:  { region: "Est",    delai: 2.9, communesServed: 24 }, // Batna
  15: { region: "Centre", delai: 2.2, communesServed: 31 }, // Tizi Ouzou
  6:  { region: "Centre", delai: 2.6, communesServed: 28 }, // Béjaïa
  30: { region: "Sud",    delai: 3.4, communesServed: 14 }, // Ouargla
  13: { region: "Ouest",  delai: 2.7, communesServed: 22 }, // Tlemcen
  17: { region: "Sud",    delai: 3.0, communesServed: 16 }, // Djelfa
  21: { region: "Est",    delai: 2.6, communesServed: 20 }, // Skikda
  7:  { region: "Sud",    delai: 3.1, communesServed: 18 }, // Biskra
};

/** Enriched, fully-derived per-wilaya rows used everywhere on the page. */
const W_ROWS = WILAYAS.map((w) => {
  const m = WILAYA_META[w.code] ?? { region: "Centre" as Region, delai: 2.5, communesServed: w.communes };
  return {
    ...w,
    ...m,
    retourRate: +((w.retours / w.colis) * 100).toFixed(1),
    coverage: Math.round((m.communesServed / w.communes) * 100),
  };
});
type WRow = (typeof W_ROWS)[number];

/* ── National coverage frame (Algeria = 58 wilayas / 1541 communes) ──────────── */
const WILAYAS_TOTAL_DZ = 58;
const COMMUNES_TOTAL_DZ = 1541;

/* ── Derived national totals (single source of truth for KPIs + footnotes) ───── */
const NB_WILAYAS = W_ROWS.length;                                              // 14
const TOTAL_COLIS = W_ROWS.reduce((a, r) => a + r.colis, 0);
const TOTAL_LIVRES = W_ROWS.reduce((a, r) => a + r.livres, 0);
const TOTAL_RETOURS = W_ROWS.reduce((a, r) => a + r.retours, 0);
const TOTAL_CA = W_ROWS.reduce((a, r) => a + r.ca, 0);
const COMMUNES_SERVED = W_ROWS.reduce((a, r) => a + r.communesServed, 0);
const TAUX_NATIONAL = (TOTAL_LIVRES / TOTAL_COLIS) * 100;
const DELAI_NATIONAL = W_ROWS.reduce((a, r) => a + r.colis * r.delai, 0) / TOTAL_COLIS;
const TOP_WILAYA = [...W_ROWS].sort((a, b) => b.colis - a.colis)[0];

/* ── Colour helpers (mirror the ProgressCell thresholds for consistency) ─────── */
const tauxColor = (v: number) => (v >= 85 ? C.green : v >= 78 ? C.amber : C.red);

/* ── Headline KPIs (4 requested + 4 for depth) ───────────────────────────────── */
const GEO_KPIS = [
  { label: "Wilayas couvertes",     value: `${fmt(NB_WILAYAS)} / ${WILAYAS_TOTAL_DZ}`,        icon: Map,        delta: 2,    goodWhenUp: true,  deltaSuffix: " wil." },
  { label: "Communes desservies",   value: fmt(COMMUNES_SERVED),                              icon: MapPin,     delta: 5.4,  goodWhenUp: true,  deltaSuffix: "%"     },
  { label: "Top wilaya",            value: `${TOP_WILAYA.name} · ${fmt(TOP_WILAYA.colis)}`,   icon: Crown,      delta: 11.2, goodWhenUp: true,  deltaSuffix: "%"     },
  { label: "Taux livraison national", value: `${TAUX_NATIONAL.toFixed(1)} %`,                 icon: Percent,    delta: 1.4,  goodWhenUp: true,  deltaSuffix: " pts"  },
  { label: "Total colis (couverture)", value: fmt(TOTAL_COLIS),                               icon: Package,    delta: 12.4, goodWhenUp: true,  deltaSuffix: "%"     },
  { label: "CA national",           value: formatDA(TOTAL_CA),                                icon: TrendingUp, delta: 13.8, goodWhenUp: true,  deltaSuffix: "%"     },
  { label: "Délai moyen national",  value: `${DELAI_NATIONAL.toFixed(1)} j`,                  icon: Clock,      delta: -0.2, goodWhenUp: false, deltaSuffix: " j"    },
  { label: "Régions actives",       value: `4 / 4`,                                           icon: Compass,    delta: 0,    goodWhenUp: true,  deltaSuffix: ""      },
] as const;

/* ── Chart series (all derived from W_ROWS) ──────────────────────────────────── */
const TOP10_COLIS: Segment[] = [...W_ROWS]
  .sort((a, b) => b.colis - a.colis)
  .slice(0, 10)
  .map((w, i) => ({ label: w.name, value: w.colis, color: rainbow(i) }));

/** Volume par région (Centre / Est / Ouest / Sud) for the Donut. */
const REGION_ORDER: Region[] = ["Centre", "Est", "Ouest", "Sud"];
const BY_REGION: Segment[] = REGION_ORDER.map((reg) => ({
  label: reg,
  value: W_ROWS.filter((w) => w.region === reg).reduce((a, w) => a + w.colis, 0),
  color: REGION_COLOR[reg],
}));

/** Per-region rollup for the small region strip (colis, wilayas, taux pondéré). */
const REGION_STATS = REGION_ORDER.map((reg) => {
  const rows = W_ROWS.filter((w) => w.region === reg);
  const colis = rows.reduce((a, w) => a + w.colis, 0);
  const livres = rows.reduce((a, w) => a + w.livres, 0);
  return { region: reg, color: REGION_COLOR[reg], wilayas: rows.length, colis, taux: (livres / colis) * 100 };
});

/* ── Heatmap source (sorted by volume so the grid reads hot → cool) ──────────── */
const HEAT = [...W_ROWS].sort((a, b) => b.colis - a.colis);
const HEAT_MAX = Math.max(...HEAT.map((w) => w.colis));
const HEAT_MIN = Math.min(...HEAT.map((w) => w.colis));

/* ── Top communes (report-specific, plausible, within covered wilayas) ───────── */
interface CommuneRow { name: string; wilaya: string; region: Region; colis: number; taux: number; }
const TOP_COMMUNES: CommuneRow[] = [
  { name: "Bab El Oued",      wilaya: "Alger",       region: "Centre", colis: 1240, taux: 86 },
  { name: "Bir Mourad Raïs",  wilaya: "Alger",       region: "Centre", colis: 980,  taux: 88 },
  { name: "Es Sénia",         wilaya: "Oran",        region: "Ouest",  colis: 760,  taux: 83 },
  { name: "Bir El Djir",      wilaya: "Oran",        region: "Ouest",  colis: 690,  taux: 82 },
  { name: "El Khroub",        wilaya: "Constantine", region: "Est",    colis: 612,  taux: 80 },
  { name: "El Eulma",         wilaya: "Sétif",       region: "Est",    colis: 540,  taux: 85 },
  { name: "Ouled Yaïch",      wilaya: "Blida",       region: "Centre", colis: 498,  taux: 85 },
  { name: "Akbou",            wilaya: "Béjaïa",      region: "Centre", colis: 412,  taux: 81 },
  { name: "Aïn Smara",        wilaya: "Constantine", region: "Est",    colis: 368,  taux: 79 },
  { name: "Draâ Ben Khedda",  wilaya: "Tizi Ouzou",  region: "Centre", colis: 324,  taux: 84 },
];

/* ════════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════════ */

export default function GeographieReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("30j");

  return (
    <PageShell t={t} maxWidth={1320}>
      {/* DEMO BANNER — at the very top, per spec */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Globe}
        title="Rapport Géographique"
        subtitle="Couverture nationale du réseau — volumes, taux, délais et chiffre d'affaires par wilaya, commune et région"
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
          <SelectField t={t} icon={Compass} options={["Toutes les régions", "Centre", "Est", "Ouest", "Sud"]} />
          <SelectField t={t} icon={MapPin} options={WILAYA_FILTER_OPTIONS} />
        </div>
      </div>

      {/* ── 1. KPIs ─────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs géographiques clés" icon={Activity} sub={`${NB_WILAYAS} wilayas détaillées · vs période précédente`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 13, marginBottom: 26 }}>
        {GEO_KPIS.map((k) => (
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

      {/* ── 2. Volume par wilaya (Top 10) + répartition par région ──────── */}
      <SectionTitle t={t} title="Volume & répartition régionale" icon={BarChart3} sub="classement des wilayas" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Colis par wilaya — Top 10" icon={Trophy} sub={`${fmt(TOTAL_COLIS)} colis sur la couverture`}>
            <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
              <MiniStat t={t} label="Total couverture" value={fmt(TOTAL_COLIS)} />
              <MiniStat t={t} label="Moyenne / wilaya" value={fmt(Math.round(TOTAL_COLIS / NB_WILAYAS))} />
              <MiniStat t={t} label="Leader" value={`${TOP_WILAYA.name} · ${fmt(TOP_WILAYA.colis)}`} color={C.green} />
              <MiniStat t={t} label="Communes desservies" value={fmt(COMMUNES_SERVED)} color={ORANGE} />
            </div>
            <HBars t={t} data={TOP10_COLIS} unit=" colis" />
          </ChartCard>
        </div>

        <ChartCard t={t} title="Répartition par région" icon={PieChart} sub={`${fmt(TOTAL_COLIS)} colis`}>
          <Donut t={t} data={BY_REGION} legend centerValue={fmt(TOTAL_COLIS)} centerLabel="colis" size={168} thickness={26} />
        </ChartCard>
      </div>

      {/* ── 3. Détail par wilaya (table principale) ─────────────────────── */}
      <SectionTitle t={t} title="Détail par wilaya" icon={MapPin} sub={`${NB_WILAYAS} wilayas · indicateurs complets`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} noPadding>
          <DataTable<WRow>
            t={t}
            rows={[...W_ROWS].sort((a, b) => b.colis - a.colis)}
            rowKey={(w) => w.code}
            columns={[
              {
                header: "Wilaya",
                render: (w, i) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Pill color={ORANGE}>{i + 1}</Pill>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{`Code ${w.code} · ${w.region}`}</div>
                    </div>
                  </div>
                ),
              },
              {
                header: "Région", align: "center",
                render: (w) => <Badge color={REGION_COLOR[w.region]} bg={`${REGION_COLOR[w.region]}18`}>{w.region}</Badge>,
              },
              { header: "Colis",   align: "right", render: (w) => fmt(w.colis) },
              { header: "Livrés",  align: "right", render: (w) => fmt(w.livres) },
              { header: "Taux livr.", align: "left", width: 150, render: (w) => <ProgressCell t={t} value={w.taux} /> },
              { header: "Délai",   align: "right", render: (w) => `${w.delai.toFixed(1)} j` },
              {
                header: "Retours", align: "center",
                render: (w) => (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <Pill color={w.retourRate >= 6 ? C.red : w.retourRate >= 4 ? C.amber : C.green}>{w.retours}</Pill>
                    <span style={{ fontSize: 10, color: t.textFaint }}>{w.retourRate}%</span>
                  </div>
                ),
              },
              { header: "Communes", align: "left", width: 150, render: (w) => <CoverageCell t={t} served={w.communesServed} total={w.communes} pct={w.coverage} /> },
              { header: "CA",      align: "right", render: (w) => formatDA(w.ca) },
            ]}
          />
        </ChartCard>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, padding: "0 4px", fontSize: 11.5, color: t.textMuted }}>
          <span><strong style={{ color: t.text }}>{fmt(TOTAL_COLIS)}</strong> colis</span>
          <span><strong style={{ color: t.text }}>{fmt(TOTAL_LIVRES)}</strong> livrés</span>
          <span><strong style={{ color: t.text }}>{TAUX_NATIONAL.toFixed(1)} %</strong> taux national</span>
          <span><strong style={{ color: t.text }}>{DELAI_NATIONAL.toFixed(1)} j</strong> délai moyen</span>
          <span><strong style={{ color: t.text }}>{fmt(TOTAL_RETOURS)}</strong> retours</span>
          <span><strong style={{ color: t.text }}>{fmt(COMMUNES_SERVED)}</strong> communes desservies</span>
          <span><strong style={{ color: t.text }}>{formatDA(TOTAL_CA)}</strong> CA</span>
        </div>
      </div>

      {/* ── 4. Heatmap des wilayas par volume ───────────────────────────── */}
      <SectionTitle t={t} title="Carte de chaleur — volume par wilaya" icon={LayoutGrid} sub="intensité proportionnelle au nombre de colis" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard
          t={t}
          title="Densité de colis par wilaya"
          icon={Map}
          action={<HeatScale t={t} min={HEAT_MIN} max={HEAT_MAX} />}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {HEAT.map((w) => (
              <HeatTile key={w.code} t={t} isDark={isDark} w={w} max={HEAT_MAX} />
            ))}
          </div>
        </ChartCard>
      </div>

      {/* ── 5. Top communes + synthèse régionale ────────────────────────── */}
      <SectionTitle t={t} title="Communes & régions" icon={Navigation} sub="zones les plus actives" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Top communes par volume" icon={Building2} noPadding>
            <DataTable<CommuneRow>
              t={t}
              rows={TOP_COMMUNES}
              rowKey={(c) => `${c.wilaya}-${c.name}`}
              columns={[
                {
                  header: "Commune",
                  render: (c, i) => (
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Pill color={REGION_COLOR[c.region]}>{i + 1}</Pill>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: t.text }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>{`${c.wilaya} · ${c.region}`}</div>
                      </div>
                    </div>
                  ),
                },
                { header: "Colis", align: "right", render: (c) => fmt(c.colis) },
                { header: "Taux livr.", align: "left", width: 150, render: (c) => <ProgressCell t={t} value={c.taux} /> },
              ]}
            />
          </ChartCard>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StatTile t={t} icon={Crown} label="Région leader" value={REGION_STATS[0].region} hint={`${fmt(REGION_STATS[0].colis)} colis · ${REGION_STATS[0].wilayas} wilayas`} accent={REGION_COLOR[REGION_STATS[0].region]} />
          <StatTile t={t} icon={Globe} label="Couverture nationale" value={`${Math.round((NB_WILAYAS / WILAYAS_TOTAL_DZ) * 100)} %`} hint={`${NB_WILAYAS} / ${WILAYAS_TOTAL_DZ} wilayas · ${fmt(COMMUNES_SERVED)} / ${fmt(COMMUNES_TOTAL_DZ)} communes`} accent={ORANGE} />
          <StatTile t={t} icon={Percent} label="Taux livraison national" value={`${TAUX_NATIONAL.toFixed(1)} %`} hint={`${fmt(TOTAL_LIVRES)} colis livrés sur ${fmt(TOTAL_COLIS)}`} accent={C.green} />
        </div>
      </div>

      {/* ── 6. Synthèse par région (mini-strip) ─────────────────────────── */}
      <SectionTitle t={t} title="Synthèse par région" icon={Layers} sub="Centre · Est · Ouest · Sud" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {REGION_STATS.map((r) => (
          <div key={r.region} style={{ background: t.card, borderRadius: 13, border: `1px solid ${t.border}`, boxShadow: t.shadow, padding: "14px 15px", borderLeft: `3px solid ${r.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{r.region}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: t.textMuted }}>{r.wilayas} wilayas</span>
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmt(r.colis)}</div>
            <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 10 }}>colis · {((r.colis / TOTAL_COLIS) * 100).toFixed(1)} % du réseau</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>Taux de livraison</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: tauxColor(r.taux) }}>{r.taux.toFixed(1)} %</span>
            </div>
            <div style={{ height: 7, borderRadius: 99, background: t.divider, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(r.taux, 100)}%`, background: tauxColor(r.taux), borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  LOCAL CELLS / TILES  (report-specific — not duplicated chart primitives)
 * ════════════════════════════════════════════════════════════════════════════ */

/** In-cell communes coverage: "served / total" + percent bar. */
function CoverageCell({ t, served, total, pct }: { t: Tokens; served: number; total: number; pct: number }) {
  const color = pct >= 70 ? C.green : pct >= 45 ? C.amber : C.red;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: t.textFaint, fontVariantNumeric: "tabular-nums" }}>{fmt(served)} / {fmt(total)}</span>
        <span style={{ fontWeight: 800, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: t.divider, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

/** A single wilaya tile in the CSS-grid heatmap, tinted by colis intensity. */
function HeatTile({ t, isDark, w, max }: { t: Tokens; isDark: boolean; w: WRow; max: number }) {
  const intensity = w.colis / max;                       // 0 … 1
  const alpha = 0.1 + intensity * 0.78;                  // tile fill strength
  const hot = intensity >= 0.5;
  const fill = `rgba(249, 115, 22, ${alpha.toFixed(3)})`;
  const titleColor = hot ? "#ffffff" : t.text;
  const subColor = hot ? "rgba(255,255,255,0.85)" : t.textMuted;
  return (
    <div
      title={`${w.name} — ${fmt(w.colis)} colis · taux ${w.taux} %`}
      style={{
        position: "relative", borderRadius: 11, padding: "12px 13px",
        background: fill,
        border: `1px solid ${hot ? "transparent" : (isDark ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.22)")}`,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: titleColor }}>{w.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: subColor, fontVariantNumeric: "tabular-nums" }}>{w.code}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: titleColor, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmt(w.colis)}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10.5, color: subColor }}>colis</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: titleColor }}>{w.taux} %</span>
      </div>
    </div>
  );
}

/** Compact gradient legend shown in the heatmap card header. */
function HeatScale({ t, min, max }: { t: Tokens; min: number; max: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontSize: 10.5, color: t.textFaint, fontVariantNumeric: "tabular-nums" }}>{fmt(min)}</span>
      <span style={{ width: 96, height: 8, borderRadius: 99, background: "linear-gradient(90deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.88) 100%)" }} />
      <span style={{ fontSize: 10.5, color: t.textFaint, fontVariantNumeric: "tabular-nums" }}>{fmt(max)}</span>
    </span>
  );
}
