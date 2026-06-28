"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT DES EXPÉDITEURS  (merchants report)
 *
 *  HARDCODED showcase — every figure is illustrative (Algerian e-commerce
 *  merchant network) and kept internally consistent:
 *    • 248 expéditeurs inscrits  ·  196 actifs (79.0 %)  ·  19 nouveaux ce mois
 *    • CA généré 9 660 000 DA  ·  taux retour moyen ≈ 6.6 %
 *    • Le tableau détaille les TOP 12 expéditeurs (≈ 62 % du CA réseau).
 *
 *  Reuses ONLY the shared primitives from `../_charts` (charts, cards, table,
 *  cells) and the design tokens from `../../_ui`. The base merchant rows come
 *  from the shared mock data in `../_data` (MERCHANTS); report-specific fields
 *  (wilaya, statut, libellé court) are layered on locally and every total is
 *  DERIVED (never re-typed by hand).
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Store, Users, UserCheck, UserPlus, TrendingUp, RotateCcw, Activity,
  Tags, MapPin, BarChart3, Coins, Trophy, Wallet, AlertTriangle,
  FileText, FileSpreadsheet, ShoppingBag, Percent, CalendarPlus, Layers,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, VBars, HBars, Donut, AreaLine, SplitBar,
  DataTable, ProgressCell, MoneyDelta, Badge,
  Segmented, SelectField, ExportButton,
  C, fmt, formatDA, rainbow, ORANGE, type Segment,
} from "../_charts";
import {
  MERCHANTS, MONTHS, PERIOD_OPTIONS, WILAYA_FILTER_OPTIONS, fmtCompact,
} from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  REPORT-SPECIFIC HARDCODED DATA
 *  Layered onto the shared MERCHANTS rows so name/category/colis/ca/retour/solde
 *  stay consistent with ../_data.
 * ════════════════════════════════════════════════════════════════════════ */

type ExpStatut = "Actif" | "Nouveau" | "Suspendu" | "Inactif";

interface ExpRow {
  name: string; category: string; colis: number; ca: number;
  retour: number; solde: number;
  wilaya: string; statut: ExpStatut; short: string;
}

/** Per-merchant extras (wilaya / statut / short axis label) keyed by name. */
const EXP_META: Record<string, { wilaya: string; statut: ExpStatut; short: string }> = {
  "Boutique Electronique": { wilaya: "Alger",       statut: "Actif",   short: "Boutique"   },
  "Mode Dz":               { wilaya: "Oran",        statut: "Actif",   short: "Mode Dz"    },
  "Cosmétique Plus":       { wilaya: "Alger",       statut: "Actif",   short: "Cosmét."    },
  "Tech Store DZ":         { wilaya: "Constantine", statut: "Actif",   short: "Tech Store" },
  "Maison & Déco":         { wilaya: "Blida",       statut: "Actif",   short: "Maison"     },
  "Sport Zone":            { wilaya: "Sétif",       statut: "Actif",   short: "Sport"      },
  "Bébé Confort":          { wilaya: "Alger",       statut: "Nouveau", short: "Bébé"       },
  "Parfum Élégance":       { wilaya: "Annaba",      statut: "Actif",   short: "Parfum"     },
};

/** 4 extra expéditeurs (full rows) to round the detailed list up to 12. */
const EXTRA_EXP: ExpRow[] = [
  { name: "Librairie El Ilm", category: "Livres",       colis: 680, ca: 244000, retour: 3.2, solde: 41000,  wilaya: "Tizi Ouzou", statut: "Actif",    short: "Librairie"  },
  { name: "Gadget Store",     category: "Électronique", colis: 540, ca: 198000, retour: 9.8, solde: -28000, wilaya: "Oran",       statut: "Suspendu", short: "Gadget"     },
  { name: "Halal Food DZ",    category: "Alimentation", colis: 460, ca: 152000, retour: 4.4, solde: 22000,  wilaya: "Béjaïa",     statut: "Nouveau",  short: "Halal Food" },
  { name: "Atelier Couture",  category: "Mode",         colis: 320, ca: 118000, retour: 6.7, solde: 14500,  wilaya: "Alger",      statut: "Inactif",  short: "Couture"    },
];

/** The enriched, fully-derived TOP-12 expéditeur rows used across the page. */
const EXP_ROWS: ExpRow[] = [
  ...MERCHANTS.map((m): ExpRow => {
    const meta = EXP_META[m.name] ?? { wilaya: "Alger", statut: "Actif" as ExpStatut, short: m.name };
    return { name: m.name, category: m.category, colis: m.colis, ca: m.ca, retour: m.retour, solde: m.solde, ...meta };
  }),
  ...EXTRA_EXP,
];

/* ── Derived TOP-12 totals (single source of truth for footnotes / side stats) ── */
const TOP_CA = EXP_ROWS.reduce((a, r) => a + r.ca, 0);                              // 5 988 000
const TOP_COLIS = EXP_ROWS.reduce((a, r) => a + r.colis, 0);                        // 16 800
const TOP_SOLDE = EXP_ROWS.reduce((a, r) => a + r.solde, 0);                        // 1 489 500
const TOP_RETOUR = EXP_ROWS.reduce((a, r) => a + r.colis * r.retour, 0) / TOP_COLIS; // 6.55 (pondéré)

/* ── Network-level headline figures (the whole expéditeur base) ──────────────── */
const NB_EXP = 248;
const ACTIFS = 196;
const NOUVEAUX_MOIS = 19;
const CA_GENERE = 9_660_000;
const TAUX_RETOUR_MOY = +TOP_RETOUR.toFixed(1);          // 6.6 %
const TAUX_ACTIVITE = (ACTIFS / NB_EXP) * 100;           // 79.0 %
const TOP_SHARE = (TOP_CA / CA_GENERE) * 100;            // 62.0 %
const CA_MOYEN = Math.round(CA_GENERE / NB_EXP);         // 38 952 DA

/** New sign-ups per month (∑ = 157 over the year, +91 base ⇒ 248 cumulés). */
const NEW_EXP_TREND = [8, 9, 11, 10, 13, 12, 14, 13, 15, 16, 17, 19];
const ACQUIS_ANNEE = NEW_EXP_TREND.reduce((a, b) => a + b, 0);                  // 157
const BEST_MONTH_IDX = NEW_EXP_TREND.indexOf(Math.max(...NEW_EXP_TREND));       // Déc

/* ── Network distribution donuts (counts, each ∑ = 248) ─────────────────────── */
const WILAYA_DIST: Segment[] = [
  { label: "Alger",       value: 78, color: rainbow(0) },
  { label: "Oran",        value: 42, color: rainbow(1) },
  { label: "Constantine", value: 28, color: rainbow(2) },
  { label: "Blida",       value: 22, color: rainbow(3) },
  { label: "Sétif",       value: 18, color: rainbow(4) },
  { label: "Annaba",      value: 14, color: rainbow(5) },
  { label: "Tizi Ouzou",  value: 12, color: rainbow(6) },
  { label: "Béjaïa",      value: 11, color: rainbow(7) },
  { label: "Tlemcen",     value: 9,  color: rainbow(8) },
  { label: "Ouargla",     value: 7,  color: rainbow(9) },
  { label: "Autres",      value: 7,  color: rainbow(10) },
];

const CAT_DIST: Segment[] = [
  { label: "Mode",         value: 64, color: rainbow(0) },
  { label: "Électronique", value: 52, color: rainbow(1) },
  { label: "Beauté",       value: 38, color: rainbow(2) },
  { label: "Maison",       value: 28, color: rainbow(3) },
  { label: "Alimentation", value: 22, color: rainbow(4) },
  { label: "Sport",        value: 18, color: rainbow(5) },
  { label: "Puériculture", value: 14, color: rainbow(6) },
  { label: "Livres",       value: 12, color: rainbow(7) },
];

/** Statut breakdown of the whole base (∑ = 248). */
const STATUT_SPLIT: Segment[] = [
  { label: "Actifs",    value: 196, color: C.green },
  { label: "Inactifs",  value: 34,  color: C.slate },
  { label: "Suspendus", value: 18,  color: C.red },
];

/* ── Chart series derived from the detailed rows ────────────────────────────── */
const BY_CA = [...EXP_ROWS].sort((a, b) => b.ca - a.ca);
const TOP10 = BY_CA.slice(0, 10);
const CA_DATA = TOP10.map((r) => r.ca);
const CA_LABELS = TOP10.map((r) => r.short);

const RETOUR_BY_EXP: Segment[] = [...EXP_ROWS]
  .sort((a, b) => b.retour - a.retour)
  .slice(0, 8)
  .map((r) => ({ label: r.name, value: r.retour, color: retourColor(r.retour) }));

const BY_RETOUR = [...EXP_ROWS].sort((a, b) => a.retour - b.retour);
const BEST_RETOUR = BY_RETOUR[0];
const WORST_RETOUR = BY_RETOUR[BY_RETOUR.length - 1];

/** Watch-list: high return rate, negative balance, or a non-running account. */
const WATCH = [...EXP_ROWS]
  .filter((r) => r.retour >= 8 || r.solde < 0 || r.statut === "Suspendu" || r.statut === "Inactif")
  .sort((a, b) => b.retour - a.retour);

const CAT_FILTER_OPTIONS = [
  "Toutes les catégories", "Mode", "Électronique", "Beauté", "Maison",
  "Alimentation", "Sport", "Puériculture", "Livres",
];

/* ── Headline KPIs (5 requested + 3 for depth) ──────────────────────────────── */
const EXP_KPIS = [
  { label: "Expéditeurs",         value: fmt(NB_EXP),                    icon: Users,      delta: 7.8,  goodWhenUp: true,  deltaSuffix: "%"    },
  { label: "Expéditeurs actifs",  value: fmt(ACTIFS),                    icon: UserCheck,  delta: 5.2,  goodWhenUp: true,  deltaSuffix: "%"    },
  { label: "Nouveaux ce mois",    value: fmt(NOUVEAUX_MOIS),             icon: UserPlus,   delta: 11.8, goodWhenUp: true,  deltaSuffix: "%"    },
  { label: "CA généré",           value: formatDA(CA_GENERE),            icon: TrendingUp, delta: 14.2, goodWhenUp: true,  deltaSuffix: "%"    },
  { label: "Taux retour moyen",   value: `${TAUX_RETOUR_MOY} %`,         icon: RotateCcw,  delta: -0.4, goodWhenUp: false, deltaSuffix: " pts" },
  { label: "Taux d'activité",     value: `${TAUX_ACTIVITE.toFixed(1)} %`, icon: Activity,  delta: 2.1,  goodWhenUp: true,  deltaSuffix: " pts" },
  { label: "Catégorie n°1",       value: "Mode",                         icon: Tags },
  { label: "Wilaya n°1",          value: "Alger",                        icon: MapPin },
] as const;

/* ── Colour helper (mirrors ProgressCell invert thresholds) ─────────────────── */
function retourColor(v: number): string {
  return v >= 8 ? C.red : v >= 5 ? C.amber : C.green;
}

const STATUT_COLOR: Record<ExpStatut, string> = {
  Actif: C.green, Nouveau: C.blue, Suspendu: C.red, Inactif: C.slate,
};

function watchMotif(r: ExpRow): string {
  if (r.statut === "Suspendu") return "Compte suspendu";
  if (r.statut === "Inactif") return "Compte inactif";
  if (r.solde < 0) return "Solde négatif";
  if (r.retour >= 8) return "Taux de retour élevé";
  return "—";
}

/* ════════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════════ */

export default function ExpediteursReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("mois");

  return (
    <PageShell t={t} maxWidth={1320}>
      {/* DEMO BANNER — at the very top, per spec */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={Store}
        title="Rapport des Expéditeurs"
        subtitle="Performance commerciale du réseau d'expéditeurs — acquisition, chiffre d'affaires, taux de retour, soldes et répartition géographique"
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
          <SelectField t={t} icon={MapPin} options={WILAYA_FILTER_OPTIONS} />
          <SelectField t={t} icon={Tags} options={CAT_FILTER_OPTIONS} />
        </div>
      </div>

      {/* ── 1. KPIs ─────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs clés des expéditeurs" icon={Activity} sub={`${fmt(NB_EXP)} expéditeurs · vs période précédente`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 13, marginBottom: 26 }}>
        {EXP_KPIS.map((k) => (
          <KpiCard
            key={k.label}
            t={t}
            label={k.label}
            value={k.value}
            icon={k.icon}
            delta={"delta" in k ? k.delta : undefined}
            goodWhenUp={"goodWhenUp" in k ? k.goodWhenUp : undefined}
            deltaSuffix={"deltaSuffix" in k ? k.deltaSuffix : undefined}
          />
        ))}
      </div>

      {/* ── 2. CA par expéditeur (Top 10) ───────────────────────────────── */}
      <SectionTitle t={t} title="Chiffre d'affaires par expéditeur" icon={BarChart3} sub="classement des 10 premiers contributeurs" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Top 10 expéditeurs par CA" icon={Trophy} sub={`${formatDA(TOP_CA)} cumulés`}>
            <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
              <MiniStat t={t} label="CA réseau" value={`${(CA_GENERE / 1_000_000).toFixed(2)} M DA`} />
              <MiniStat t={t} label="Top 10" value={`${(TOP_CA / 1_000_000).toFixed(2)} M DA`} color={ORANGE} />
              <MiniStat t={t} label="Leader" value={`${TOP10[0].short} · ${fmtCompact(TOP10[0].ca)}`} color={C.green} />
              <MiniStat t={t} label="Part du top 12" value={`${TOP_SHARE.toFixed(1)} %`} color={C.violet} />
            </div>
            <VBars t={t} data={CA_DATA} labels={CA_LABELS} color={ORANGE} height={210} format={fmtCompact} />
          </ChartCard>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "auto auto auto", gap: 14 }}>
          <StatTile t={t} icon={Coins} label="CA généré (réseau)" value={formatDA(CA_GENERE)} hint="12 derniers mois" accent={ORANGE} />
          <StatTile t={t} icon={Wallet} label="CA moyen / expéditeur" value={formatDA(CA_MOYEN)} hint={`sur ${fmt(NB_EXP)} expéditeurs`} accent={C.blue} />
          <StatTile t={t} icon={Trophy} label="Part du top 12" value={`${TOP_SHARE.toFixed(1)} %`} hint={`${formatDA(TOP_CA)} cumulés`} accent={C.violet} />
        </div>
      </div>

      {/* ── 3. Top expéditeurs — tableau détaillé ───────────────────────── */}
      <SectionTitle t={t} title="Top expéditeurs" icon={Trophy} sub="12 premiers · colis, CA, taux de retour, solde, statut" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} noPadding>
          <DataTable<ExpRow>
            t={t}
            rows={BY_CA}
            rowKey={(r) => r.name}
            columns={[
              {
                header: "Expéditeur",
                render: (r) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ShoppingBag size={14} color={ORANGE} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{`${r.category} · ${r.wilaya}`}</div>
                    </div>
                  </div>
                ),
              },
              { header: "Colis",       align: "right", render: (r) => fmt(r.colis) },
              { header: "CA",          align: "right", render: (r) => formatDA(r.ca) },
              { header: "Taux retour", align: "left", width: 150, render: (r) => <ProgressCell t={t} value={r.retour} max={15} invert /> },
              { header: "Solde",       align: "right", render: (r) => <MoneyDelta value={r.solde} /> },
              {
                header: "Statut", align: "center",
                render: (r) => <Badge color={STATUT_COLOR[r.statut]} bg={`${STATUT_COLOR[r.statut]}18`}>{r.statut}</Badge>,
              },
            ]}
          />
        </ChartCard>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, padding: "0 4px", fontSize: 11.5, color: t.textMuted }}>
          <span><strong style={{ color: t.text }}>{fmt(TOP_COLIS)}</strong> colis</span>
          <span><strong style={{ color: t.text }}>{formatDA(TOP_CA)}</strong> CA</span>
          <span><strong style={{ color: t.text }}>{TOP_RETOUR.toFixed(1)} %</strong> taux retour moyen</span>
          <span><strong style={{ color: t.text }}>{formatDA(TOP_SOLDE)}</strong> solde net à reverser</span>
          <span><strong style={{ color: t.text }}>{TOP_SHARE.toFixed(1)} %</strong> du CA réseau</span>
        </div>
      </div>

      {/* ── 4. Répartition du réseau (wilaya / catégorie / statut) ───────── */}
      <SectionTitle t={t} title="Répartition du réseau" icon={Layers} sub={`${fmt(NB_EXP)} expéditeurs par géographie & secteur`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
        <ChartCard t={t} title="Répartition par wilaya" icon={MapPin} sub={`${WILAYA_DIST.length} zones`}>
          <Donut t={t} data={WILAYA_DIST} legend centerValue={fmt(NB_EXP)} centerLabel="Expéditeurs" size={172} thickness={26} />
        </ChartCard>
        <ChartCard t={t} title="Répartition par catégorie" icon={Tags} sub={`${CAT_DIST.length} secteurs`}>
          <Donut t={t} data={CAT_DIST} legend centerValue={fmt(NB_EXP)} centerLabel="Expéditeurs" size={172} thickness={26} />
        </ChartCard>
      </div>
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Statut des comptes expéditeurs" icon={UserCheck} sub={`${TAUX_ACTIVITE.toFixed(1)} % actifs`}>
          <SplitBar t={t} data={STATUT_SPLIT} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.divider}` }}>
            <MiniStat t={t} label="Actifs" value={fmt(ACTIFS)} color={C.green} />
            <MiniStat t={t} label="Nouveaux ce mois" value={fmt(NOUVEAUX_MOIS)} color={C.blue} />
            <MiniStat t={t} label="Suspendus" value={fmt(18)} color={C.red} />
            <MiniStat t={t} label="Inactifs" value={fmt(34)} color={C.slate} />
          </div>
        </ChartCard>
      </div>

      {/* ── 5. Acquisition — nouveaux expéditeurs par mois ──────────────── */}
      <SectionTitle t={t} title="Acquisition d'expéditeurs" icon={CalendarPlus} sub="nouveaux inscrits par mois — 12 derniers mois" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Nouveaux expéditeurs par mois" icon={UserPlus} sub={`${fmt(ACQUIS_ANNEE)} sur l'année`}>
            <AreaLine t={t} data={NEW_EXP_TREND} labels={MONTHS} color={C.blue} suffix=" exp." height={240} />
          </ChartCard>
        </div>
        <div style={{ display: "grid", gridTemplateRows: "auto auto auto", gap: 14 }}>
          <StatTile t={t} icon={UserPlus} label="Acquis cette année" value={fmt(ACQUIS_ANNEE)} hint="nouveaux expéditeurs" accent={C.green} />
          <StatTile t={t} icon={CalendarPlus} label="Meilleur mois" value={`${MONTHS[BEST_MONTH_IDX]} · ${fmt(NEW_EXP_TREND[BEST_MONTH_IDX])}`} hint="pic d'inscriptions" accent={ORANGE} />
          <StatTile t={t} icon={Activity} label="Taux d'activité" value={`${TAUX_ACTIVITE.toFixed(1)} %`} hint={`${fmt(ACTIFS)} / ${fmt(NB_EXP)} actifs`} accent={C.blue} />
        </div>
      </div>

      {/* ── 6. Taux de retour par expéditeur ────────────────────────────── */}
      <SectionTitle t={t} title="Taux de retour par expéditeur" icon={Percent} sub="8 expéditeurs au plus fort taux de retour" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 26 }}>
        <div className="lg:col-span-2">
          <ChartCard t={t} title="Taux de retour" icon={RotateCcw} sub={`moyenne pondérée ${TAUX_RETOUR_MOY} %`}>
            <HBars t={t} data={RETOUR_BY_EXP} unit=" %" />
          </ChartCard>
        </div>
        <div style={{ display: "grid", gridTemplateRows: "auto auto auto", gap: 14 }}>
          <StatTile t={t} icon={UserCheck} label="Meilleur taux retour" value={`${BEST_RETOUR.retour} %`} hint={BEST_RETOUR.name} accent={C.green} />
          <StatTile t={t} icon={AlertTriangle} label="Plus fort taux retour" value={`${WORST_RETOUR.retour} %`} hint={WORST_RETOUR.name} accent={C.red} />
          <StatTile t={t} icon={RotateCcw} label="Taux retour moyen" value={`${TAUX_RETOUR_MOY} %`} hint="pondéré par volume colis" accent={ORANGE} />
        </div>
      </div>

      {/* ── 7. Expéditeurs à surveiller (2ᵉ table) ──────────────────────── */}
      <SectionTitle t={t} title="Expéditeurs à surveiller" icon={AlertTriangle} sub="retour élevé, solde négatif ou compte non actif" />
      <ChartCard t={t} noPadding>
        <DataTable<ExpRow>
          t={t}
          rows={WATCH}
          rowKey={(r) => r.name}
          empty="Aucun expéditeur à surveiller"
          columns={[
            {
              header: "Expéditeur",
              render: (r) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700, color: t.text }}>{r.name}</span>
                  <span style={{ fontSize: 11, color: t.textFaint }}>{`${r.category} · ${r.wilaya}`}</span>
                </div>
              ),
            },
            {
              header: "Motif",
              render: (r) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: t.textSub }}>
                  <AlertTriangle size={13} color={C.amber} /> {watchMotif(r)}
                </span>
              ),
            },
            { header: "Taux retour", align: "left", width: 150, render: (r) => <ProgressCell t={t} value={r.retour} max={15} invert /> },
            { header: "Solde",       align: "right", render: (r) => <MoneyDelta value={r.solde} /> },
            {
              header: "Statut", align: "center",
              render: (r) => <Badge color={STATUT_COLOR[r.statut]} bg={`${STATUT_COLOR[r.statut]}18`}>{r.statut}</Badge>,
            },
          ]}
        />
      </ChartCard>
    </PageShell>
  );
}
