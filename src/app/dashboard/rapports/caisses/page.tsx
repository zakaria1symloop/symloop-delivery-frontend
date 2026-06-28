"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT DES CAISSES  (trésorerie & soldes inter-caisses)
 *
 *  HARDCODED showcase page. Every figure is illustrative (Algerian delivery
 *  network) and internally consistent. No API calls. All charts/tables are drawn
 *  with the shared primitives in `./_charts` — nothing here re-implements a chart.
 *
 *  ── Internal-consistency anchors (current period) ──────────────────────────
 *    • Caisse globale ......... 8 640 000 DA   (= Siège + Caisses SD + En transit)
 *        - Caisse Siège ....... 2 600 000 DA
 *        - Caisses SD (Σ) ..... 4 860 000 DA   (= Σ SD_CAISSES.encaisse)
 *        - En transit ......... 1 180 000 DA   (= Σ transferts « En transit »)
 *    • SD nous doivent ........ 2 668 000 DA   (= Σ soldes positifs des SD)
 *    • Nous devons aux SD .....   328 000 DA   (= Σ |soldes négatifs| des SD)
 *    • Solde net SD ........... 2 340 000 DA   (= créances − dettes)
 *    • Soldes par SD réutilisés depuis STOP_DESKS (./_data) → la table, les
 *      cartes « owing » et les KPIs partagent la même source.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Wallet, Building2, Landmark,
  Repeat, ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Scale, Truck,
  FileText, FileSpreadsheet, CalendarDays, ListFilter, MapPin, CircleDollarSign,
  Send, PiggyBank,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, MiniStat, Donut, HBars, AreaLine, SplitBar,
  DataTable, MoneyDelta, Badge, ExportButton, Segmented, SelectField,
  C, fmt, formatDA, type Segment,
} from "../_charts";
import {
  STOP_DESKS, CAISSE_SUMMARY, COD_TREND, MONTHS,
  SD_FILTER_OPTIONS, WILAYA_FILTER_OPTIONS, PERIOD_OPTIONS,
} from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  LOCAL HARDCODED DATA  (specific to the cash / caisses report)
 * ════════════════════════════════════════════════════════════════════════ */

/** Top-level cash position — reuse the shared global, split locally so the
 *  composition reconciles exactly to it. */
const CAISSE_GLOBALE = CAISSE_SUMMARY.global;   // 8 640 000 DA (from ./_data)
const CAISSE_SIEGE   = 2_600_000;               // central HQ till
const EN_TRANSIT     = 1_180_000;               // = Σ transferts « En transit » (see TRANSFERS)

/** Per-SD caisse movements (this period) keyed by Stop-Desk name.
 *  `encaisse` = cash on hand in the till — Σ = 4 860 000 DA = "Total caisses SD". */
const SD_MOVEMENTS: Record<string, { encaisse: number; entrees: number; sorties: number }> = {
  "Hub Alger":      { encaisse: 1_280_000, entrees: 1_840_000, sorties: 1_620_000 },
  "SD Oran Centre": { encaisse:   720_000, entrees:   980_000, sorties:   840_000 },
  "SD Constantine": { encaisse:   560_000, entrees:   760_000, sorties:   690_000 },
  "SD Bab El Oued": { encaisse:   540_000, entrees:   720_000, sorties:   612_000 },
  "SD Blida":       { encaisse:   460_000, entrees:   640_000, sorties:   498_000 },
  "SD El Hadjeb":   { encaisse:   360_000, entrees:   510_000, sorties:   410_000 },
  "SD Annaba":      { encaisse:   300_000, entrees:   410_000, sorties:   360_000 },
  "SD Sétif":       { encaisse:   240_000, entrees:   340_000, sorties:   268_000 },
  "SD Béjaïa":      { encaisse:   220_000, entrees:   280_000, sorties:   220_000 },
  "SD Batna":       { encaisse:   180_000, entrees:   230_000, sorties:   196_000 },
};

/** Combined per-SD caisse rows. `solde` (owing) is reused from STOP_DESKS so the
 *  table, the owing cards and the KPIs all share one source of truth. */
const SD_CAISSES = STOP_DESKS.map((s) => ({
  name: s.name,
  wilaya: s.wilaya,
  solde: s.solde,
  ...SD_MOVEMENTS[s.name],
}));

/* Derived owing totals (computed → guaranteed consistent with the table). */
const SD_OWE_US = SD_CAISSES.filter((s) => s.solde > 0).reduce((a, s) => a + s.solde, 0);   // 2 668 000
const WE_OWE_SD = Math.abs(SD_CAISSES.filter((s) => s.solde < 0).reduce((a, s) => a + s.solde, 0)); // 328 000
const NET_SD    = SD_OWE_US - WE_OWE_SD;                                                     // 2 340 000
const TOTAL_SD_ENCAISSE = SD_CAISSES.reduce((a, s) => a + s.encaisse, 0);                    // 4 860 000

/** Composition de la caisse globale (Σ = CAISSE_GLOBALE). */
const CAISSE_COMPOSITION: Segment[] = [
  { label: "Caisse Siège", value: CAISSE_SIEGE,        color: C.violet },
  { label: "Caisses SD",   value: TOTAL_SD_ENCAISSE,   color: C.orange },
  { label: "En transit",   value: EN_TRANSIT,          color: C.blue },
];

/** Mouvements de caisse — 12 mois. Entrées = COD encaissé (réutilisé de ./_data). */
const CAISSE_ENTREES = COD_TREND;
const CAISSE_SORTIES = [
  2_180_000, 2_420_000, 2_710_000, 2_860_000, 3_020_000, 3_180_000,
  3_290_000, 2_840_000, 3_010_000, 3_320_000, 3_580_000, 3_510_000,
];
const TOTAL_ENTREES = CAISSE_ENTREES.reduce((a, v) => a + v, 0);   // 38 930 000
const TOTAL_SORTIES = CAISSE_SORTIES.reduce((a, v) => a + v, 0);   // 35 920 000
const FLUX_NET      = TOTAL_ENTREES - TOTAL_SORTIES;               //  3 010 000
const TAUX_ROTATION = (TOTAL_SORTIES / TOTAL_ENTREES) * 100;       //     92.3 %

/** Transactions de caisse par type (counts, Σ = 13 000). */
const TRANSACTION_TYPES: Segment[] = [
  { label: "Encaissement COD",      value: 6240, color: C.green },
  { label: "Frais encaissés",       value: 4120, color: C.blue },
  { label: "Remise expéditeur",     value: 1480, color: C.violet },
  { label: "Prélèvements",          value: 640,  color: C.amber },
  { label: "Transferts inter-caisses", value: 312, color: C.cyan },
  { label: "Charges / dépenses",    value: 208,  color: C.red },
];
const TOTAL_TX = TRANSACTION_TYPES.reduce((a, s) => a + s.value, 0);

/** Statut → badge palette for transfers. */
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  "Validé":     { color: C.green, bg: "rgba(22,163,74,0.12)" },
  "En transit": { color: C.blue,  bg: "rgba(59,130,246,0.12)" },
  "En attente": { color: C.amber, bg: "rgba(245,158,11,0.12)" },
};

/** Transferts récents inter-caisses. The three « En transit » rows sum to
 *  EN_TRANSIT (620k + 340k + 220k = 1 180 000 DA). */
const TRANSFERS = [
  { ref: "TRF-4821", from: "Hub Alger",      to: "Caisse Siège", montant: 620_000, date: "26 juin 2026", statut: "En transit" },
  { ref: "TRF-4820", from: "SD Oran Centre", to: "Caisse Siège", montant: 340_000, date: "26 juin 2026", statut: "En transit" },
  { ref: "TRF-4818", from: "SD Blida",       to: "Hub Alger",    montant: 220_000, date: "25 juin 2026", statut: "En transit" },
  { ref: "TRF-4815", from: "SD El Hadjeb",   to: "Caisse Siège", montant: 148_000, date: "25 juin 2026", statut: "Validé" },
  { ref: "TRF-4812", from: "SD Constantine", to: "Caisse Siège", montant: 180_000, date: "24 juin 2026", statut: "Validé" },
  { ref: "TRF-4809", from: "SD Bab El Oued", to: "Hub Alger",    montant: 142_000, date: "24 juin 2026", statut: "Validé" },
  { ref: "TRF-4806", from: "Caisse Siège",   to: "SD Annaba",    montant: 86_000,  date: "23 juin 2026", statut: "Validé" },
  { ref: "TRF-4803", from: "SD Sétif",       to: "Hub Alger",    montant: 96_000,  date: "23 juin 2026", statut: "En attente" },
  { ref: "TRF-4801", from: "Caisse Siège",   to: "SD Batna",     montant: 32_000,  date: "22 juin 2026", statut: "En attente" },
];

/* Owing breakdowns for the two summary cards (sorted by magnitude). */
const CREANCES: Segment[] = SD_CAISSES
  .filter((s) => s.solde > 0)
  .sort((a, b) => b.solde - a.solde)
  .map((s) => ({ label: s.name, value: s.solde, color: C.green }));

const DETTES: Segment[] = SD_CAISSES
  .filter((s) => s.solde < 0)
  .sort((a, b) => a.solde - b.solde)
  .map((s) => ({ label: s.name, value: Math.abs(s.solde), color: C.red }));

export default function RapportCaissesPage() {
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
        icon={Wallet}
        title="Rapport des Caisses"
        subtitle="Trésorerie globale, soldes par Stop Desk, mouvements et transferts inter-caisses — réseau de livraison (données illustratives)"
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
        <SelectField t={t} icon={ListFilter} options={["Toutes les caisses", "Caisse Siège", "Caisses SD", "En transit"]} />
      </div>

      {/* ═══ KPIs ═══ */}
      <SectionTitle t={t} title="Indicateurs clés des caisses" icon={Wallet} sub="période en cours" />
      <div style={gridStyle(210)}>
        <KpiCard t={t} label="Caisse globale"        value={formatDA(CAISSE_GLOBALE)} icon={Landmark}        delta={5.2}  goodWhenUp={true} />
        <KpiCard t={t} label="Total caisses SD"      value={formatDA(TOTAL_SD_ENCAISSE)} icon={Building2}    delta={3.8}  goodWhenUp={true} />
        <KpiCard t={t} label="SD nous doivent"       value={formatDA(SD_OWE_US)}      icon={ArrowDownLeft}   delta={4.2}  goodWhenUp={false} />
        <KpiCard t={t} label="Nous devons aux SD"    value={formatDA(WE_OWE_SD)}      icon={ArrowUpRight}    delta={-3.5} goodWhenUp={false} />
        <KpiCard t={t} label="En transit"            value={formatDA(EN_TRANSIT)}     icon={Truck}           delta={2.1}  goodWhenUp={false} />
        <KpiCard t={t} label="Caisse Siège"          value={formatDA(CAISSE_SIEGE)}   icon={PiggyBank}       delta={7.4}  goodWhenUp={true} />
      </div>

      {/* ═══ RÉPARTITION DE LA TRÉSORERIE ═══ */}
      <SectionTitle t={t} title="Répartition de la trésorerie" icon={CircleDollarSign} />
      <div style={gridStyle(360)}>
        <ChartCard t={t} title="Composition de la caisse globale" sub={formatDA(CAISSE_GLOBALE)}>
          <SplitBar t={t} data={CAISSE_COMPOSITION} />
          <div style={{ marginTop: 16, fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
            La trésorerie totale du réseau s'élève à <strong style={{ color: t.text }}>{formatDA(CAISSE_GLOBALE)}</strong>,
            dont <strong style={{ color: C.orange }}>{formatDA(TOTAL_SD_ENCAISSE)}</strong> détenus dans les
            caisses des Stop Desks et <strong style={{ color: C.blue }}>{formatDA(EN_TRANSIT)}</strong> en
            cours d'acheminement vers le siège.
          </div>
        </ChartCard>

        <ChartCard t={t} title="Transactions par type" sub={`${fmt(TOTAL_TX)} transactions`}>
          <Donut t={t} data={TRANSACTION_TYPES} legend centerLabel="transactions" />
        </ChartCard>
      </div>

      {/* ═══ CRÉANCES & DETTES (owing) ═══ */}
      <SectionTitle t={t} title="Créances & dettes inter-caisses" icon={Scale} sub="positions à régler" />
      <div style={gridStyle(360)}>
        {/* Grande carte 1 — SD nous doivent */}
        <ChartCard t={t} title="Les Stop Desks nous doivent" icon={ArrowDownLeft}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: C.green, fontVariantNumeric: "tabular-nums" }}>
              {formatDA(SD_OWE_US)}
            </span>
            <span style={{ fontSize: 12, color: t.textMuted }}>
              répartis sur <strong style={{ color: t.text }}>{CREANCES.length}</strong> Stop Desks
            </span>
          </div>
          <HBars t={t} data={CREANCES} money />
          <div style={{ marginTop: 16, fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
            COD encaissé par les SD et non encore reversé au siège. Plus gros débiteur :
            <strong style={{ color: t.text }}> {CREANCES[0].label}</strong> avec
            <strong style={{ color: C.green }}> {formatDA(CREANCES[0].value)}</strong>.
          </div>
        </ChartCard>

        {/* Grande carte 2 — Nous devons aux SD */}
        <ChartCard t={t} title="Nous devons aux Stop Desks" icon={ArrowUpRight}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: C.red, fontVariantNumeric: "tabular-nums" }}>
              {formatDA(WE_OWE_SD)}
            </span>
            <span style={{ fontSize: 12, color: t.textMuted }}>
              dûs à <strong style={{ color: t.text }}>{DETTES.length}</strong> Stop Desks
            </span>
          </div>
          <HBars t={t} data={DETTES} money />
          <div style={{
            marginTop: 16, padding: "10px 12px", borderRadius: 9,
            background: isDark ? "rgba(22,163,74,0.08)" : "rgba(22,163,74,0.07)",
            border: "1px solid rgba(22,163,74,0.28)", fontSize: 12, color: t.textSub, lineHeight: 1.6,
          }}>
            Solde net du réseau SD : <strong style={{ color: C.green }}>+{formatDA(NET_SD)}</strong> en
            notre faveur (créances {formatDA(SD_OWE_US)} − dettes {formatDA(WE_OWE_SD)}).
          </div>
        </ChartCard>
      </div>

      {/* ═══ SOLDES PAR STOP DESK ═══ */}
      <SectionTitle t={t} title="Soldes par Stop Desk" icon={Building2} sub="encaisse, mouvements & solde" />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} noPadding>
          <DataTable
            t={t}
            rows={SD_CAISSES}
            rowKey={(s) => s.name}
            columns={[
              { header: "Stop Desk", render: (s) => <strong style={{ color: t.text }}>{s.name}</strong> },
              { header: "Wilaya", render: (s) => <span style={{ color: t.textMuted }}>{s.wilaya}</span> },
              { header: "Encaisse", align: "right", render: (s) => formatDA(s.encaisse) },
              { header: "Entrées", align: "right", render: (s) => <span style={{ color: C.green }}>{formatDA(s.entrees)}</span> },
              { header: "Sorties", align: "right", render: (s) => <span style={{ color: C.red }}>{formatDA(s.sorties)}</span> },
              { header: "Solde", align: "right", render: (s) => <MoneyDelta value={s.solde} /> },
              {
                header: "Position", align: "center",
                render: (s) =>
                  s.solde >= 0
                    ? <Badge color={C.green} bg="rgba(22,163,74,0.12)">Nous doit</Badge>
                    : <Badge color={C.red} bg="rgba(239,68,68,0.12)">On lui doit</Badge>,
              },
            ]}
          />
          {/* Totals footer */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 22, padding: "12px 16px",
            borderTop: `1px solid ${t.divider}`, background: t.rowHover,
          }}>
            <MiniStat t={t} label="Total encaisse" value={formatDA(TOTAL_SD_ENCAISSE)} />
            <MiniStat t={t} label="SD nous doivent" value={formatDA(SD_OWE_US)} color={C.green} />
            <MiniStat t={t} label="Nous devons" value={formatDA(WE_OWE_SD)} color={C.red} />
            <MiniStat t={t} label="Solde net" value={`+${formatDA(NET_SD)}`} color={C.green} />
          </div>
        </ChartCard>
      </div>

      {/* ═══ MOUVEMENTS DE CAISSE ═══ */}
      <SectionTitle t={t} title="Mouvements de caisse" icon={ArrowRightLeft} sub="entrées vs sorties — 12 derniers mois" />
      <div style={gridStyle(220)}>
        <StatTile t={t} icon={ArrowDownLeft} label="Total entrées (12 mois)" value={formatDA(TOTAL_ENTREES)} hint="COD encaissé + frais" accent={C.green} />
        <StatTile t={t} icon={ArrowUpRight}  label="Total sorties (12 mois)" value={formatDA(TOTAL_SORTIES)} hint="remises + charges" accent={C.red} />
        <StatTile t={t} icon={Scale}         label="Flux net (12 mois)"      value={`+${formatDA(FLUX_NET)}`} hint="entrées − sorties" accent={C.orange} />
        <StatTile t={t} icon={Repeat}        label="Taux de rotation"        value={`${TAUX_ROTATION.toFixed(1)} %`} hint="sorties / entrées" accent={C.blue} />
      </div>
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} title="Entrées vs sorties de caisse" sub="12 derniers mois">
          {/* mini legend */}
          <div style={{ display: "flex", gap: 18, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: C.green }} />
              <span style={{ fontSize: 12, color: t.textSub }}>Entrées</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: C.red }} />
              <span style={{ fontSize: 12, color: t.textSub }}>Sorties</span>
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Entrées</div>
          <AreaLine t={t} data={CAISSE_ENTREES} labels={MONTHS} suffix=" DA" color={C.green} height={170} />
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, margin: "22px 0 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Sorties</div>
          <AreaLine t={t} data={CAISSE_SORTIES} labels={MONTHS} suffix=" DA" color={C.red} height={170} />
        </ChartCard>
      </div>

      {/* ═══ TRANSFERTS RÉCENTS ═══ */}
      <SectionTitle t={t} title="Transferts récents" icon={Send} sub="mouvements inter-caisses" />
      <div style={{ marginBottom: 22 }}>
        <ChartCard t={t} noPadding>
          <DataTable
            t={t}
            rows={TRANSFERS}
            rowKey={(tr) => tr.ref}
            columns={[
              { header: "Référence", render: (tr) => <span style={{ fontFamily: "monospace", color: t.textSub }}>{tr.ref}</span> },
              { header: "De", render: (tr) => <strong style={{ color: t.text }}>{tr.from}</strong> },
              {
                header: "", align: "center",
                render: () => <ArrowRightLeft size={13} color={t.textFaint} />,
              },
              { header: "À", render: (tr) => <strong style={{ color: t.text }}>{tr.to}</strong> },
              { header: "Montant", align: "right", render: (tr) => formatDA(tr.montant) },
              { header: "Date", render: (tr) => <span style={{ color: t.textMuted }}>{tr.date}</span> },
              {
                header: "Statut", align: "center",
                render: (tr) => {
                  const st = STATUS_STYLE[tr.statut];
                  return <Badge color={st.color} bg={st.bg}>{tr.statut}</Badge>;
                },
              },
            ]}
          />
          {/* Transfers footer */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 22, padding: "12px 16px",
            borderTop: `1px solid ${t.divider}`, background: t.rowHover,
          }}>
            <MiniStat t={t} label="Transferts" value={fmt(TRANSFERS.length)} />
            <MiniStat
              t={t}
              label="En transit"
              value={formatDA(TRANSFERS.filter((x) => x.statut === "En transit").reduce((a, x) => a + x.montant, 0))}
              color={C.blue}
            />
            <MiniStat
              t={t}
              label="Validés"
              value={formatDA(TRANSFERS.filter((x) => x.statut === "Validé").reduce((a, x) => a + x.montant, 0))}
              color={C.green}
            />
            <MiniStat
              t={t}
              label="En attente"
              value={formatDA(TRANSFERS.filter((x) => x.statut === "En attente").reduce((a, x) => a + x.montant, 0))}
              color={C.amber}
            />
          </div>
        </ChartCard>
      </div>
    </PageShell>
  );
}
