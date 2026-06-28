"use client";

import { useEffect, useState, type CSSProperties, type ElementType } from "react";
import {
  Package as PackageIcon, CheckCircle2, Truck, RotateCcw, XCircle,
  TrendingUp, TrendingDown, Banknote, Coins, Wallet,
  Send, AlertTriangle, ArrowDownToLine, Unlock,
  Activity as ActivityIcon, Loader2, AlertCircle, Inbox, MapPin,
} from "lucide-react";
import { ORANGE, formatDA, type Tokens } from "../../../_ui";
import {
  getExpStats, getExpWallet, getExpActivity, getExpPackages,
  type ExpAdminWallet, type ActivityLog,
} from "@/lib/expediteur-admin";
import { STATUS_LABELS, STATUS_COLORS, type PackageStatus } from "@/lib/packages";
import { formatActivityDate, activityUserName, activityActionColor } from "@/lib/activity";
import type { ExpTabProps } from "./types";

/* ── KPI snapshot derived from getExpStats ── */
interface KpiSnapshot {
  total: number;
  delivered: number;
  inProgress: number;
  returned: number;
  failed: number;
  deliveryRate: number;
  returnRate: number;
  caGenere: number;
  codCollected: number;
}

/* ── Normalised recent-colis row (works for stats.recent OR getExpPackages) ── */
interface RecentRow {
  tracking_number: string;
  status: string;
  recipient_name: string | null;
  recipient_wilaya: string | null;
  cod_amount: number;
  created_at: string | null;
}

const fmtInt = (n: number | undefined | null) => Number(n || 0).toLocaleString("fr-DZ");

function fmtPct(n: number | undefined | null): string {
  const v = Number(n || 0);
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Overview({ userId, t }: ExpTabProps) {
  const [kpi, setKpi] = useState<KpiSnapshot | null>(null);
  const [wallet, setWallet] = useState<ExpAdminWallet | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getExpStats(userId),
      getExpWallet(userId),
      getExpActivity(userId, 1, 6),
      getExpPackages(userId, { page: 1, per_page: 6 }),
    ])
      .then(([sRes, wRes, aRes, pRes]) => {
        if (!alive) return;

        if (!sRes.success || !sRes.data) {
          setError(sRes.message || "Impossible de charger les statistiques de cet expéditeur.");
          setLoading(false);
          return;
        }

        const s = sRes.data;
        setKpi({
          total: s.total,
          delivered: s.delivered,
          inProgress: s.in_progress,
          returned: s.returned,
          failed: s.failed,
          deliveryRate: s.delivery_rate,
          returnRate: s.return_rate,
          caGenere: s.ca_genere,
          codCollected: s.cod_collected,
        });

        // Recent colis: prefer the lightweight stats.recent[], fall back to page 1.
        const fromStats: RecentRow[] = (s.recent ?? []).map((r) => ({
          tracking_number: r.tracking_number,
          status: r.status,
          recipient_name: r.recipient_name,
          recipient_wilaya: r.recipient_wilaya,
          cod_amount: r.cod_amount,
          created_at: r.created_at,
        }));
        if (fromStats.length > 0) {
          setRecent(fromStats.slice(0, 6));
        } else if (pRes.success && pRes.data) {
          setRecent(
            pRes.data.data.slice(0, 6).map((p) => ({
              tracking_number: p.tracking_number,
              status: p.status,
              recipient_name: p.recipient_name,
              recipient_wilaya: p.recipient_wilaya?.name ?? null,
              cod_amount: p.cod_amount,
              created_at: p.created_at,
            })),
          );
        } else {
          setRecent([]);
        }

        setWallet(wRes.success && wRes.data ? wRes.data : null);
        setActivity(aRes.success && aRes.data ? aRes.data.data.slice(0, 6) : []);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Une erreur est survenue lors du chargement de l’aperçu.");
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId]);

  /* ── Loading ── */
  if (loading) {
    return (
      <Card t={t} style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 70, color: t.textMuted, fontSize: 14 }}>
          <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement de l’aperçu…
        </div>
      </Card>
    );
  }

  /* ── Error ── */
  if (error || !kpi) {
    return (
      <Card t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
          <AlertCircle size={18} /> {error || "Aperçu indisponible."}
        </div>
      </Card>
    );
  }

  const solde = wallet?.balance ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Performance KPIs ── */}
      <Card t={t}>
        <SectionHeader t={t} icon={TrendingUp} title="Performance" sub="Indicateurs clés du dossier expéditeur" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 11, marginTop: 16 }}>
          <KpiTile t={t} icon={PackageIcon}  label="Total colis"     value={fmtInt(kpi.total)}                color={ORANGE} />
          <KpiTile t={t} icon={CheckCircle2} label="Livrés"          value={fmtInt(kpi.delivered)}            color="#16a34a" />
          <KpiTile t={t} icon={Truck}        label="En cours"        value={fmtInt(kpi.inProgress)}           color="#0ea5e9" />
          <KpiTile t={t} icon={RotateCcw}    label="Retours"         value={fmtInt(kpi.returned)}             color="#a855f7" />
          <KpiTile t={t} icon={XCircle}      label="Échecs"          value={fmtInt(kpi.failed)}               color="#ef4444" />
          <KpiTile
            t={t} icon={TrendingUp} label="Taux livraison" value={fmtPct(kpi.deliveryRate)} color="#16a34a"
            sub={`${fmtInt(kpi.delivered)} / ${fmtInt(kpi.total)} colis`} bar={kpi.deliveryRate}
          />
          <KpiTile
            t={t} icon={TrendingDown} label="Taux retour" value={fmtPct(kpi.returnRate)} color="#ef4444"
            sub={`${fmtInt(kpi.returned)} retournés`} bar={kpi.returnRate}
          />
          <KpiTile t={t} icon={Banknote} label="CA généré"    value={formatDA(kpi.caGenere)}     color={ORANGE} />
          <KpiTile t={t} icon={Coins}    label="COD collecté" value={formatDA(kpi.codCollected)} color="#8b5cf6" />
        </div>
      </Card>

      {/* ── Financial snapshot (wallet) ── */}
      <Card t={t}>
        <SectionHeader t={t} icon={Wallet} title="Aperçu financier" sub="Solde et flux du portefeuille marchand" />
        {wallet ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 11, marginTop: 16 }}>
              <FinanceTile t={t} icon={Wallet}         label="Solde courant" value={formatDA(solde)}                   color={solde < 0 ? "#ef4444" : "#16a34a"} emphasis />
              <FinanceTile t={t} icon={Send}           label="En transit"    value={formatDA(wallet.en_transit)}       color="#0ea5e9" />
              <FinanceTile t={t} icon={AlertTriangle}  label="Dettes"        value={formatDA(wallet.dettes)}           color="#ef4444" />
              <FinanceTile t={t} icon={Coins}          label="COD crédité"   value={formatDA(wallet.total_cod_credited)} color="#16a34a" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 11, marginTop: 11 }}>
              <MiniStat t={t} icon={Unlock}         label="Libéré"           value={formatDA(wallet.libere)} />
              <MiniStat t={t} icon={Truck}          label="Frais expédition" value={formatDA(wallet.total_shipping)} />
              <MiniStat t={t} icon={RotateCcw}      label="Coût retours"     value={formatDA(wallet.total_return_cost)} />
              <MiniStat t={t} icon={ArrowDownToLine} label="Retraits"        value={formatDA(wallet.total_withdrawals)} />
            </div>
          </>
        ) : (
          <EmptyRow t={t} icon={Wallet} label="Portefeuille indisponible pour cet expéditeur." />
        )}
      </Card>

      {/* ── Recent colis + activity ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 16, alignItems: "start" }}>

        {/* Recent colis mini-table */}
        <Card t={t} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 18, paddingBottom: 12 }}>
            <SectionHeader t={t} icon={PackageIcon} title="Colis récents" sub="Les 6 dernières expéditions" />
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: "0 18px 22px" }}>
              <EmptyRow t={t} icon={Inbox} label="Aucun colis enregistré pour le moment." />
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {["Tracking", "Destinataire", "Wilaya", "Statut", "COD", "Date"].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 4 ? "right" : "left", padding: "9px 14px",
                        fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                        color: t.textMuted, background: t.sectionBg, borderTop: `1px solid ${t.divider}`,
                        borderBottom: `1px solid ${t.divider}`, whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={`${r.tracking_number}-${i}`} style={{ borderBottom: i < recent.length - 1 ? `1px solid ${t.divider}` : "none" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: t.text, fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.tracking_number}</td>
                      <td style={{ padding: "10px 14px", color: t.textSub, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.recipient_name || "—"}</td>
                      <td style={{ padding: "10px 14px", color: t.textMuted, whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {r.recipient_wilaya && <MapPin size={11} color={t.textFaint} />}
                          {r.recipient_wilaya || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><StatusChip t={t} status={r.status} /></td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{formatDA(r.cod_amount)}</td>
                      <td style={{ padding: "10px 14px", color: t.textMuted, whiteSpace: "nowrap" }}>{shortDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Recent activity mini-list */}
        <Card t={t}>
          <SectionHeader t={t} icon={ActivityIcon} title="Activité récente" sub="Derniers évènements du compte" />
          {activity.length === 0 ? (
            <div style={{ marginTop: 16 }}>
              <EmptyRow t={t} icon={ActivityIcon} label="Aucune activité enregistrée." />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
              {activity.map((log, i) => {
                const color = activityActionColor(log.action);
                return (
                  <div key={log.id} style={{
                    display: "flex", gap: 11, padding: "11px 0",
                    borderBottom: i < activity.length - 1 ? `1px solid ${t.divider}` : "none",
                  }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: color, marginTop: 5, flexShrink: 0, boxShadow: `0 0 0 3px ${color}22` }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {log.description || log.action}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, fontSize: 11.5, color: t.textMuted, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>{activityUserName(log)}</span>
                        <span style={{ color: t.textFaint }}>·</span>
                        <span>{formatActivityDate(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Presentational helpers                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function Card({ t, children, style }: { t: Tokens; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ t, icon: Icon, title, sub }: { t: Tokens; icon: ElementType; title: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: ORANGE + "14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color={ORANGE} />
      </div>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>{title}</h2>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>{sub}</p>}
      </div>
    </div>
  );
}

function KpiTile({ t, icon: Icon, label, value, color, sub, bar }: {
  t: Tokens; icon: ElementType; label: string; value: React.ReactNode; color: string; sub?: string; bar?: number;
}) {
  return (
    <div style={{ background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: color + "1f", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={13} color={color} />
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 19, fontWeight: 800, color: t.text, lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: t.textFaint, fontWeight: 600 }}>{sub}</span>}
      {typeof bar === "number" && (
        <div style={{ height: 5, borderRadius: 999, background: t.border, overflow: "hidden", marginTop: 1 }}>
          <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, bar))}%`, background: color, borderRadius: 999, transition: "width 300ms" }} />
        </div>
      )}
    </div>
  );
}

function FinanceTile({ t, icon: Icon, label, value, color, emphasis }: {
  t: Tokens; icon: ElementType; label: string; value: React.ReactNode; color: string; emphasis?: boolean;
}) {
  return (
    <div style={{
      background: emphasis ? color + "12" : t.sectionBg,
      border: `1px solid ${emphasis ? color + "33" : t.border}`,
      borderRadius: 12, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <span style={{ fontSize: emphasis ? 21 : 18, fontWeight: 800, color: emphasis ? color : t.text, lineHeight: 1.1 }}>{value}</span>
    </div>
  );
}

function MiniStat({ t, icon: Icon, label, value }: { t: Tokens; icon: ElementType; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderRadius: 10, border: `1px solid ${t.divider}` }}>
      <Icon size={15} color={t.textFaint} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{value}</div>
      </div>
    </div>
  );
}

function StatusChip({ t, status }: { t: Tokens; status: string }) {
  const key = status as PackageStatus;
  const label = STATUS_LABELS[key] ?? status;
  const c = STATUS_COLORS[key] ?? { bg: t.sectionBg, text: t.textMuted, dot: t.textFaint };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function EmptyRow({ t, icon: Icon, label }: { t: Tokens; icon: ElementType; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "26px 14px", color: t.textFaint, fontSize: 13, fontWeight: 600 }}>
      <Icon size={16} /> {label}
    </div>
  );
}
