"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  History, Loader2, Search, Filter, X, AlertCircle, Inbox,
  ChevronLeft, ChevronRight, User as UserIcon, Globe,
} from "lucide-react";
import { getStoredUser } from "@/lib/api";
import { getUsers, type StaffUser } from "@/lib/users";
import {
  getActivityLogs, formatActivityDate, activityUserName, activityActionColor,
  type ActivityLog, type ActivityLogFilters,
} from "@/lib/activity";

const ORANGE = "#f97316";
const PER_PAGE = 20;

/* ── dark-mode hook ──────────────────────────────────────── */
function useIsDark() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/* ── design tokens ───────────────────────────────────────── */
function useTokens(isDark: boolean) {
  return isDark ? {
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" }, sectionBg: "#0f1623",
    head: "#0f1623",
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" }, sectionBg: "#f9fafb",
    head: "#f9fafb",
  };
}
type T = ReturnType<typeof useTokens>;

/* ── filter input ────────────────────────────────────────── */
function FilterInput({ t, value, onChange, placeholder, icon: Icon, type = "text", style }: {
  t: T; value: string; onChange: (v: string) => void; placeholder?: string;
  icon?: typeof Search; type?: string; style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative", ...style }}>
      {Icon && (
        <Icon size={14} style={{
          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          color: focused ? ORANGE : t.textMuted, pointerEvents: "none", transition: "color 0.15s",
        }} />
      )}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", boxSizing: "border-box", background: t.inp.bg,
          border: `1.5px solid ${focused ? ORANGE : t.inp.border}`,
          borderRadius: 9, padding: Icon ? "9px 12px 9px 32px" : "9px 12px",
          fontSize: 13, color: t.inp.text, outline: "none", minHeight: 40,
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxShadow: focused ? `0 0 0 3px ${ORANGE}1f` : "none",
        }}
      />
    </div>
  );
}

/* ── action badge ────────────────────────────────────────── */
function ActionBadge({ action }: { action: string }) {
  const c = activityActionColor(action);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 7,
      fontSize: 11.5, fontWeight: 600, color: c, background: `${c}16`, border: `1px solid ${c}2e`,
      whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis",
    }}>
      {action}
    </span>
  );
}

/* ── empty filter shape ──────────────────────────────────── */
const EMPTY = { search: "", action: "", subject_type: "", user_id: "", date_from: "", date_to: "" };

export default function ActivityLogsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // admin gate — page is admin-only (backend also enforces with a 403)
  const [me, setMe] = useState<ReturnType<typeof getStoredUser>>(null);
  const [meResolved, setMeResolved] = useState(false);
  useEffect(() => { setMe(getStoredUser()); setMeResolved(true); }, []);
  const isAdmin = me?.user_type === "admin";

  // raw filter inputs (text fields are debounced before they hit the query)
  const [raw, setRaw] = useState({ ...EMPTY });
  const [filters, setFilters] = useState({ ...EMPTY });

  // user dropdown options
  const [users, setUsers] = useState<StaffUser[]>([]);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // debounce the text inputs (search / action / subject_type) → commit to `filters`
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(f => ({ ...f, search: raw.search, action: raw.action, subject_type: raw.subject_type }));
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [raw.search, raw.action, raw.subject_type]);

  // selects / dates apply immediately
  useEffect(() => {
    setFilters(f => ({ ...f, user_id: raw.user_id, date_from: raw.date_from, date_to: raw.date_to }));
  }, [raw.user_id, raw.date_from, raw.date_to]);

  // reset to page 1 whenever any committed filter changes
  useEffect(() => { setPage(1); }, [
    filters.search, filters.action, filters.subject_type,
    filters.user_id, filters.date_from, filters.date_to,
  ]);

  // load staff users for the "who" dropdown (best-effort)
  useEffect(() => {
    if (!isAdmin) return;
    getUsers().then(res => {
      if (res.success && Array.isArray(res.data)) setUsers(res.data);
    });
  }, [isAdmin]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    const params: ActivityLogFilters = {
      page, per_page: PER_PAGE,
      search: filters.search || undefined,
      action: filters.action || undefined,
      subject_type: filters.subject_type || undefined,
      user_id: filters.user_id || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    };
    const res = await getActivityLogs(params);
    if (res.success && res.data) {
      setLogs(res.data.data);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    } else {
      setLogs([]);
      setLastPage(1);
      setTotal(0);
      setError(res.message || "Impossible de charger le journal d'activité.");
    }
    setLoading(false);
  }, [isAdmin, page, filters]);

  useEffect(() => { load(); }, [load]);

  const hasActiveFilter = Object.values(filters).some(v => v !== "");
  const resetFilters = () => { setRaw({ ...EMPTY }); setFilters({ ...EMPTY }); };

  // ── Access gate ──────────────────────────────────────────
  if (meResolved && !isAdmin) {
    return (
      <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderRadius: 12,
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444", fontSize: 13, fontWeight: 600, maxWidth: 520,
        }}>
          <AlertCircle size={16} /> Accès réservé aux administrateurs.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
        }}>
          <History size={20} style={{ color: ORANGE }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Journal d&apos;activité</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
            Piste d&apos;audit — actions des utilisateurs (du plus récent au plus ancien)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: "14px 16px", boxShadow: t.shadow, marginBottom: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <FilterInput t={t} icon={Search} value={raw.search} onChange={v => setRaw(p => ({ ...p, search: v }))}
            placeholder="Rechercher (action, description, sujet)…" style={{ flex: "2 1 240px" }} />
          <FilterInput t={t} icon={Filter} value={raw.action} onChange={v => setRaw(p => ({ ...p, action: v }))}
            placeholder="Action" style={{ flex: "1 1 140px" }} />
          <FilterInput t={t} value={raw.subject_type} onChange={v => setRaw(p => ({ ...p, subject_type: v }))}
            placeholder="Type de sujet" style={{ flex: "1 1 140px" }} />

          {/* user select */}
          <div style={{ position: "relative", flex: "1 1 170px" }}>
            <UserIcon size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: t.textMuted, pointerEvents: "none" }} />
            <select
              value={raw.user_id}
              onChange={e => setRaw(p => ({ ...p, user_id: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box", background: t.inp.bg,
                border: `1.5px solid ${t.inp.border}`, borderRadius: 9,
                padding: "9px 12px 9px 32px", fontSize: 13, color: t.inp.text,
                outline: "none", minHeight: 40, cursor: "pointer", appearance: "auto",
              }}
            >
              <option value="">Tous les utilisateurs</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>

          <FilterInput t={t} type="date" value={raw.date_from} onChange={v => setRaw(p => ({ ...p, date_from: v }))} style={{ flex: "0 1 150px" }} />
          <FilterInput t={t} type="date" value={raw.date_to} onChange={v => setRaw(p => ({ ...p, date_to: v }))} style={{ flex: "0 1 150px" }} />

          {hasActiveFilter && (
            <button onClick={resetFilters} title="Réinitialiser les filtres"
              style={{
                display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                background: "transparent", border: `1.5px solid ${t.border}`, borderRadius: 9,
                padding: "9px 12px", fontSize: 12, fontWeight: 600, color: t.textSub,
                cursor: "pointer", minHeight: 40,
              }}>
              <X size={13} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Table card */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        {/* count bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderBottom: `1px solid ${t.divider}`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
            {loading ? "Chargement…" : `${total} entrée${total > 1 ? "s" : ""}`}
          </span>
        </div>

        {error ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 24px", color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
            <AlertCircle size={16} /> {error}
          </div>
        ) : loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 48, color: t.textMuted, fontSize: 13, justifyContent: "center" }}>
            <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement…
          </div>
        ) : logs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "52px 24px", color: t.textFaint }}>
            <Inbox size={30} />
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: t.textMuted }}>Aucune activité</p>
            <p style={{ margin: 0, fontSize: 12 }}>
              {hasActiveFilter ? "Aucune entrée ne correspond à ces filtres." : "Aucune entrée enregistrée pour le moment."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: t.head }}>
                  {["Quand", "Utilisateur", "Action", "Sujet", "IP", "Description"].map(h => (
                    <th key={h} style={{
                      textAlign: "left", padding: "10px 16px", fontSize: 10.5, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.07em", color: t.textFaint,
                      borderBottom: `1px solid ${t.divider}`, whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${t.divider}` }}>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap", color: t.textSub, fontVariantNumeric: "tabular-nums" }}>
                      {formatActivityDate(log.created_at)}
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 600, color: t.text }}>{activityUserName(log)}</span>
                      {log.user && log.user_id != null && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: t.textFaint }}>#{log.user_id}</span>
                      )}
                    </td>
                    <td style={{ padding: "11px 16px" }}><ActionBadge action={log.action} /></td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap", color: t.textSub }}>
                      {log.subject_type ? (
                        <>
                          {log.subject_type}
                          {log.subject_id != null && <span style={{ color: t.textFaint }}> #{log.subject_id}</span>}
                        </>
                      ) : <span style={{ color: t.textFaint }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap", color: t.textMuted, fontFamily: "monospace", fontSize: 12 }}>
                      {log.ip ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Globe size={12} style={{ color: t.textFaint }} /> {log.ip}
                        </span>
                      ) : <span style={{ color: t.textFaint }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 16px", color: t.textSub, maxWidth: 360 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.description ?? undefined}>
                        {log.description || <span style={{ color: t.textFaint }}>—</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && logs.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderTop: `1px solid ${t.divider}`,
          }}>
            <span style={{ fontSize: 12.5, color: t.textMuted }}>Page {page} sur {lastPage}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{
                  width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: t.inp.bg, border: `1px solid ${t.border}`, color: t.textSub,
                  cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1,
                }}>
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage}
                style={{
                  width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: t.inp.bg, border: `1px solid ${t.border}`, color: t.textSub,
                  cursor: page >= lastPage ? "default" : "pointer", opacity: page >= lastPage ? 0.45 : 1,
                }}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
