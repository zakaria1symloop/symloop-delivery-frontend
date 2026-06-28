"use client";

/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — HUB / INDEX  (page #34)
 *
 *  Landing page for the Rapports section: a demo banner, a heading, and a grid
 *  of 15 cards, each linking to a dedicated report route. All sub-reports share
 *  the foundation in `./_charts` (UI) and `./_data` (mock data).
 * ──────────────────────────────────────────────────────────────────────────── */

import Link from "next/link";
import {
  FileBarChart, ArrowRight,
  LayoutDashboard, Boxes, Truck, RotateCcw, Wallet, Coins, Percent,
  Building2, Bike, Store, MapPin, Route, MessageSquareWarning, HandCoins, Activity,
} from "lucide-react";
import { useIsDark, useTokens, ORANGE, type Tokens } from "../_ui";
import { PageShell, ReportHeader, DemoNotice, SectionTitle } from "./_charts";

interface ReportLink {
  href: string;
  title: string;
  desc: string;
  icon: React.ElementType;
}

/** The 15 reports — keep in sync with the sidebar children in Sidebar.tsx. */
const REPORTS: ReportLink[] = [
  { href: "/dashboard/rapports/overview",     title: "Vue d'ensemble",          desc: "KPIs globaux et faits saillants",          icon: LayoutDashboard },
  { href: "/dashboard/rapports/colis",        title: "Rapport des Colis",       desc: "Volumes, statuts, types, évolution",       icon: Boxes },
  { href: "/dashboard/rapports/livraison",    title: "Performance de Livraison", desc: "Taux, délais, échecs",                    icon: Truck },
  { href: "/dashboard/rapports/retours",      title: "Rapport des Retours",     desc: "Taux, raisons, par SD/expéditeur",         icon: RotateCcw },
  { href: "/dashboard/rapports/finance",      title: "Rapport Financier Global", desc: "CA, COD, frais, prélèvements, marge",     icon: Wallet },
  { href: "/dashboard/rapports/caisses",      title: "Rapport des Caisses",     desc: "Global + SD, mouvements, owing",           icon: Coins },
  { href: "/dashboard/rapports/prelevements", title: "Rapport des Prélèvements", desc: "Expéditeur/destinataire, par SD",         icon: Percent },
  { href: "/dashboard/rapports/stop-desks",   title: "Rapport par Stop Desk",   desc: "Performance détaillée par SD",             icon: Building2 },
  { href: "/dashboard/rapports/chauffeurs",   title: "Rapport des Chauffeurs",  desc: "Livraisons, COD, commissions, retards",    icon: Bike },
  { href: "/dashboard/rapports/expediteurs",  title: "Rapport des Expéditeurs", desc: "Top, CA, retours, soldes",                 icon: Store },
  { href: "/dashboard/rapports/geographie",   title: "Rapport Géographique",    desc: "Par wilaya/commune, répartition",          icon: MapPin },
  { href: "/dashboard/rapports/navettes",     title: "Rapport des Navettes",    desc: "Trajets, ponctualité, retards",            icon: Route },
  { href: "/dashboard/rapports/reclamations", title: "Rapport des Réclamations", desc: "SLA, types, statuts",                     icon: MessageSquareWarning },
  { href: "/dashboard/rapports/cod",          title: "Rapport COD / Recouvrement", desc: "Collecté, remis, en attente",           icon: HandCoins },
  { href: "/dashboard/rapports/activite",     title: "Rapport d'Activité / Audit", desc: "Actions par utilisateur, journal",      icon: Activity },
];

export default function RapportsHubPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  return (
    <PageShell t={t}>
      <ReportHeader
        t={t}
        icon={FileBarChart}
        title="Rapports & Analyses"
        subtitle="Centre de reporting — choisissez un rapport pour explorer l'activité, les opérations, la finance et la qualité"
      />

      <DemoNotice t={t} />

      <SectionTitle t={t} title="Tous les rapports" sub="15 rapports disponibles" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {REPORTS.map((r) => (
          <ReportCard key={r.href} t={t} report={r} />
        ))}
      </div>
    </PageShell>
  );
}

function ReportCard({ t, report }: { t: Tokens; report: ReportLink }) {
  const { href, title, desc, icon: Icon } = report;
  return (
    <Link
      href={href}
      className="group"
      style={{
        display: "flex", flexDirection: "column", gap: 12, padding: 18,
        background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
        boxShadow: t.shadow, textDecoration: "none", transition: "border-color 0.15s, transform 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={20} color={ORANGE} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: t.text, lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3, lineHeight: 1.45 }}>{desc}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: "auto", fontSize: 12, fontWeight: 700, color: ORANGE }}>
        Voir le rapport
        <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
