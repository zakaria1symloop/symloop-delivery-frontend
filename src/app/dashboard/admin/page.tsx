"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Package2, Truck, Users, TrendingUp, Banknote, RotateCcw, Wallet, Building2,
  MapPin, Boxes, ScanBarcode, Receipt, Target, RefreshCw, Loader2, ArrowRight,
  CheckCircle2, Clock, XCircle, AlertTriangle, Store, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { useIsDark, useTokens, formatDA, ORANGE, type Tokens } from "../_ui";
import { getPackageStats, type PackageStats } from "@/lib/packages";
import { getCaisseBalances, type CaisseWithBalance } from "@/lib/caisse";
import { getWilayas } from "@/lib/geography";
import { getAllStopDesks } from "@/lib/geography";
import { getUsers, type StaffUser } from "@/lib/users";

/* ── Status grouping for the colis pipeline ── */
const STATUS_GROUPS = [
  { key: "pending",  label: "En attente",  color: "#f59e0b", statuses: ["en_attente", "pret_a_expedier", "accepte_operateur"] },
  { key: "transit",  label: "En transit",  color: "#3b82f6", statuses: ["en_sac", "en_transit", "arrive_destination", "pret_pour_retrait"] },
  { key: "delivered",label: "Livrés",      color: "#22c55e", statuses: ["livre"] },
  { key: "returns",  label: "Retours",     color: "#ef4444", statuses: ["retour_en_sac", "retour_en_transit", "retour_arrive", "retourne"] },
  { key: "failed",   label: "Échecs",      color: "#dc2626", statuses: ["echec_livraison"] },
  { key: "other",    label: "Autres",      color: "#6b7280", statuses: ["annule", "reporte"] },
] as const;

const ROLE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  expediteur:        { label: "Expéditeurs",  color: "#f43f5e", icon: Store },
  chauffeur:         { label: "Livreurs",     color: "#0ea5e9", icon: Truck },
  transit_chauffeur: { label: "Transit",      color: "#6366f1", icon: Truck },
  operator:          { label: "Opérateurs",   color: "#f59e0b", icon: Users },
  responsable:       { label: "Responsables", color: "#10b981", icon: Users },
  admin:             { label: "Admins",       color: "#3b82f6", icon: Users },
};

const QUICK_NAV = [
  { label: "Colis",        desc: "Tous les envois",     icon: Boxes,       href: "/dashboard/colis" },
  { label: "Scanner",      desc: "Colis & sacs",        icon: ScanBarcode, href: "/dashboard/scan/colis" },
  { label: "Livreurs",     desc: "Suivi & attribution", icon: Truck,       href: "/dashboard/chauffeurs/liste" },
  { label: "Finance",      desc: "Caisse & situation",  icon: Banknote,    href: "/dashboard/finance/situation" },
  { label: "Utilisateurs", desc: "Comptes & rôles",     icon: Users,       href: "/dashboard/users" },
  { label: "CRM",          desc: "Pipeline commercial", icon: Target,      href: "/dashboard/crm" },
  { label: "Géographie",   desc: "Wilayas & SD",        icon: MapPin,      href: "/dashboard/geography/wilaya" },
  { label: "Tarification", desc: "Grille des prix",     icon: Receipt,     href: "/dashboard/tarification" },
];

export default function AdminDashboard() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [stats, setStats] = useState<PackageStats | null>(null);
  const [caisses, setCaisses] = useState<CaisseWithBalance[]>([]);
  const [wilayaCount, setWilayaCount] = useState<number | null>(null);
  const [sdCount, setSdCount] = useState<number | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [sRes, cRes, wRes, dRes, uRes] = await Promise.all([
      getPackageStats(), getCaisseBalances(), getWilayas(), getAllStopDesks(), getUsers(),
    ]);
    if (sRes.success && sRes.data) setStats(sRes.data);
    if (cRes.success && cRes.data) setCaisses(cRes.data);
    if (wRes.success && wRes.data) setWilayaCount(wRes.data.length);
    if (dRes.success && dRes.data) setSdCount(dRes.data.length);
    if (uRes.success && uRes.data) setUsers(uRes.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Derived metrics ── */
  const total = stats?.total ?? 0;
  const groupCount = (g: typeof STATUS_GROUPS[number]) =>
    stats ? g.statuses.reduce((s, k) => s + ((stats as unknown as Record<string, number>)[k] ?? 0), 0) : 0;
  const delivered = stats?.livre ?? 0;
  const inTransit = groupCount(STATUS_GROUPS[1]);
  const returns = groupCount(STATUS_GROUPS[3]) + (stats?.echec_livraison ?? 0);
  const deliveryRate = total ? Math.round((delivered / total) * 1000) / 10 : 0;
  const returnRate = total ? Math.round((returns / total) * 1000) / 10 : 0;

  const treso = caisses.reduce((s, c) => s + Number(c.balance || 0), 0);
  const encaisse = caisses.reduce((s, c) => s + Number(c.total_in || 0), 0);
  const sorties = caisses.reduce((s, c) => s + Number(c.total_out || 0), 0);

  const roleCounts: Record<string, number> = {};
  for (const u of users) roleCounts[u.user_type] = (roleCounts[u.user_type] ?? 0) + 1;
  const activeDrivers = users.filter(u => (u.user_type === "chauffeur" || u.user_type === "transit_chauffeur") && u.status === "active").length;

  const today = new Date().toLocaleDateString("fr-DZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 80, color: t.textMuted, fontFamily: "var(--font-jakarta, sans-serif)" }}>
        <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement du tableau de bord…
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: "0.08em", textTransform: "uppercase" }}>Administration</p>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>Tableau de bord</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: t.textMuted, textTransform: "capitalize" }}>{today}</p>
        </div>
        <button onClick={load} disabled={refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, background: t.card, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: refreshing ? 0.6 : 1 }}>
          <RefreshCw size={14} style={refreshing ? { animation: "spin 0.8s linear infinite" } : undefined} /> Actualiser
        </button>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
        <Kpi t={t} icon={Package2}     label="Total colis"        value={total.toLocaleString("fr-DZ")}     accent={ORANGE}    sub="Tous statuts" />
        <Kpi t={t} icon={CheckCircle2} label="Livrés"             value={delivered.toLocaleString("fr-DZ")} accent="#22c55e"   sub={`${deliveryRate}% de réussite`} />
        <Kpi t={t} icon={Clock}        label="En transit"         value={inTransit.toLocaleString("fr-DZ")} accent="#3b82f6"   sub="En cours d'acheminement" />
        <Kpi t={t} icon={RotateCcw}    label="Retours & échecs"   value={returns.toLocaleString("fr-DZ")}   accent="#ef4444"   sub={`${returnRate}% du volume`} />
        <Kpi t={t} icon={Wallet}       label="Trésorerie réseau"  value={formatDA(treso)}                   accent="#8b5cf6"   sub={`${caisses.length} caisse(s)`} />
        <Kpi t={t} icon={Truck}        label="Livreurs actifs"    value={String(activeDrivers)}             accent="#0ea5e9"   sub={`${(roleCounts.chauffeur ?? 0) + (roleCounts.transit_chauffeur ?? 0)} au total`} />
      </div>

      {/* ── Row: pipeline + finance ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }} className="adm-row">
        {/* Colis pipeline */}
        <Panel t={t} title="Répartition des colis" icon={Boxes}>
          {/* stacked bar */}
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 18, background: t.divider }}>
            {STATUS_GROUPS.map(g => { const n = groupCount(g); const pct = total ? (n / total) * 100 : 0; return pct > 0 ? <div key={g.key} title={`${g.label}: ${n}`} style={{ width: `${pct}%`, background: g.color }} /> : null; })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {STATUS_GROUPS.map(g => {
              const n = groupCount(g); const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: g.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{n.toLocaleString("fr-DZ")}</div>
                    <div style={{ fontSize: 11.5, color: t.textMuted }}>{g.label} · {pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Finance */}
        <Panel t={t} title="Trésorerie" icon={Banknote} action={<Link href="/dashboard/finance/situation" style={linkStyle}>Détails <ArrowRight size={13} /></Link>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FinanceRow t={t} icon={Wallet}       color="#8b5cf6" label="Solde réseau"   value={formatDA(treso)} strong />
            <FinanceRow t={t} icon={ArrowDownLeft} color="#22c55e" label="Total encaissé" value={formatDA(encaisse)} />
            <FinanceRow t={t} icon={ArrowUpRight}  color="#ef4444" label="Total sorties"  value={formatDA(sorties)} />
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.divider}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Top caisses</div>
            {caisses.slice().sort((a, b) => Number(b.balance) - Number(a.balance)).slice(0, 3).map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: t.textSub, minWidth: 0 }}>
                  <Store size={13} color={t.textFaint} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.stop_desk?.name ?? c.name}</span>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: Number(c.balance) < 0 ? "#ef4444" : t.text, whiteSpace: "nowrap" }}>{formatDA(Number(c.balance))}</span>
              </div>
            ))}
            {caisses.length === 0 && <div style={{ fontSize: 12.5, color: t.textFaint }}>Aucune caisse.</div>}
          </div>
        </Panel>
      </div>

      {/* ── Row: réseau + équipe ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16, marginBottom: 16, alignItems: "start" }} className="adm-row">
        {/* Réseau */}
        <Panel t={t} title="Réseau" icon={Building2}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MiniStat t={t} icon={MapPin} color="#0ea5e9" label="Wilayas couvertes" value={wilayaCount ?? "—"} />
            <MiniStat t={t} icon={Store}  color={ORANGE}   label="Points relais"     value={sdCount ?? "—"} />
            <MiniStat t={t} icon={Store}  color="#f43f5e"  label="Expéditeurs"       value={roleCounts.expediteur ?? 0} />
            <MiniStat t={t} icon={Users}  color="#10b981"  label="Équipe interne"    value={(roleCounts.operator ?? 0) + (roleCounts.responsable ?? 0) + (roleCounts.admin ?? 0)} />
          </div>
        </Panel>

        {/* Équipe / rôles */}
        <Panel t={t} title="Équipe" icon={Users} action={<Link href="/dashboard/users" style={linkStyle}>Gérer <ArrowRight size={13} /></Link>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {Object.entries(ROLE_META).map(([key, meta]) => {
              const n = roleCounts[key] ?? 0; const Icon = meta.icon;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: t.sectionBg, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color + "1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} color={meta.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{n}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{meta.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── Quick nav ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 10px" }}>Accès rapide</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
        {QUICK_NAV.map(({ label, desc, icon: Icon, href }) => (
          <Link key={label} href={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 12, background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow, textDecoration: "none" }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: ORANGE + "14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={16} color={ORANGE} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{label}</div>
              <div style={{ fontSize: 11.5, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</div>
            </div>
            <ArrowRight size={14} color={t.textFaint} style={{ flexShrink: 0 }} />
          </Link>
        ))}
      </div>

      <style>{`@media (max-width: 920px){ .adm-row { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

/* ── pieces ── */
function Kpi({ t, icon: Icon, label, value, accent, sub }: { t: Tokens; icon: React.ElementType; label: string; value: string; accent: string; sub?: string }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: "16px 18px", boxShadow: t.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} color={accent} /></div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: t.text, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.textFaint, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Panel({ t, title, icon: Icon, action, children }: { t: Tokens; title: string; icon: React.ElementType; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, boxShadow: t.shadow }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon size={16} color={ORANGE} />
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 750, color: t.text }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FinanceRow({ t, icon: Icon, color, label, value, strong }: { t: Tokens; icon: React.ElementType; color: string; label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 13, color: t.textSub }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: color + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={14} color={color} /></span>
        {label}
      </span>
      <span style={{ fontSize: strong ? 17 : 14, fontWeight: 800, color: t.text }}>{value}</span>
    </div>
  );
}

function MiniStat({ t, icon: Icon, color, label, value }: { t: Tokens; icon: React.ElementType; color: string; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 10, background: t.sectionBg, border: `1px solid ${t.border}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: color + "1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={16} color={color} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{value}</div>
        <div style={{ fontSize: 11, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: ORANGE, textDecoration: "none" };
