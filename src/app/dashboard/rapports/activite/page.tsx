"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — RAPPORT D'ACTIVITÉ / AUDIT  (journal des actions utilisateurs)
 *
 *  HARDCODED showcase. No API calls — every figure is illustrative and kept
 *  STRICTLY internally consistent: a single total of 28 160 actions is the
 *  source of truth and reconciles four independent breakdowns —
 *    • par type    (création / modification / scan / livraison / connexion)
 *    • par module  (Colis, Caisses, Navettes, Réclamations…)  → 9 modules
 *    • par rôle    (admin / opérateur / chauffeur / expéditeur) — DERIVED from USERS
 *    • par utilisateur (12 utilisateurs actifs)
 *  Period: 30 derniers jours · ≈ 939 actions / jour · pic à 1 210 actions.
 *
 *  Reuses the shared chart/layout primitives from `../_charts` and the design
 *  tokens from `../../_ui`. The recent journal reuses `ACTIVITY_LOG` from
 *  `../_data`. Report-specific series live in local consts below — no chart
 *  primitive is re-implemented here.
 * ──────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import {
  Activity, Users, ScanLine, LogIn, Truck, Zap, LayoutGrid, BarChart3,
  PieChart, History, Clock, ListChecks, Filter, ShieldCheck, Trophy, Award,
  CalendarDays, UserCheck, Package, FileText, FileSpreadsheet,
} from "lucide-react";
import { useIsDark, useTokens } from "../../_ui";
import {
  PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
  KpiCard, StatTile, Donut, VBars, AreaLine, DataTable, Pill, Badge,
  Segmented, SelectField, ExportButton,
  C, fmt, ORANGE, type Segment,
} from "../_charts";
import { ACTIVITY_LOG, PERIOD_OPTIONS, type ActivityRow } from "../_data";

/* ══════════════════════════════════════════════════════════════════════════
 *  1. ACTIONS PAR TYPE — single source of truth for the grand total.
 *     Order matches the spec: création / modification / scan / livraison / connexion.
 * ════════════════════════════════════════════════════════════════════════ */
const ACTION_TYPES: Segment[] = [
  { label: "Création",     value: 4820, color: C.blue },
  { label: "Modification", value: 6480, color: C.violet },
  { label: "Scan",         value: 9240, color: C.cyan },
  { label: "Livraison",    value: 5160, color: C.green },
  { label: "Connexion",    value: 2460, color: C.slate },
];

/** Grand total — every other breakdown below reconciles to this number (28 160). */
const TOTAL_ACTIONS = ACTION_TYPES.reduce((s, a) => s + a.value, 0);

const PERIOD_DAYS = 30;
const ACTIONS_PER_DAY = Math.round(TOTAL_ACTIONS / PERIOD_DAYS); // ≈ 939

/* ══════════════════════════════════════════════════════════════════════════
 *  2. RÉPARTITION PAR MODULE — 9 modules, sums to TOTAL_ACTIONS (28 160).
 *     Authentification (2 460) deliberately equals the "Connexion" action type.
 * ════════════════════════════════════════════════════════════════════════ */
const MODULES: Segment[] = [
  { label: "Colis",            value: 8940, color: C.orange },
  { label: "Navettes & Sacs",  value: 5280, color: C.violet },
  { label: "Caisses & Finance", value: 3120, color: C.green },
  { label: "Authentification", value: 2460, color: C.slate },
  { label: "Expéditeurs",      value: 2360, color: C.blue },
  { label: "Rapports",         value: 2000, color: C.cyan },
  { label: "Réclamations",     value: 1640, color: C.amber },
  { label: "Tarifs & Bureaux", value: 1380, color: C.pink },
  { label: "Utilisateurs & Rôles", value: 980, color: C.indigo },
];

const MODULE_COUNT = MODULES.length; // 9
const moduleColor = (label: string) => MODULES.find((m) => m.label === label)?.color ?? C.slate;

/* ══════════════════════════════════════════════════════════════════════════
 *  3. ACTIVITÉ PAR UTILISATEUR — 12 utilisateurs actifs, sorted desc.
 *     Their action counts sum EXACTLY to TOTAL_ACTIONS (28 160). Names reuse the
 *     shared roster from ../_data (drivers / merchants) for cross-page coherence.
 * ════════════════════════════════════════════════════════════════════════ */
type RoleKey = "admin" | "operator" | "chauffeur" | "expediteur";

const ROLE_META: Record<RoleKey, { label: string; color: string }> = {
  admin:      { label: "Admin",      color: C.red },
  operator:   { label: "Opérateur",  color: C.blue },
  chauffeur:  { label: "Chauffeur",  color: C.green },
  expediteur: { label: "Expéditeur", color: C.amber },
};

interface UserRow {
  name: string; role: RoleKey; actions: number; lastAccess: string; module: string;
}

const USERS: UserRow[] = [
  { name: "Sara Bensalem",   role: "admin",      actions: 4620, lastAccess: "il y a 4 min",  module: "Caisses & Finance" },
  { name: "Amine Khelifi",   role: "operator",   actions: 3980, lastAccess: "il y a 12 min", module: "Navettes & Sacs" },
  { name: "Karim Benali",    role: "chauffeur",  actions: 3240, lastAccess: "il y a 8 min",  module: "Colis" },
  { name: "Yacine Haddad",   role: "operator",   actions: 2860, lastAccess: "il y a 1 h",    module: "Colis" },
  { name: "Nabil Saïdi",     role: "chauffeur",  actions: 2540, lastAccess: "il y a 22 min", module: "Colis" },
  { name: "Riad Boudjema",   role: "chauffeur",  actions: 2310, lastAccess: "il y a 35 min", module: "Colis" },
  { name: "Walid Brahimi",   role: "operator",   actions: 2080, lastAccess: "il y a 47 min", module: "Navettes & Sacs" },
  { name: "Sofiane Meziane", role: "chauffeur",  actions: 1940, lastAccess: "il y a 1 h",    module: "Colis" },
  { name: "Mohamed Chérif",  role: "chauffeur",  actions: 1620, lastAccess: "il y a 2 h",    module: "Colis" },
  { name: "Leïla Hamdani",   role: "admin",      actions: 1280, lastAccess: "il y a 18 min", module: "Réclamations" },
  { name: "Mode Dz",         role: "expediteur", actions: 980,  lastAccess: "il y a 38 min", module: "Expéditeurs" },
  { name: "Cosmétique Plus", role: "expediteur", actions: 710,  lastAccess: "il y a 2 h",    module: "Expéditeurs" },
];

const ACTIVE_USERS = USERS.length; // 12

/** Par rôle — DERIVED from USERS so it reconciles automatically with the table. */
const ROLES_DIST: Segment[] = (Object.keys(ROLE_META) as RoleKey[]).map((k) => ({
  label: ROLE_META[k].label,
  value: USERS.filter((u) => u.role === k).reduce((s, u) => s + u.actions, 0),
  color: ROLE_META[k].color,
}));

/* ══════════════════════════════════════════════════════════════════════════
 *  4. VOLUME D'ACTIONS PAR JOUR — 14 derniers jours (fenêtre glissante).
 *     Two Fri/Sat weekend dips; daily average ≈ 924 ≈ ACTIONS_PER_DAY; pic 1 210.
 * ════════════════════════════════════════════════════════════════════════ */
const DAILY = [880, 940, 1010, 600, 520, 1060, 1120, 980, 1040, 1150, 660, 580, 1190, 1210];
const DAILY_LABELS = Array.from({ length: DAILY.length }, (_, i) => String(14 + i)); // 14 → 27 juin
const PEAK = Math.max(...DAILY);
const PEAK_DAY = DAILY_LABELS[DAILY.indexOf(PEAK)];

/* ══════════════════════════════════════════════════════════════════════════
 *  5. JOURNAL RÉCENT — reuse the shared ACTIVITY_LOG. Type → badge meta.
 * ════════════════════════════════════════════════════════════════════════ */
const TYPE_META: Record<ActivityRow["type"], { label: string; color: string }> = {
  create:  { label: "Création",     color: C.blue },
  update:  { label: "Modification", color: C.violet },
  delete:  { label: "Suppression",  color: C.red },
  login:   { label: "Connexion",    color: C.slate },
  scan:    { label: "Scan",         color: C.cyan },
  finance: { label: "Finance",      color: C.green },
};

/* ── Derived headline figures for the synthèse band ─────────────────────────── */
const TOP_TYPE = [...ACTION_TYPES].sort((a, b) => b.value - a.value)[0];   // Scan
const TOP_MODULE = [...MODULES].sort((a, b) => b.value - a.value)[0];       // Colis
const TOP_USER = USERS[0];                                                  // Sara Bensalem

/* ── KPI band ─────────────────────────────────────────────────────────────── */
const KPIS = [
  { label: "Actions totales",       value: fmt(TOTAL_ACTIONS),     icon: Activity,   delta: 14.6, goodWhenUp: true,  deltaSuffix: "%" },
  { label: "Utilisateurs actifs",   value: fmt(ACTIVE_USERS),      icon: Users,      delta: 2,    goodWhenUp: true,  deltaSuffix: "" },
  { label: "Actions / jour",        value: fmt(ACTIONS_PER_DAY),   icon: CalendarDays, delta: 8.3, goodWhenUp: true,  deltaSuffix: "%" },
  { label: "Modules suivis",        value: fmt(MODULE_COUNT),      icon: LayoutGrid, delta: 0,    goodWhenUp: true,  deltaSuffix: "" },
  { label: "Scans",                 value: fmt(ACTION_TYPES[2].value), icon: ScanLine, delta: 11.2, goodWhenUp: true, deltaSuffix: "%" },
  { label: "Livraisons enregistrées", value: fmt(ACTION_TYPES[3].value), icon: Truck, delta: 9.4, goodWhenUp: true,  deltaSuffix: "%" },
  { label: "Connexions",            value: fmt(ACTION_TYPES[4].value), icon: LogIn,  delta: 6.4,  goodWhenUp: true,  deltaSuffix: "%" },
  { label: "Pic d'activité / jour", value: fmt(PEAK),              icon: Zap,        delta: 12.0, goodWhenUp: true,  deltaSuffix: "%" },
] as const;

/* ════════════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════════════ */
export default function ActiviteReportPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [period, setPeriod] = useState("30j");

  return (
    <PageShell t={t} maxWidth={1320}>
      {/* DEMO BANNER — at the very top, per spec */}
      <DemoNotice t={t} />

      <ReportHeader
        t={t}
        icon={ShieldCheck}
        title="Rapport d'Activité / Audit"
        subtitle="Journal des actions utilisateurs — types d'actions, activité par utilisateur, par module et traçabilité"
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
          <SelectField t={t} icon={LayoutGrid} options={["Tous les modules", ...MODULES.map((m) => m.label)]} />
          <SelectField t={t} icon={Filter} options={["Tous les rôles", ...ROLES_DIST.map((r) => r.label)]} />
        </div>
      </div>

      {/* ── 1. KPIs ─────────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Indicateurs d'activité" icon={Activity} sub={`${PERIOD_DAYS} derniers jours · vs période précédente`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(186px, 1fr))", gap: 13, marginBottom: 26 }}>
        {KPIS.map((k) => (
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

      {/* ── 2. Actions par type ─────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Actions par type" icon={BarChart3} sub={`${fmt(TOTAL_ACTIONS)} actions enregistrées`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Volume par type d'action" icon={BarChart3} sub="création · modification · scan · livraison · connexion">
          <VBars
            t={t}
            data={ACTION_TYPES.map((a) => a.value)}
            labels={ACTION_TYPES.map((a) => a.label)}
            color={ORANGE}
            height={220}
            format={(v) => fmt(v)}
          />
        </ChartCard>
      </div>

      {/* ── 3. Répartition par module & par rôle ────────────────────────────── */}
      <SectionTitle t={t} title="Répartition par module & par rôle" icon={PieChart} sub={`${MODULE_COUNT} modules suivis`} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Actions par module" icon={LayoutGrid} sub="part de l'activité totale">
          <Donut t={t} data={MODULES} legend centerValue={fmt(TOTAL_ACTIONS)} centerLabel="actions" />
        </ChartCard>

        <ChartCard t={t} title="Actions par rôle" icon={Users} sub={`${ACTIVE_USERS} utilisateurs actifs`}>
          <Donut t={t} data={ROLES_DIST} legend centerValue={fmt(ACTIVE_USERS)} centerLabel="utilisateurs" />
        </ChartCard>
      </div>

      {/* ── 4. Volume d'actions par jour ────────────────────────────────────── */}
      <SectionTitle t={t} title="Volume d'actions par jour" icon={Activity} sub="14 derniers jours — fenêtre glissante" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} title="Actions quotidiennes" icon={CalendarDays} sub={`moyenne ${fmt(ACTIONS_PER_DAY)} / jour · pic ${fmt(PEAK)} le ${PEAK_DAY} juin`}>
          <AreaLine t={t} data={DAILY} labels={DAILY_LABELS} color={ORANGE} suffix=" actions" height={250} />
        </ChartCard>
      </div>

      {/* ── 5. Activité par utilisateur (table) ─────────────────────────────── */}
      <SectionTitle t={t} title="Activité par utilisateur" icon={ListChecks} sub={`${ACTIVE_USERS} utilisateurs actifs · ${fmt(TOTAL_ACTIONS)} actions`} />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} noPadding>
          <DataTable<UserRow>
            t={t}
            rows={USERS}
            rowKey={(u) => u.name}
            columns={[
              {
                header: "Utilisateur",
                render: (u, i) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Pill color={ORANGE}>{i + 1}</Pill>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: t.text }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{ROLE_META[u.role].label}</div>
                    </div>
                  </div>
                ),
              },
              {
                header: "Rôle",
                render: (u) => (
                  <Badge color={ROLE_META[u.role].color} bg={`${ROLE_META[u.role].color}18`}>
                    {ROLE_META[u.role].label}
                  </Badge>
                ),
              },
              { header: "Actions", align: "right", render: (u) => fmt(u.actions) },
              {
                header: "Part",
                align: "right",
                render: (u) => (
                  <span style={{ color: t.textMuted, fontVariantNumeric: "tabular-nums" }}>
                    {((u.actions / TOTAL_ACTIONS) * 100).toFixed(1)} %
                  </span>
                ),
              },
              {
                header: "Module principal",
                render: (u) => (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: moduleColor(u.module), flexShrink: 0 }} />
                    {u.module}
                  </span>
                ),
              },
              {
                header: "Dernier accès",
                align: "right",
                render: (u) => (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: t.textMuted }}>
                    <Clock size={12} /> {u.lastAccess}
                  </span>
                ),
              },
            ]}
          />
        </ChartCard>
      </div>

      {/* ── 6. Journal d'activité récent (table) ────────────────────────────── */}
      <SectionTitle t={t} title="Journal d'activité récent" icon={History} sub="dernières actions tracées" />
      <div style={{ marginBottom: 26 }}>
        <ChartCard t={t} noPadding>
          <DataTable<ActivityRow>
            t={t}
            rows={ACTIVITY_LOG}
            rowKey={(r, i) => `${r.target}-${i}`}
            columns={[
              {
                header: "Heure",
                render: (r) => (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: t.textMuted }}>
                    <Clock size={12} /> {r.time}
                  </span>
                ),
              },
              {
                header: "Utilisateur",
                render: (r) => (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: t.text }}>{r.user}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, textTransform: "capitalize" }}>{r.role}</div>
                  </div>
                ),
              },
              {
                header: "Type",
                render: (r) => (
                  <Badge color={TYPE_META[r.type].color} bg={`${TYPE_META[r.type].color}18`}>
                    {TYPE_META[r.type].label}
                  </Badge>
                ),
              },
              { header: "Action", render: (r) => <span style={{ color: t.textSub }}>{r.action}</span> },
              {
                header: "Cible",
                align: "right",
                render: (r) => (
                  <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontWeight: 700, color: t.text }}>{r.target}</span>
                ),
              },
            ]}
          />
        </ChartCard>
      </div>

      {/* ── 7. Synthèse ─────────────────────────────────────────────────────── */}
      <SectionTitle t={t} title="Synthèse de l'activité" icon={Trophy} sub="sur la période" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        <StatTile
          t={t}
          icon={Award}
          label="Action dominante"
          value={TOP_TYPE.label}
          hint={`${fmt(TOP_TYPE.value)} actions · ${((TOP_TYPE.value / TOTAL_ACTIONS) * 100).toFixed(1)} %`}
          accent={TOP_TYPE.color}
        />
        <StatTile
          t={t}
          icon={UserCheck}
          label="Utilisateur le plus actif"
          value={TOP_USER.name}
          hint={`${fmt(TOP_USER.actions)} actions · ${ROLE_META[TOP_USER.role].label}`}
          accent={C.green}
        />
        <StatTile
          t={t}
          icon={Package}
          label="Module le plus sollicité"
          value={TOP_MODULE.label}
          hint={`${fmt(TOP_MODULE.value)} actions · ${((TOP_MODULE.value / TOTAL_ACTIONS) * 100).toFixed(1)} %`}
          accent={ORANGE}
        />
        <StatTile
          t={t}
          icon={CalendarDays}
          label="Jour le plus actif"
          value={`${PEAK_DAY} juin`}
          hint={`${fmt(PEAK)} actions · moyenne ${fmt(ACTIONS_PER_DAY)} / jour`}
          accent={C.blue}
        />
      </div>
    </PageShell>
  );
}
