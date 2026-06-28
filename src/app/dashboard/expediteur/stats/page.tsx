"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3, Calendar, Loader2,
  Package2, CheckCircle, XCircle, Percent, CreditCard, Truck,
  ChevronUp, ChevronDown, ArrowUpDown, RefreshCw, Coins,
} from "lucide-react";
import { getExpStats, type ExpStats } from "@/lib/expediteur";
import { STATUS_LABELS, STATUS_COLORS, type PackageStatus } from "@/lib/packages";

/* ── theme ───────────────────────────────────────────────── */
function useIsDark() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function useTokens(isDark: boolean) {
  return isDark ? {
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130",
    rowHover: "#1a1f2e", text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280",
    textFaint: "#4b5563", shadow: "none",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6",
    rowHover: "#f9fafb", text: "#111827", textSub: "#374151", textMuted: "#6b7280",
    textFaint: "#9ca3af", shadow: "0 1px 2px rgba(0,0,0,0.06)",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── helpers ──────────────────────────────────────────────── */
function formatDA(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("fr-DZ") + " DA";
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/* ── sort helpers ─────────────────────────────────────────── */
type SortDir = "asc" | "desc";

function sortData<T extends Record<string, any>>(data: T[], key: string, dir: SortDir): T[] {
  return [...data].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc"
      ? String(av).localeCompare(String(bv), "fr")
      : String(bv).localeCompare(String(av), "fr");
  });
}

/* ═══════════════════════════════════════════════════════════ */
/*  PAGE                                                      */
/* ═══════════════════════════════════════════════════════════ */
export default function ExpStats() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  /* ── state ──────────────────────────────────────────────── */
  const [stats, setStats] = useState<ExpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [wilayaSort, setWilayaSort] = useState<{ key: string; dir: SortDir }>({ key: "total", dir: "desc" });
  const [communeSort, setCommuneSort] = useState<{ key: string; dir: SortDir }>({ key: "total", dir: "desc" });

  /* ── fetch ──────────────────────────────────────────────── */
  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await getExpStats({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
    if (res.success && res.data) setStats(res.data);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetch_(); }, [fetch_]);

  /* ── quick dates ────────────────────────────────────────── */
  function setQuickDate(key: "7" | "30" | "90" | "all") {
    if (key === "all") { setDateFrom(""); setDateTo(""); }
    else {
      setDateFrom(daysAgo(Number(key)));
      setDateTo(todayStr());
    }
  }

  /* ── shared input style ────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
    background: t.inp.bg, color: t.inp.text, fontSize: 13, outline: "none",
  };

  const quickBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${active ? "#3b82f6" : t.border}`,
    background: active ? "rgba(59,130,246,0.12)" : "transparent",
    color: active ? "#3b82f6" : t.textMuted,
    transition: "all 0.15s",
  });

  /* ── derived data ──────────────────────────────────────── */
  const sortedWilayas = useMemo(() => {
    if (!stats) return [];
    return sortData(stats.by_wilaya, wilayaSort.key, wilayaSort.dir);
  }, [stats, wilayaSort]);

  const sortedCommunes = useMemo(() => {
    if (!stats) return [];
    return sortData(stats.by_commune, communeSort.key, communeSort.dir);
  }, [stats, communeSort]);

  /* ── bar chart data ─────────────────────────────────────── */
  const barMax = useMemo(() => {
    if (!stats || !stats.by_day.length) return 1;
    return Math.max(...stats.by_day.map((d) => d.total), 1);
  }, [stats]);

  /* ── donut chart data ───────────────────────────────────── */
  const donutSegments = useMemo(() => {
    if (!stats || !stats.by_status) return [];
    const entries = Object.entries(stats.by_status).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (total === 0) return [];
    let cumAngle = 0;
    return entries.map(([status, count]) => {
      const sc = STATUS_COLORS[status as PackageStatus];
      const color = sc?.dot || "#9ca3af";
      const angle = (count / total) * 360;
      const start = cumAngle;
      cumAngle += angle;
      return { status, count, color, start, angle, label: STATUS_LABELS[status as PackageStatus] || status };
    });
  }, [stats]);

  const donutGradient = useMemo(() => {
    if (!donutSegments.length) return "conic-gradient(#e5e7eb 0deg 360deg)";
    const stops = donutSegments.map((s) =>
      `${s.color} ${s.start}deg ${s.start + s.angle}deg`
    ).join(", ");
    return `conic-gradient(${stops})`;
  }, [donutSegments]);

  const donutTotal = useMemo(() => {
    return donutSegments.reduce((s, seg) => s + seg.count, 0);
  }, [donutSegments]);

  /* ── net revenue ────────────────────────────────────────── */
  const netRevenue = useMemo(() => {
    if (!stats) return 0;
    return (stats.money.total_cod || 0) - (stats.money.total_shipping || 0) - (stats.money.total_return_cost || 0);
  }, [stats]);

  /* ═════════════════════════════════════════════════════════ */
  /*  RENDER                                                   */
  /* ═════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      <div style={{
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        {/* ── Header ────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(139,92,246,0.1)",
            }}>
              <BarChart3 size={18} color="#8b5cf6" />
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>Statistiques</h1>
          </div>
          <button
            onClick={fetch_}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 8, border: `1px solid ${t.border}`, background: t.card,
              color: t.textSub, fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            Actualiser
          </button>
        </div>

        {/* ── Date range ────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        }}>
          <Calendar size={15} color={t.textMuted} />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, minWidth: 140 }} />
          <span style={{ color: t.textMuted, fontSize: 13 }}>—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, minWidth: 140 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {([
              { label: "7 jours", key: "7" as const },
              { label: "30 jours", key: "30" as const },
              { label: "3 mois", key: "90" as const },
              { label: "Tout", key: "all" as const },
            ]).map((q) => {
              const isActive =
                (q.key === "all" && !dateFrom && !dateTo) ||
                (q.key !== "all" && dateFrom === daysAgo(Number(q.key)) && dateTo === todayStr());
              return (
                <button key={q.key} onClick={() => setQuickDate(q.key)} style={quickBtnStyle(isActive)}>
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Loading ───────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
            <Loader2 size={28} color={t.textMuted} style={{ animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : !stats ? (
          <div style={{ textAlign: "center", padding: 64, color: t.textMuted, fontSize: 14 }}>
            Impossible de charger les statistiques.
          </div>
        ) : (
          <>
            {/* ── KPI Cards ──────────────────────────────────── */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12,
            }}>
              <KPICard icon={<Package2 size={18} />} label="Total Colis" value={String(stats.totals.total_colis)} color="#3b82f6" t={t} />
              <KPICard icon={<CheckCircle size={18} />} label="Livrés" value={String(stats.totals.livres)} color="#22c55e" t={t} />
              <KPICard icon={<XCircle size={18} />} label="Échecs" value={String(stats.totals.echecs)} color="#ef4444" t={t} />
              <KPICard icon={<Percent size={18} />} label="Taux livraison" value={`${(stats.totals.taux_livraison || 0).toFixed(1)}%`} color="#8b5cf6" t={t} />
              <KPICard icon={<CreditCard size={18} />} label="CA Total (COD)" value={formatDA(stats.totals.ca_total)} color="#f59e0b" t={t} />
              <KPICard icon={<Truck size={18} />} label="Frais Total" value={formatDA(stats.totals.frais_total)} color="#6366f1" t={t} />
            </div>

            {/* ── Charts row ─────────────────────────────────── */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16,
            }}>
              {/* Bar chart */}
              <div style={{
                background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
                boxShadow: t.shadow, padding: 20, minHeight: 300, display: "flex", flexDirection: "column",
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>
                  Évolution quotidienne
                </div>
                {stats.by_day.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint, fontSize: 13 }}>
                    Aucune donnée pour cette période
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    {/* Bars */}
                    <div style={{
                      display: "flex", alignItems: "flex-end", gap: stats.by_day.length > 20 ? 2 : 6,
                      height: 200, paddingBottom: 4,
                    }}>
                      {stats.by_day.map((day) => {
                        const deliveredH = (day.delivered / barMax) * 200;
                        const failedH = (day.failed / barMax) * 200;
                        const otherH = ((day.total - day.delivered - day.failed) / barMax) * 200;
                        return (
                          <div
                            key={day.date}
                            style={{
                              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                              minWidth: 0,
                            }}
                            title={`${fmtShortDate(day.date)}: ${day.total} total, ${day.delivered} livrés, ${day.failed} échecs`}
                          >
                            <div style={{
                              width: "100%", maxWidth: 32, display: "flex", flexDirection: "column",
                              borderRadius: "4px 4px 0 0", overflow: "hidden",
                            }}>
                              {otherH > 0 && (
                                <div style={{ height: Math.max(otherH, 1), background: "rgba(99,102,241,0.5)", transition: "height 0.3s" }} />
                              )}
                              {failedH > 0 && (
                                <div style={{ height: Math.max(failedH, 1), background: "#ef4444", transition: "height 0.3s" }} />
                              )}
                              {deliveredH > 0 && (
                                <div style={{ height: Math.max(deliveredH, 1), background: "#22c55e", transition: "height 0.3s" }} />
                              )}
                              {day.total === 0 && (
                                <div style={{ height: 2, background: t.divider }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* X-axis labels */}
                    <div style={{
                      display: "flex", gap: stats.by_day.length > 20 ? 2 : 6,
                      borderTop: `1px solid ${t.divider}`, paddingTop: 6,
                    }}>
                      {stats.by_day.map((day, i) => {
                        const showLabel = stats.by_day.length <= 14 || i % Math.ceil(stats.by_day.length / 14) === 0;
                        return (
                          <div key={day.date} style={{
                            flex: 1, textAlign: "center", fontSize: 9, color: t.textFaint,
                            overflow: "hidden", whiteSpace: "nowrap",
                          }}>
                            {showLabel ? fmtShortDate(day.date) : ""}
                          </div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: t.textMuted }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e" }} /> Livrés
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }} /> Échecs
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(99,102,241,0.5)" }} /> Autres
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Donut chart */}
              <div style={{
                background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
                boxShadow: t.shadow, padding: 20, minHeight: 300, display: "flex", flexDirection: "column",
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>
                  Répartition par statut
                </div>
                {donutSegments.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.textFaint, fontSize: 13 }}>
                    Aucune donnée
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    {/* Donut */}
                    <div style={{ position: "relative", width: 160, height: 160 }}>
                      <div style={{
                        width: 160, height: 160, borderRadius: "50%",
                        background: donutGradient,
                      }} />
                      {/* Center hole */}
                      <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 90, height: 90, borderRadius: "50%",
                        background: t.card,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1 }}>
                          {donutTotal}
                        </div>
                        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>total</div>
                      </div>
                    </div>
                    {/* Legend */}
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
                      maxWidth: 320,
                    }}>
                      {donutSegments.map((s) => (
                        <div key={s.status} style={{
                          display: "flex", alignItems: "center", gap: 5, fontSize: 11,
                          color: t.textSub,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                          <span style={{ whiteSpace: "nowrap" }}>{s.label}</span>
                          <span style={{ color: t.textMuted, fontWeight: 700 }}>{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── By Wilaya Table ────────────────────────────── */}
            <SortableTable
              title="Par Wilaya"
              columns={[
                { key: "wilaya_name", label: "Wilaya" },
                { key: "total", label: "Total" },
                { key: "delivered", label: "Livrés" },
                { key: "failed", label: "Échecs" },
                { key: "rate", label: "Taux %", format: "rate" },
              ]}
              data={sortedWilayas}
              sortKey={wilayaSort.key}
              sortDir={wilayaSort.dir}
              onSort={(key) => setWilayaSort((prev) => ({
                key,
                dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
              }))}
              t={t}
            />

            {/* ── By Commune Table ───────────────────────────── */}
            <SortableTable
              title="Par Commune"
              columns={[
                { key: "commune_name", label: "Commune" },
                { key: "wilaya_name", label: "Wilaya" },
                { key: "total", label: "Total" },
                { key: "delivered", label: "Livrés" },
                { key: "failed", label: "Échecs" },
                { key: "rate", label: "Taux %", format: "rate" },
              ]}
              data={sortedCommunes}
              sortKey={communeSort.key}
              sortDir={communeSort.dir}
              onSort={(key) => setCommuneSort((prev) => ({
                key,
                dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
              }))}
              t={t}
            />

            {/* ── Money summary ──────────────────────────────── */}
            <div style={{
              background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
              boxShadow: t.shadow, padding: 20,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Coins size={16} color="#f59e0b" />
                Résumé financier
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12,
              }}>
                <MoneyCard label="Total COD" value={formatDA(stats.money.total_cod)} color="#f59e0b" t={t} />
                <MoneyCard label="Total Frais" value={formatDA(stats.money.total_shipping)} color="#6366f1" t={t} />
                <MoneyCard label="Coût Retours" value={formatDA(stats.money.total_return_cost)} color="#ef4444" t={t} />
                <MoneyCard
                  label="Revenu Net"
                  value={formatDA(netRevenue)}
                  color={netRevenue >= 0 ? "#22c55e" : "#ef4444"}
                  t={t}
                  bold
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  KPI CARD                                                   */
/* ═══════════════════════════════════════════════════════════ */
function KPICard({ icon, label, value, color, t }: {
  icon: React.ReactNode; label: string; value: string; color: string; t: Tokens;
}) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
      boxShadow: t.shadow, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}18`, color,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.text, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  MONEY CARD                                                 */
/* ═══════════════════════════════════════════════════════════ */
function MoneyCard({ label, value, color, t, bold }: {
  label: string; value: string; color: string; t: Tokens; bold?: boolean;
}) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 10,
      border: `1px solid ${t.border}`,
      background: bold ? `${color}08` : "transparent",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: bold ? 800 : 700, color: bold ? color : t.text }}>
        {value}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  SORTABLE TABLE                                             */
/* ═══════════════════════════════════════════════════════════ */
interface ColumnDef {
  key: string;
  label: string;
  format?: "rate";
}

function SortableTable({ title, columns, data, sortKey, sortDir, onSort, t }: {
  title: string;
  columns: ColumnDef[];
  data: Record<string, any>[];
  sortKey: string;
  sortDir: SortDir;
  onSort: (key: string) => void;
  t: Tokens;
}) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
      boxShadow: t.shadow, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.divider}` }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</span>
        <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 8 }}>({data.length})</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  style={{
                    padding: "9px 14px", textAlign: "left", fontSize: 11,
                    fontWeight: 700, color: t.textMuted, textTransform: "uppercase",
                    letterSpacing: "0.04em", whiteSpace: "nowrap", cursor: "pointer",
                    userSelect: "none", position: "sticky", top: 0, background: t.card,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                    ) : (
                      <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: t.textFaint, fontSize: 13 }}>
                  Aucune donnée
                </td>
              </tr>
            ) : data.map((row, i) => (
              <tr
                key={i}
                style={{ borderBottom: `1px solid ${t.divider}`, transition: "background 0.12s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{
                    padding: "9px 14px", whiteSpace: "nowrap",
                    color: col.format === "rate" ? rateColor(row[col.key]) : t.textSub,
                    fontWeight: col.format === "rate" ? 700 : 400,
                  }}>
                    {col.format === "rate" ? `${(Number(row[col.key]) || 0).toFixed(1)}%` : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── rate color ───────────────────────────────────────────── */
function rateColor(rate: number): string {
  if (rate >= 80) return "#22c55e";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}
