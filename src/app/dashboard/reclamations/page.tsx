"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquareWarning, Package, Inbox, Loader2, CheckCircle2,
  Plus, Search, X, Send, Paperclip, Trash2, Download, AlertTriangle,
  User as UserIcon, Calendar, FileText, ChevronLeft, ChevronRight, RefreshCw, Clock,
  Lock, RotateCcw, SlidersHorizontal, Building2,
} from "lucide-react";
import { useIsDark, useTokens, PageHeader, Badge, ORANGE, type Tokens } from "../_ui";
import { getStoredUser } from "@/lib/api";
import { getAllStopDesks, type StopDesk } from "@/lib/geography";
import {
  getReclamations, getReclamationsMultiStatus, getReclamation, createReclamation, deleteReclamation,
  setReclamationStatus, reopenReclamation, assignReclamation, updateReclamation,
  addReclamationNote, uploadReclamationAttachments, deleteReclamationAttachment,
  getAssignableUsers, getReclamationAssignees, attachmentUrl, formatBytes, resolvePackageRef,
  getReclamationTypes,
  RECLAMATION_STATUSES, RECLAMATION_PRIORITIES, RECLAMATION_TYPES, RECLAMATION_TYPE_LABELS,
  type ReclamationListItem, type ReclamationDetail, type ReclamationStatus,
  type ReclamationPriority, type ReclamationType, type UserBrief, type ReclamationSla, type ReclamationAssignee,
} from "@/lib/reclamations";
import type { StaffUser } from "@/lib/users";

// ── Display meta ────────────────────────────────────────────────────────────
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

// ── Status board ──────────────────────────────────────────────────────────────
// Coarse grouping above the precise status filter. "Actives" is the default so
// resolved/closed tickets leave the working board and land in "Historique".
type Board = "actives" | "historique" | "toutes";
const BOARD_STATUSES: Record<Board, ReclamationStatus[]> = {
  actives:    ["open", "in_progress"],
  historique: ["resolved", "closed"],
  toutes:     [],
};
const BOARD_LABELS: Record<Board, string> = {
  actives: "Actives", historique: "Historique", toutes: "Toutes",
};

// True when a réclamation is archived (read-only) — mutations are 403'd server-side.
const isLockedStatus = (s: ReclamationStatus | string): boolean =>
  s === "resolved" || s === "closed";

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("fr-DZ", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fullName(u: UserBrief | StaffUser | null | undefined): string {
  if (!u) return "—";
  const n = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  return n || u.email || "—";
}
function initials(u: UserBrief | null | undefined): string {
  if (!u) return "?";
  return (`${(u.first_name ?? "").charAt(0)}${(u.last_name ?? "").charAt(0)}`).toUpperCase() || "?";
}
function inputStyle(t: Tokens): React.CSSProperties {
  return {
    width: "100%", padding: "9px 12px", borderRadius: 9, fontSize: 13,
    background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text,
    outline: "none", fontFamily: "inherit",
  };
}
// minutes → compact "Xm" / "Xh" / "Xj" (≥1 day shows days).
function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}j`;
}

// Threshold (minutes) past which an open ticket is flagged "old" (amber).
const SLA_OLD_MINUTES = 48 * 60;

// SLA clock chip: green "Résolu en X" for resolved/closed, age "Ouvert depuis X"
// for open/in_progress (amber when older than SLA_OLD_MINUTES, neutral otherwise).
function SlaChip({ sla, t, big = false }: { sla?: ReclamationSla | null; t: Tokens; big?: boolean }) {
  if (!sla) return null;
  let color: string, bg: string, label: string;
  let Icon: React.ElementType;
  if (sla.resolved && sla.time_to_solve_minutes != null) {
    color = "#22c55e"; bg = "#22c55e18"; Icon = CheckCircle2;
    label = `Résolu en ${formatDuration(sla.time_to_solve_minutes)}`;
  } else if (sla.age_minutes != null) {
    const old = sla.age_minutes > SLA_OLD_MINUTES;
    color = old ? "#f59e0b" : t.textMuted;
    bg = old ? "#f59e0b18" : t.sectionBg;
    Icon = Clock;
    label = `Ouvert depuis ${formatDuration(sla.age_minutes)}`;
  } else {
    return null;
  }
  return (
    <span title={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: big ? "5px 12px" : "3px 10px", borderRadius: 20, fontSize: big ? 12.5 : 11, fontWeight: 600, color, background: bg, whiteSpace: "nowrap" }}>
      <Icon size={big ? 14 : 12} />{label}
    </span>
  );
}

interface Counts { open: number; in_progress: number; resolved: number; closed: number; urgent: number; total: number; }

// ════════════════════════════════════════════════════════════════════════════
export default function AdminReclamationsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const me = useMemo(() => getStoredUser(), []);
  const isAdmin = me?.user_type === "admin";

  const [rows, setRows] = useState<ReclamationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({ open: 0, in_progress: 0, resolved: 0, closed: 0, urgent: 0, total: 0 });

  // status board (coarse grouping) + filters
  const [board, setBoard] = useState<Board>("actives");
  const [statusF, setStatusF] = useState<string>("");
  const [typeF, setTypeF] = useState<string>("");        // réclamation category
  const [priorityF, setPriorityF] = useState<string>("");
  const [assignedF, setAssignedF] = useState<string>("");
  const [sdF, setSdF] = useState<string>("");        // SD picker (admin only)
  const [dateFrom, setDateFrom] = useState<string>(""); // created_at ≥ (du)
  const [dateTo, setDateTo] = useState<string>("");     // created_at ≤ (au, end-of-day)
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");

  // Stop-desks for the SD select + resolving SD names in the list column.
  const [stopDesks, setStopDesks] = useState<StopDesk[]>([]);
  const sdName = useCallback(
    (id: number | null | undefined): string | null => {
      if (id == null) return null;
      return stopDesks.find((sd) => sd.id === id)?.name ?? null;
    },
    [stopDesks],
  );

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignees, setAssignees] = useState<ReclamationAssignee[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // debounce search
  useEffect(() => {
    const h = setTimeout(() => { setSearch(searchRaw.trim()); setPage(1); }, 350);
    return () => clearTimeout(h);
  }, [searchRaw]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    // The board scopes which statuses are in view; a concrete status pick in the
    // dropdown narrows within it. ≤1 status → exact server-side pagination;
    // 2 statuses (a board's "all" view) → client-side merge.
    const scope = BOARD_STATUSES[board];
    const effective = statusF ? [statusF] : scope;
    const shared = {
      type: typeF || undefined,
      priority: priorityF || undefined,
      assigned_to: assignedF || undefined,
      stop_desk_id: (isAdmin && sdF) || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: search || undefined,
    };
    if (effective.length >= 2) {
      const data = await getReclamationsMultiStatus(effective, shared, page, 20);
      setRows(data.data);
      setLastPage(data.last_page);
      setTotal(data.total);
    } else {
      const res = await getReclamations({
        ...shared,
        status: effective[0] || undefined,
        page,
        per_page: 20,
      });
      if (res.success && res.data) {
        setRows(res.data.data);
        setLastPage(res.data.last_page);
        setTotal(res.data.total);
      } else {
        setError(res.message || "Impossible de charger les réclamations.");
        setRows([]);
      }
    }
    setLoading(false);
  }, [board, statusF, typeF, priorityF, assignedF, sdF, dateFrom, dateTo, isAdmin, search, page]);

  const loadCounts = useCallback(async () => {
    const [o, ip, rs, cl, ur, tot] = await Promise.all([
      getReclamations({ status: "open", per_page: 1 }),
      getReclamations({ status: "in_progress", per_page: 1 }),
      getReclamations({ status: "resolved", per_page: 1 }),
      getReclamations({ status: "closed", per_page: 1 }),
      getReclamations({ priority: "urgent", per_page: 1 }),
      getReclamations({ per_page: 1 }),
    ]);
    setCounts({
      open: o.data?.total ?? 0,
      in_progress: ip.data?.total ?? 0,
      resolved: rs.data?.total ?? 0,
      closed: cl.data?.total ?? 0,
      urgent: ur.data?.total ?? 0,
      total: tot.data?.total ?? 0,
    });
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { getAssignableUsers().then(setStaff).catch(() => setStaff([])); }, []);
  useEffect(() => {
    getAllStopDesks()
      .then((r) => setStopDesks(r.success && r.data ? r.data : []))
      .catch(() => setStopDesks([]));
  }, []);
  useEffect(() => {
    getReclamationAssignees()
      .then((r) => setAssignees(r.success && r.data ? r.data : []))
      .catch(() => setAssignees([]));
  }, []);

  const refreshAll = useCallback(() => { loadList(); loadCounts(); }, [loadList, loadCounts]);

  const resetFilters = () => {
    setStatusF(""); setTypeF(""); setPriorityF(""); setAssignedF(""); setSdF("");
    setDateFrom(""); setDateTo(""); setSearchRaw(""); setSearch(""); setPage(1);
  };
  const activeFilterCount =
    (statusF ? 1 : 0) + (typeF ? 1 : 0) + (priorityF ? 1 : 0) + (assignedF ? 1 : 0) +
    (isAdmin && sdF ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (search ? 1 : 0);
  const hasFilters = activeFilterCount > 0;

  // Switching board resets the (now board-scoped) status pick and pagination.
  const changeBoard = (b: Board) => { setBoard(b); setStatusF(""); setPage(1); };
  const boardCount = (b: Board): number =>
    b === "actives" ? counts.open + counts.in_progress
    : b === "historique" ? counts.resolved + counts.closed
    : counts.total;
  // The status dropdown only offers statuses within the active board.
  const boardStatusOptions: ReclamationStatus[] =
    board === "toutes" ? [...RECLAMATION_STATUSES] : BOARD_STATUSES[board];

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="Réclamations"
        subtitle="Gestion centralisée des tickets et réclamations"
        icon={MessageSquareWarning}
        t={t}
        action={
          <button onClick={() => setShowCreate(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", background: ORANGE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(249,115,22,0.3)" }}>
            <Plus size={16} /> Nouvelle réclamation
          </button>
        }
      />

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <Kpi label="Ouvertes" value={counts.open} icon={Inbox} accent="#3b82f6" t={t} />
        <Kpi label="En cours" value={counts.in_progress} icon={Loader2} accent="#f59e0b" t={t} />
        <Kpi label="Résolues" value={counts.resolved} icon={CheckCircle2} accent="#22c55e" t={t} />
        <Kpi label="Urgentes" value={counts.urgent} icon={AlertTriangle} accent="#ef4444" t={t} />
      </div>

      {/* Status board (segmented) */}
      <div style={{ display: "inline-flex", gap: 4, padding: 4, marginBottom: 16, background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 11 }}>
        {(["actives", "historique", "toutes"] as const).map((b) => {
          const active = board === b;
          return (
            <button key={b} onClick={() => changeBoard(b)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", background: active ? t.card : "transparent", color: active ? ORANGE : t.textMuted, boxShadow: active ? t.shadow : "none" }}>
              {BOARD_LABELS[b]}
              <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: active ? ORANGE + "1a" : t.border, color: active ? ORANGE : t.textMuted }}>{boardCount(b)}</span>
            </button>
          );
        })}
      </div>

      {/* Aggressive filter bar (combines with the status-board tab) */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, marginBottom: 18, boxShadow: t.shadow }}>
        {/* Header: title + active count + result count + refresh + reset */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: t.text }}>
            <SlidersHorizontal size={16} color={ORANGE} /> Filtres
            {hasFilters && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: ORANGE + "1f", color: ORANGE }}>
                {activeFilterCount} actif{activeFilterCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textMuted }}>
              {total} résultat{total > 1 ? "s" : ""}
            </span>
            <button onClick={refreshAll} title="Actualiser" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, border: `1px solid ${t.border}`, background: t.card, color: t.textSub, cursor: "pointer" }}>
              <RefreshCw size={15} />
            </button>
            <button onClick={resetFilters} disabled={!hasFilters}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.card, color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: hasFilters ? "pointer" : "default", opacity: hasFilters ? 1 : 0.5 }}>
              <RotateCcw size={14} /> Réinitialiser
            </button>
          </div>
        </div>

        {/* Search (full width) */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
          <input value={searchRaw} onChange={(e) => setSearchRaw(e.target.value)} placeholder="Rechercher — sujet ou description…"
            style={{ ...inputStyle(t), padding: "9px 32px 9px 34px" }} />
          {searchRaw && (
            <button onClick={() => setSearchRaw("")} aria-label="Effacer la recherche"
              style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Selects + date range */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
          {/* SD picker — admin only (responsable/operator are auto-scoped server-side). */}
          {isAdmin && (
            <FilterField label="Stop-desk" t={t}>
              <select value={sdF} onChange={(e) => { setSdF(e.target.value); setPage(1); }} style={{ ...inputStyle(t), cursor: "pointer" }}>
                <option value="">Tous les stop-desks</option>
                {stopDesks.map((sd) => <option key={sd.id} value={sd.id}>{sd.name}{sd.code ? ` (${sd.code})` : ""}</option>)}
              </select>
            </FilterField>
          )}
          <FilterField label="Statut" t={t}>
            <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }} style={{ ...inputStyle(t), cursor: "pointer" }}>
              <option value="">{board === "toutes" ? "Tous les statuts" : `Tous (${BOARD_LABELS[board].toLowerCase()})`}</option>
              {boardStatusOptions.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </FilterField>
          <FilterField label="Type" t={t}>
            <select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }} style={{ ...inputStyle(t), cursor: "pointer" }}>
              <option value="">Tous les types</option>
              {RECLAMATION_TYPES.map((ty) => <option key={ty} value={ty}>{RECLAMATION_TYPE_LABELS[ty]}</option>)}
            </select>
          </FilterField>
          <FilterField label="Priorité" t={t}>
            <select value={priorityF} onChange={(e) => { setPriorityF(e.target.value); setPage(1); }} style={{ ...inputStyle(t), cursor: "pointer" }}>
              <option value="">Toutes priorités</option>
              {RECLAMATION_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </FilterField>
          <FilterField label="Assigné à" t={t}>
            <select value={assignedF} onChange={(e) => { setAssignedF(e.target.value); setPage(1); }} style={{ ...inputStyle(t), cursor: "pointer" }}>
              <option value="">Tous les agents</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{fullName(u)}</option>)}
            </select>
          </FilterField>
          <FilterField label="Créée — du" t={t}>
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={inputStyle(t)} />
          </FilterField>
          <FilterField label="Créée — au" t={t}>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={inputStyle(t)} />
          </FilterField>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}`, background: t.sectionBg }}>
                {["#", "Sujet", "Type", "Colis", "SD", "Priorité", "Assigné à", "Activité", "Créée le", "SLA", "Statut"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: t.textMuted }}>
                  <Loader2 size={22} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                  <div style={{ marginTop: 10, fontSize: 13 }}>Chargement…</div>
                </td></tr>
              )}
              {!loading && error && (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
                  <AlertTriangle size={22} /><div style={{ marginTop: 8 }}>{error}</div>
                  <button onClick={loadList} style={{ marginTop: 12, padding: "7px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Réessayer</button>
                </td></tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: t.textMuted }}>
                  <Inbox size={26} color={t.textFaint} />
                  <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600 }}>Aucune réclamation</div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>{hasFilters ? "Aucun résultat pour ces filtres." : board === "actives" ? "Aucune réclamation active." : board === "historique" ? "Aucune réclamation clôturée." : "Créez la première réclamation."}</div>
                </td></tr>
              )}
              {!loading && !error && rows.map((r) => {
                const sm = STATUS_META[r.status] ?? { label: r.status, color: t.textMuted };
                const pm = PRIORITY_META[r.priority] ?? { label: r.priority, color: t.textMuted };
                return (
                  <tr key={r.id} onClick={() => setDetailId(r.id)}
                    style={{ borderBottom: `1px solid ${t.divider}`, cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: ORANGE, whiteSpace: "nowrap" }}>#{r.id}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: t.text, maxWidth: 320 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</div>
                      <div style={{ fontSize: 11, color: t.textFaint, fontWeight: 400, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Badge color={t.textSub} bg={t.sectionBg}>{RECLAMATION_TYPE_LABELS[r.type] ?? r.type}</Badge>
                    </td>
                    <td style={{ padding: "12px 16px", color: t.textSub }}>
                      {r.package ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontFamily: "monospace", color: t.textSub }}>
                          <Package size={12} color={t.textFaint} />{r.package.tracking_number}
                        </span>
                      ) : <span style={{ color: t.textFaint }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px", color: t.textSub, whiteSpace: "nowrap" }}>
                      {(() => {
                        const name = r.stop_desk?.name ?? sdName(r.stop_desk_id);
                        return name ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                            <Building2 size={12} color={t.textFaint} />{name}
                          </span>
                        ) : <span style={{ color: t.textFaint }}>—</span>;
                      })()}
                    </td>
                    <td style={{ padding: "12px 16px" }}><Badge color={pm.color} bg={pm.color + "18"}>{pm.label}</Badge></td>
                    <td style={{ padding: "12px 16px", color: t.textSub, whiteSpace: "nowrap" }}>
                      {r.assignee ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><UserIcon size={12} color={t.textFaint} />{fullName(r.assignee)}</span>
                      ) : <span style={{ color: t.textFaint, fontStyle: "italic" }}>Non assigné</span>}
                    </td>
                    <td style={{ padding: "12px 16px", color: t.textMuted, whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }} title="Notes"><MessageSquareWarning size={12} />{r.notes_count}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }} title="Pièces jointes"><Paperclip size={12} />{r.attachments_count}</span>
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: t.textMuted, whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {r.sla ? <SlaChip sla={r.sla} t={t} /> : <span style={{ color: t.textFaint }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Badge color={sm.color} bg={sm.color + "18"}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.color }} />{sm.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && rows.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: `1px solid ${t.divider}`, fontSize: 12.5, color: t.textMuted }}>
            <span>{total} réclamation{total > 1 ? "s" : ""} · page {page}/{lastPage}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 11px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>
                <ChevronLeft size={14} /> Préc.
              </button>
              <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 11px", borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: page >= lastPage ? "not-allowed" : "pointer", opacity: page >= lastPage ? 0.5 : 1 }}>
                Suiv. <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes slideInR { from { transform: translateX(100%) } to { transform: translateX(0) } } @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      {showCreate && (
        <CreateModal t={t}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); refreshAll(); setDetailId(id); }} />
      )}

      {detailId != null && (
        <DetailDrawer id={detailId} t={t} isDark={isDark} assignees={assignees} isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
          onChanged={refreshAll}
          onDeleted={() => { setDetailId(null); refreshAll(); }} />
      )}
    </div>
  );
}

// ── Filter field (label + control) ────────────────────────────────────────────
function FilterField({ label, t, children }: { label: string; t: Tokens; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
      {children}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function Kpi({ label, value, icon: Icon, accent, t }: { label: string; value: number; icon: React.ElementType; accent: string; t: Tokens }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 150, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", boxShadow: t.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={17} color={accent} /></div>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{value}</div>
    </div>
  );
}

// ── Colis auto-detect hint (green=found / amber=not found / muted=checking) ────
function PkgHint({ state, value, t }: {
  state: "idle" | "checking" | "found" | "notfound"; value: string; t: Tokens;
}) {
  if (state === "idle") return null;
  const base: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: 12, fontWeight: 600 };
  if (state === "checking") return <div style={{ ...base, color: t.textMuted }}><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Recherche du colis…</div>;
  if (state === "found") return <div style={{ ...base, color: "#22c55e" }}><CheckCircle2 size={13} /> Colis détecté : {value}</div>;
  return <div style={{ ...base, color: "#f59e0b" }}><AlertTriangle size={13} /> Colis introuvable</div>;
}

// ════════════════════════════════════════════════════════════════════════════
// Create modal
function CreateModal({ t, onClose, onCreated }: {
  t: Tokens; onClose: () => void; onCreated: (id: number) => void;
}) {
  const [type, setType] = useState<ReclamationType>("colis");
  const [typeOpts, setTypeOpts] = useState<{ key: string; label: string }[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ReclamationPriority>("normal");
  const [pkgRef, setPkgRef] = useState("");
  const [pkgId, setPkgId] = useState<number | null>(null);
  const [pkgState, setPkgState] = useState<"idle" | "checking" | "found" | "notfound">("idle");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Type options from the backend; fall back to the static list if unavailable.
  useEffect(() => {
    getReclamationTypes()
      .then((r) => { if (r.success && r.data?.length) setTypeOpts(r.data); })
      .catch(() => {});
  }, []);
  const types = typeOpts.length ? typeOpts : RECLAMATION_TYPES.map((k) => ({ key: k, label: RECLAMATION_TYPE_LABELS[k] }));

  // Auto-detect the colis as the user types/scans the tracking (debounced). Only
  // runs for type === 'colis'; reuses resolvePackageRef (tracking → package id).
  useEffect(() => {
    if (type !== "colis") { setPkgId(null); setPkgState("idle"); return; }
    const ref = pkgRef.trim();
    if (!ref) { setPkgId(null); setPkgState("idle"); return; }
    setPkgState("checking");
    let cancelled = false;
    const h = setTimeout(async () => {
      const id = await resolvePackageRef(ref);
      if (cancelled) return;
      if (id != null) { setPkgId(id); setPkgState("found"); }
      else { setPkgId(null); setPkgState("notfound"); }
    }, 400);
    return () => { cancelled = true; clearTimeout(h); };
  }, [pkgRef, type]);

  async function submit() {
    if (!subject.trim() || !description.trim()) { setErr("Le sujet et la description sont requis."); return; }
    setSaving(true);
    setErr(null);
    // 'colis' links the resolved package (encouraged, not required); other types
    // are package-less.
    const res = await createReclamation({
      type,
      subject: subject.trim(),
      description: description.trim(),
      priority,
      package_id: type === "colis" ? pkgId : null,
    });
    setSaving(false);
    if (res.success && res.data) onCreated(res.data.id);
    else setErr(res.message || "Échec de la création.");
  }

  const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.15s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: t.card, borderRadius: 16, border: `1px solid ${t.border}`, boxShadow: "0 24px 60px rgba(0,0,0,0.3)", fontFamily: "var(--font-jakarta, sans-serif)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${t.divider}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: ORANGE + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><MessageSquareWarning size={19} color={ORANGE} /></div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>Nouvelle réclamation</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex" }}><X size={20} /></button>
        </div>

        <div style={{ padding: 22, overflowY: "auto" }}>
          {err && <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 9, background: "#ef444415", border: "1px solid #ef444433", color: "#ef4444", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={15} />{err}</div>}

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReclamationType)} style={{ ...inputStyle(t), cursor: "pointer" }}>
              {types.map((ty) => <option key={ty.key} value={ty.key}>{ty.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Sujet *</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255} placeholder="Ex. Colis endommagé à la réception" style={inputStyle(t)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Décrivez le problème en détail…" style={{ ...inputStyle(t), resize: "vertical", minHeight: 90 }} />
          </div>
          <div style={{ marginBottom: type === "colis" ? 16 : 0 }}>
            <label style={label}>Priorité</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as ReclamationPriority)} style={{ ...inputStyle(t), cursor: "pointer" }}>
              {RECLAMATION_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </div>
          {type === "colis" && (
            <div>
              <label style={label}>Tracking du colis</label>
              <input value={pkgRef} onChange={(e) => setPkgRef(e.target.value)} placeholder="Scannez ou saisissez le n° de suivi…" style={{ ...inputStyle(t), fontFamily: "monospace" }} />
              <PkgHint state={pkgState} value={pkgRef.trim()} t={t} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px", borderTop: `1px solid ${t.divider}` }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.card, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "none", background: ORANGE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={15} />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Detail drawer — the rich part
function DetailDrawer({ id, t, isDark, assignees, isAdmin, onClose, onChanged, onDeleted }: {
  id: number; t: Tokens; isDark: boolean; assignees: ReclamationAssignee[]; isAdmin: boolean;
  onClose: () => void; onChanged: () => void; onDeleted: () => void;
}) {
  const [data, setData] = useState<ReclamationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getReclamation(id);
    if (res.success && res.data) { setData(res.data); setErr(null); }
    else setErr(res.message || "Réclamation introuvable.");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // run a mutation, refresh detail + parent list
  const run = useCallback(async (fn: () => Promise<{ success: boolean; message?: string }>) => {
    setBusy(true);
    setNotice(null);
    const res = await fn();
    if (!res.success) setNotice(res.message || "L'action a échoué.");
    await load();
    onChanged();
    setBusy(false);
    return res.success;
  }, [load, onChanged]);

  async function changeStatus(s: ReclamationStatus) {
    if (data && s !== data.status) await run(() => setReclamationStatus(id, s));
  }
  async function changePriority(p: ReclamationPriority) {
    if (data && p !== data.priority) await run(() => updateReclamation(id, { priority: p }));
  }
  async function changeAssignee(v: string) {
    await run(() => assignReclamation(id, v ? Number(v) : null));
  }
  async function addNote() {
    const body = noteText.trim();
    if (!body) return;
    const ok = await run(() => addReclamationNote(id, body));
    if (ok) setNoteText("");
  }
  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setNotice(null);
    const res = await uploadReclamationAttachments(id, Array.from(files));
    if (!res.success) setNotice(res.message || "Échec de l'envoi du fichier.");
    if (fileRef.current) fileRef.current.value = "";
    await load();
    onChanged();
    setUploading(false);
  }
  async function removeAttachment(attId: number) {
    await run(() => deleteReclamationAttachment(attId));
  }
  async function removeTicket() {
    if (!confirm("Supprimer définitivement cette réclamation ?")) return;
    setBusy(true);
    const res = await deleteReclamation(id);
    setBusy(false);
    if (res.success) onDeleted();
    else setNotice(res.message || "Suppression impossible.");
  }
  async function reopen() {
    await run(() => reopenReclamation(id));
  }

  // Resolved/closed → archived & read-only. The backend 403s every mutation
  // (except an admin reopen), so the UI disables the controls to match.
  const locked = !!data && isLockedStatus(data.status);

  const sm = data ? (STATUS_META[data.status] ?? { label: data.status, color: t.textMuted }) : null;
  const pm = data ? (PRIORITY_META[data.priority] ?? { label: data.priority, color: t.textMuted }) : null;
  const sectionHead: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.6, margin: "22px 0 10px" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, height: "100%", background: t.card, borderLeft: `1px solid ${t.border}`, boxShadow: "-16px 0 48px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", fontFamily: "var(--font-jakarta, sans-serif)", animation: "slideInR 0.22s ease" }}>

        {/* Header */}
        <div style={{ borderBottom: `1px solid ${t.border}`, padding: "18px 22px", flexShrink: 0, background: sm ? `linear-gradient(135deg, ${sm.color}12 0%, ${sm.color}04 100%)` : undefined }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: ORANGE, fontSize: 13 }}>#{id}</span>
                {sm && <Badge color={sm.color} bg={sm.color + "18"}><span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.color }} />{sm.label}</Badge>}
                {pm && <Badge color={pm.color} bg={pm.color + "18"}>{pm.label}</Badge>}
                {data?.sla && <SlaChip sla={data.sla} t={t} big />}
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text, lineHeight: 1.3 }}>{data?.subject ?? "…"}</h2>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {isAdmin && data && (
                <button onClick={removeTicket} disabled={busy} title="Supprimer" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} color="#ef4444" /></button>
              )}
              <button onClick={onClose} title="Fermer" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} color={t.textMuted} /></button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 22px 28px" }}>
          {loading && <div style={{ padding: 50, textAlign: "center", color: t.textMuted }}><Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} /><div style={{ marginTop: 10 }}>Chargement…</div></div>}
          {!loading && err && <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}><AlertTriangle size={22} /><div style={{ marginTop: 8 }}>{err}</div></div>}

          {!loading && data && (
            <>
              {notice && <div style={{ marginTop: 14, padding: "9px 12px", borderRadius: 9, background: "#ef444415", border: "1px solid #ef444433", color: "#ef4444", fontSize: 12.5 }}>{notice}</div>}

              {/* Lock banner (read-only) */}
              {locked && (
                <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "#f59e0b14", border: "1px solid #f59e0b40", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Lock size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 160, fontSize: 12.5, fontWeight: 600, color: t.text }}>Réclamation clôturée — lecture seule.</span>
                  {isAdmin && (
                    <button onClick={reopen} disabled={busy}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: "none", background: ORANGE, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, flexShrink: 0 }}>
                      <RotateCcw size={14} /> Rouvrir
                    </button>
                  )}
                </div>
              )}

              {/* Description */}
              <div style={sectionHead}>Description</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: t.textSub, whiteSpace: "pre-wrap" }}>{data.description}</p>

              {/* Meta */}
              <div style={sectionHead}>Informations</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Meta t={t} icon={Package} label="Colis lié" value={data.package ? data.package.tracking_number : "Aucun"} mono={!!data.package} />
                <Meta t={t} icon={UserIcon} label="Créée par" value={fullName(data.creator)} />
                <Meta t={t} icon={Calendar} label="Créée le" value={fmtDateTime(data.created_at)} />
                <Meta t={t} icon={RefreshCw} label="Mise à jour" value={fmtDateTime(data.updated_at)} />
              </div>

              {/* Controls */}
              <div style={sectionHead}>Statut</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {RECLAMATION_STATUSES.map((s) => {
                  const active = data.status === s; const c = STATUS_META[s].color;
                  return (
                    <button key={s} disabled={busy || locked} onClick={() => changeStatus(s)}
                      style={{ padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: locked ? "not-allowed" : busy ? "wait" : "pointer", opacity: locked && !active ? 0.5 : 1, border: `1px solid ${active ? c : t.border}`, background: active ? c + "18" : t.card, color: active ? c : t.textSub, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />{STATUS_META[s].label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
                <div style={{ flex: "1 1 200px" }}>
                  <div style={sectionHead}>Priorité</div>
                  <select value={data.priority} disabled={busy || locked} onChange={(e) => changePriority(e.target.value as ReclamationPriority)} style={{ ...inputStyle(t), cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.6 : 1 }}>
                    {RECLAMATION_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                  </select>
                </div>
                <div style={{ flex: "1 1 200px" }}>
                  <div style={sectionHead}>Assigné à</div>
                  <select value={data.assigned_to ?? ""} disabled={busy || locked} onChange={(e) => changeAssignee(e.target.value)} style={{ ...inputStyle(t), cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.6 : 1 }}>
                    <option value="">Non assigné</option>
                    {/* Keep the current assignee selectable even if they're no longer
                        an eligible assignee (e.g. permission later revoked). */}
                    {data.assigned_to != null && !assignees.some((u) => u.id === data.assigned_to) && (
                      <option value={data.assigned_to}>{fullName(data.assignee)} (actuel)</option>
                    )}
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {`${u.first_name} ${u.last_name}`.trim() || `#${u.id}`}{u.role_name ? ` · ${u.role_name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Attachments */}
              <div style={sectionHead}>Pièces jointes ({data.attachments.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.attachments.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.sectionBg }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: isDark ? "rgba(255,255,255,0.05)" : "#fff", border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={15} color={t.textMuted} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.file_name}</div>
                      <div style={{ fontSize: 11, color: t.textFaint }}>{formatBytes(a.size)} · {fmtDate(a.created_at)}</div>
                    </div>
                    <a href={attachmentUrl(a.file_path)} target="_blank" rel="noopener noreferrer" download title="Télécharger"
                      style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${t.border}`, background: t.card, display: "flex", alignItems: "center", justifyContent: "center", color: "#0ea5e9" }}><Download size={14} /></a>
                    {!locked && (
                      <button onClick={() => removeAttachment(a.id)} disabled={busy} title="Supprimer" style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${t.border}`, background: t.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={14} color="#ef4444" /></button>
                    )}
                  </div>
                ))}
                {data.attachments.length === 0 && <div style={{ fontSize: 12.5, color: t.textFaint, fontStyle: "italic" }}>Aucune pièce jointe.</div>}
                {!locked && (
                  <>
                    <input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 10, border: `1px dashed ${t.border}`, background: t.card, color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: uploading ? "wait" : "pointer", marginTop: 2 }}>
                      {uploading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Paperclip size={15} />}
                      {uploading ? "Envoi…" : "Ajouter des fichiers"}
                    </button>
                  </>
                )}
              </div>

              {/* Notes timeline */}
              <div style={sectionHead}>Activité & notes ({data.notes.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {data.notes.map((n) => {
                  const system = /^Statut changé en/i.test(n.body);
                  return (
                    <div key={n.id} style={{ display: "flex", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: system ? t.sectionBg : ORANGE + "1a", border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: system ? t.textMuted : ORANGE }}>
                        {system ? "•" : initials(n.user)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{fullName(n.user)}</span>
                          <span style={{ fontSize: 11, color: t.textFaint }}>{fmtDateTime(n.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 13, color: system ? t.textMuted : t.textSub, marginTop: 3, fontStyle: system ? "italic" : "normal", whiteSpace: "pre-wrap" }}>{n.body}</div>
                      </div>
                    </div>
                  );
                })}
                {data.notes.length === 0 && <div style={{ fontSize: 12.5, color: t.textFaint, fontStyle: "italic" }}>Aucune note pour le moment.</div>}
              </div>

              {/* Composer (hidden once read-only) */}
              {!locked && (
                <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} placeholder="Ajouter une note…"
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(); }}
                    style={{ ...inputStyle(t), resize: "vertical", minHeight: 44 }} />
                  <button onClick={addNote} disabled={busy || !noteText.trim()}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 16px", borderRadius: 9, border: "none", background: ORANGE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy || !noteText.trim() ? "not-allowed" : "pointer", opacity: busy || !noteText.trim() ? 0.6 : 1, flexShrink: 0 }}>
                    <Send size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ t, icon: Icon, label, value, mono }: { t: Tokens; icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: t.sectionBg, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={14} color={t.textMuted} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, marginTop: 2, fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}
