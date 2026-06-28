"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquareWarning, Search, X, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, AlertCircle, Inbox, Package as PackageIcon,
  Clock, CheckCircle2, AlertTriangle, ExternalLink,
} from "lucide-react";
import { ORANGE } from "../../../_ui";
import { getExpReclamations } from "@/lib/expediteur-admin";
import {
  RECLAMATION_PRIORITIES, RECLAMATION_TYPE_LABELS,
  type ReclamationListItem, type ReclamationStatus,
  type ReclamationPriority, type ReclamationSla,
} from "@/lib/reclamations";
import {
  STATUS_LABELS, STATUS_COLORS, type PackageStatus,
} from "@/lib/packages";
import type { ExpTabProps } from "./types";

/* ── Config ─────────────────────────────────────────────────── */
const PER_PAGE = 12;

/** Central management page — there is no per-réclamation route, so rows open the
 *  full ticket workspace (create modal + detail drawer live there). */
const MANAGE_HREF = "/dashboard/reclamations";

/* ── Display meta (mirrors /dashboard/reclamations/page.tsx) ──── */
const STATUS_META: Record<ReclamationStatus, { label: string; color: string }> = {
  open:        { label: "Ouverte",  color: "#3b82f6" },
  in_progress: { label: "En cours", color: "#f59e0b" },
  resolved:    { label: "Résolue",  color: "#22c55e" },
  closed:      { label: "Fermée",   color: "#6b7280" },
};
const PRIORITY_META: Record<ReclamationPriority, { label: string; color: string }> = {
  low:    { label: "Basse",   color: "#6b7280" },
  normal: { label: "Normale", color: "#3b82f6" },
  high:   { label: "Haute",   color: "#f59e0b" },
  urgent: { label: "Urgente", color: "#ef4444" },
};

/* Single-value status pills (the backend status filter is equality-based). */
const STATUS_FILTERS: ReclamationStatus[] = ["open", "in_progress", "resolved", "closed"];

/* Threshold (minutes) past which an open ticket is flagged "old" (amber). */
const SLA_OLD_MINUTES = 48 * 60;

/* ── Local formatters ───────────────────────────────────────── */
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" });
}
// minutes → compact "Xm" / "Xh" / "Xj"
function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}j`;
}

/* ── Badges ─────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: ReclamationStatus }) {
  const m = STATUS_META[status] ?? { label: status, color: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 9999,
      background: m.color + "18", color: m.color,
      fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ReclamationPriority }) {
  const m = PRIORITY_META[priority] ?? { label: priority, color: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 9999,
      background: m.color + "18", color: m.color,
      fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {m.label}
    </span>
  );
}

/* SLA clock chip: green "Résolu en X" for resolved/closed; age "Ouvert depuis X"
 * for open/in_progress (amber past SLA_OLD_MINUTES, neutral otherwise). */
function SlaChip({ sla, color: muted, bg: neutralBg }: { sla?: ReclamationSla | null; color: string; bg: string }) {
  if (!sla) return <span style={{ color: muted }}>—</span>;
  let color: string, bg: string, label: string, Icon: React.ElementType;
  if (sla.resolved && sla.time_to_solve_minutes != null) {
    color = "#22c55e"; bg = "#22c55e18"; Icon = CheckCircle2;
    label = `Résolu en ${formatDuration(sla.time_to_solve_minutes)}`;
  } else if (sla.age_minutes != null) {
    const old = sla.age_minutes > SLA_OLD_MINUTES;
    color = old ? "#f59e0b" : muted;
    bg = old ? "#f59e0b18" : neutralBg;
    Icon = Clock;
    label = `Ouvert depuis ${formatDuration(sla.age_minutes)}`;
  } else {
    return <span style={{ color: muted }}>—</span>;
  }
  return (
    <span title={label} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      color, background: bg, whiteSpace: "nowrap",
    }}>
      <Icon size={12} />{label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  RÉCLAMATIONS TAB                                               */
/* ═══════════════════════════════════════════════════════════════ */
export default function Reclamations({ userId, user, t }: ExpTabProps) {
  const router = useRouter();

  /* ── List data ── */
  const [rows, setRows] = useState<ReclamationListItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Counts (KPI strip) ── */
  const [counts, setCounts] = useState<{ open: number; in_progress: number; resolved: number; urgent: number } | null>(null);

  /* ── Filters ── */
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusF, setStatusF] = useState<ReclamationStatus | "">("");
  const [priorityF, setPriorityF] = useState<ReclamationPriority | "">("");
  const [reloadKey, setReloadKey] = useState(0);

  /* ── Debounce search ── */
  useEffect(() => {
    const h = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  /* ── Reset to first page whenever the merchant or filters change ── */
  useEffect(() => { setPage(1); }, [userId, searchDebounced, statusF, priorityF]);

  /* ── Fetch list (alive-guarded) — keyed on userId + filters + page ── */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getExpReclamations(userId, {
      status: statusF || undefined,
      priority: priorityF || undefined,
      search: searchDebounced || undefined,
      page,
      per_page: PER_PAGE,
    })
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data) {
          setRows(res.data.data || []);
          setLastPage(res.data.last_page || 1);
          setTotal(res.data.total || 0);
        } else {
          setError(res.message || "Impossible de charger les réclamations de cet expéditeur.");
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Une erreur est survenue lors du chargement des réclamations.");
        setRows([]);
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId, page, searchDebounced, statusF, priorityF, reloadKey]);

  /* ── Fetch KPI counts (alive-guarded) — keyed on userId only ── */
  useEffect(() => {
    let alive = true;
    setCounts(null);
    Promise.all([
      getExpReclamations(userId, { status: "open", per_page: 1 }),
      getExpReclamations(userId, { status: "in_progress", per_page: 1 }),
      getExpReclamations(userId, { status: "resolved", per_page: 1 }),
      getExpReclamations(userId, { priority: "urgent", per_page: 1 }),
    ])
      .then(([o, ip, rs, ur]) => {
        if (!alive) return;
        setCounts({
          open: o.data?.total ?? 0,
          in_progress: ip.data?.total ?? 0,
          resolved: rs.data?.total ?? 0,
          urgent: ur.data?.total ?? 0,
        });
      })
      .catch(() => { if (alive) setCounts(null); });
    return () => { alive = false; };
  }, [userId, reloadKey]);

  const hasFilters = statusF !== "" || priorityF !== "" || searchDebounced !== "";

  /* ── Shared styles ── */
  const headBaseStyle: React.CSSProperties = {
    padding: "11px 14px", textAlign: "left", fontSize: 10.5,
    fontWeight: 700, color: t.textMuted, textTransform: "uppercase",
    letterSpacing: "0.05em", whiteSpace: "nowrap",
    position: "sticky", top: 0, background: t.card, zIndex: 1,
  };
  const cellStyle: React.CSSProperties = {
    padding: "11px 14px", fontSize: 12.5, color: t.textSub, verticalAlign: "middle",
  };

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Tab header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: ORANGE + "14",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <MessageSquareWarning size={18} color={ORANGE} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>Réclamations</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
              {loading ? "Chargement…" : (
                <>
                  {total.toLocaleString("fr-DZ")} réclamation{total > 1 ? "s" : ""}
                  {hasFilters ? " correspondant aux filtres" : ` ouverte${total > 1 ? "s" : ""} par ${user.first_name}`}
                </>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={MANAGE_HREF}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 9, border: "none", background: ORANGE, color: "#fff",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
            }}
          >
            <ExternalLink size={14} /> Gérer dans Réclamations
          </Link>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 9, border: `1px solid ${t.border}`, background: t.card,
              color: t.textSub, fontSize: 13, fontWeight: 600,
              cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: "spin 0.8s linear infinite" } : undefined} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── KPI strip (clickable filters) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <KpiTile t={t} icon={Inbox}         label="Ouvertes" value={counts?.open}        accent="#3b82f6"
          active={statusF === "open"}        onClick={() => setStatusF((s) => (s === "open" ? "" : "open"))} />
        <KpiTile t={t} icon={Loader2}       label="En cours" value={counts?.in_progress} accent="#f59e0b"
          active={statusF === "in_progress"} onClick={() => setStatusF((s) => (s === "in_progress" ? "" : "in_progress"))} />
        <KpiTile t={t} icon={CheckCircle2}  label="Résolues" value={counts?.resolved}    accent="#22c55e"
          active={statusF === "resolved"}    onClick={() => setStatusF((s) => (s === "resolved" ? "" : "resolved"))} />
        <KpiTile t={t} icon={AlertTriangle} label="Urgentes" value={counts?.urgent}      accent="#ef4444"
          active={priorityF === "urgent"}    onClick={() => setPriorityF((p) => (p === "urgent" ? "" : "urgent"))} />
      </div>

      {/* ── Search ── */}
      <div style={{ position: "relative", maxWidth: 420 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par sujet ou description…"
          style={{
            width: "100%", padding: "9px 32px 9px 34px", borderRadius: 10,
            border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
            fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", display: "flex" }}
          >
            <X size={14} color={t.textFaint} />
          </button>
        )}
      </div>

      {/* ── Filter chips: statut + priorité ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {STATUS_FILTERS.map((s) => {
          const active = statusF === s;
          const m = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setStatusF((cur) => (cur === s ? "" : s))}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.12s",
                border: `1px solid ${active ? m.color : t.border}`,
                background: active ? m.color + "18" : "transparent",
                color: active ? m.color : t.textMuted,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color }} />
              {m.label}
            </button>
          );
        })}
        <span style={{ width: 1, height: 18, background: t.border, margin: "0 4px" }} />
        {RECLAMATION_PRIORITIES.map((p) => {
          const active = priorityF === p;
          const m = PRIORITY_META[p];
          return (
            <button
              key={p}
              onClick={() => setPriorityF((cur) => (cur === p ? "" : p))}
              style={{
                padding: "5px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.12s",
                border: `1px solid ${active ? m.color : t.border}`,
                background: active ? m.color + "18" : "transparent",
                color: active ? m.color : t.textMuted,
              }}
            >
              {m.label}
            </button>
          );
        })}
        {hasFilters && (
          <button
            onClick={() => { setStatusF(""); setPriorityF(""); setSearch(""); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 11px", borderRadius: 9999, fontSize: 11.5, fontWeight: 600,
              cursor: "pointer", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444",
            }}
          >
            <X size={12} /> Effacer
          </button>
        )}
      </div>

      {/* ── Table card ── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        boxShadow: t.shadow, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                <th style={headBaseStyle}>#</th>
                <th style={headBaseStyle}>Sujet</th>
                <th style={headBaseStyle}>Type</th>
                <th style={headBaseStyle}>Colis</th>
                <th style={headBaseStyle}>Statut</th>
                <th style={headBaseStyle}>Priorité</th>
                <th style={headBaseStyle}>SLA / Âge</th>
                <th style={{ ...headBaseStyle, textAlign: "right" }}>Créée le</th>
                <th style={{ ...headBaseStyle, textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {/* Loading */}
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 56, textAlign: "center" }}>
                    <Loader2 size={24} color={t.textMuted} style={{ animation: "spin 0.8s linear infinite" }} />
                    <div style={{ marginTop: 10, fontSize: 13, color: t.textMuted }}>Chargement des réclamations…</div>
                  </td>
                </tr>
              ) : error ? (
                /* Error */
                <tr>
                  <td colSpan={9} style={{ padding: 48, textAlign: "center" }}>
                    <AlertCircle size={30} color="#ef4444" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#dc2626" }}>{error}</div>
                    <button
                      onClick={() => setReloadKey((k) => k + 1)}
                      style={{
                        marginTop: 12, padding: "7px 16px", borderRadius: 8,
                        border: `1px solid ${t.border}`, background: "transparent",
                        color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Réessayer
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                /* Empty */
                <tr>
                  <td colSpan={9} style={{ padding: 56, textAlign: "center" }}>
                    <Inbox size={34} color={t.textFaint} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>Aucune réclamation</div>
                    <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
                      {hasFilters ? "Essayez de modifier vos filtres ou votre recherche." : `${user.first_name} n'a ouvert aucune réclamation.`}
                    </div>
                  </td>
                </tr>
              ) : (
                /* Rows */
                rows.map((r) => {
                  const pkgStatus = r.package?.status as PackageStatus | undefined;
                  const pkgColor = pkgStatus ? STATUS_COLORS[pkgStatus] : undefined;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(MANAGE_HREF)}
                      title="Ouvrir dans la gestion des réclamations"
                      style={{ borderBottom: `1px solid ${t.divider}`, cursor: "pointer", transition: "background 0.12s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* # */}
                      <td style={{ ...cellStyle, fontFamily: "monospace", fontWeight: 700, color: ORANGE, whiteSpace: "nowrap" }}>
                        #{r.id}
                      </td>

                      {/* Sujet + description */}
                      <td style={{ ...cellStyle, maxWidth: 300 }}>
                        <div style={{ fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.subject}
                        </div>
                        <div style={{ fontSize: 11.5, color: t.textFaint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.description}
                        </div>
                      </td>

                      {/* Type */}
                      <td style={cellStyle}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                          background: t.sectionBg, color: t.textSub, border: `1px solid ${t.border}`,
                        }}>
                          {RECLAMATION_TYPE_LABELS[r.type] ?? r.type}
                        </span>
                      </td>

                      {/* Colis lié */}
                      <td style={cellStyle}>
                        {r.package ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontFamily: "monospace", color: t.textSub, whiteSpace: "nowrap" }}>
                              <PackageIcon size={12} color={t.textFaint} />{r.package.tracking_number}
                            </span>
                            {pkgStatus && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start",
                                padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
                                background: pkgColor?.bg ?? "rgba(107,114,128,0.1)",
                                color: pkgColor?.text ?? "#6b7280",
                              }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: pkgColor?.dot ?? "#9ca3af" }} />
                                {STATUS_LABELS[pkgStatus] ?? r.package.status}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: t.textFaint }}>—</span>
                        )}
                      </td>

                      {/* Statut */}
                      <td style={cellStyle}><StatusBadge status={r.status} /></td>

                      {/* Priorité */}
                      <td style={cellStyle}><PriorityBadge priority={r.priority} /></td>

                      {/* SLA / Âge */}
                      <td style={cellStyle}>
                        <SlaChip sla={r.sla} color={t.textFaint} bg={t.sectionBg} />
                      </td>

                      {/* Créée le */}
                      <td style={{ ...cellStyle, textAlign: "right", color: t.textMuted, whiteSpace: "nowrap" }}>
                        {fmtDate(r.created_at)}
                      </td>

                      {/* Open affordance */}
                      <td style={{ ...cellStyle, textAlign: "right" }}>
                        <ExternalLink size={14} color={t.textFaint} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && !error && rows.length > 0 && lastPage > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 16px", borderTop: `1px solid ${t.divider}`, gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12.5, color: t.textMuted }}>
              Page {page} / {lastPage} · {total.toLocaleString("fr-DZ")} réclamation{total > 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px",
                  borderRadius: 8, border: `1px solid ${t.border}`, background: t.card,
                  color: page <= 1 ? t.textFaint : t.textSub, fontSize: 12.5, fontWeight: 600,
                  cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={14} /> Préc.
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px",
                  borderRadius: 8, border: `1px solid ${t.border}`, background: t.card,
                  color: page >= lastPage ? t.textFaint : t.textSub, fontSize: 12.5, fontWeight: 600,
                  cursor: page >= lastPage ? "not-allowed" : "pointer", opacity: page >= lastPage ? 0.5 : 1,
                }}
              >
                Suiv. <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── KPI tile (clickable filter) ── */
function KpiTile({ t, icon: Icon, label, value, accent, active, onClick }: {
  t: ExpTabProps["t"]; icon: React.ElementType; label: string;
  value: number | undefined; accent: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", cursor: "pointer", width: "100%",
        background: active ? accent + "12" : t.sectionBg,
        border: `1px solid ${active ? accent : t.border}`, borderRadius: 12,
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={accent} />
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 18, fontWeight: 800, color: t.text }}>
        {value == null ? "—" : value.toLocaleString("fr-DZ")}
      </span>
    </button>
  );
}
