"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell, Loader2, Filter, X, AlertCircle, Inbox,
  ChevronLeft, ChevronRight, Mail, MessageSquare, Webhook,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { getStoredUser } from "@/lib/api";
import {
  getNotificationLogs,
  NOTIFICATION_CHANNELS, CHANNEL_LABELS, RECIPIENT_LABELS,
  type NotificationLog, type RecipientRole,
} from "@/lib/notifications";

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

/* ── channel meta ────────────────────────────────────────── */
const CHANNEL_META: Record<string, { color: string; icon: typeof Mail }> = {
  email: { color: "#3b82f6", icon: Mail },
  sms: { color: "#10b981", icon: MessageSquare },
  notification: { color: "#f59e0b", icon: Bell },
  webhook: { color: "#8b5cf6", icon: Webhook },
};

/* ── status badge ────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string; icon: typeof CheckCircle2 }> = {
    sent: { color: "#16a34a", label: "Envoyé", icon: CheckCircle2 },
    failed: { color: "#ef4444", label: "Échec", icon: XCircle },
    pending: { color: "#d97706", label: "En attente", icon: Clock },
  };
  const m = map[status] ?? { color: "#6b7280", label: status, icon: Clock };
  const Icon = m.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 7,
      fontSize: 11.5, fontWeight: 600, color: m.color, background: `${m.color}16`, border: `1px solid ${m.color}2e`,
      whiteSpace: "nowrap",
    }}>
      <Icon size={12} /> {m.label}
    </span>
  );
}

/* ── channel cell ────────────────────────────────────────── */
function ChannelCell({ channel }: { channel: string }) {
  const m = CHANNEL_META[channel] ?? { color: "#6b7280", icon: Bell };
  const Icon = m.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: m.color }}>
      <Icon size={14} /> {CHANNEL_LABELS[channel as keyof typeof CHANNEL_LABELS] ?? channel}
    </span>
  );
}

/* ── date format ─────────────────────────────────────────── */
function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ── styled select ───────────────────────────────────────── */
function SelectFilter({ t, value, onChange, icon: Icon, children, style }: {
  t: T; value: string; onChange: (v: string) => void; icon?: typeof Filter;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", ...style }}>
      {Icon && (
        <Icon size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: t.textMuted, pointerEvents: "none" }} />
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", background: t.inp.bg,
          border: `1.5px solid ${t.inp.border}`, borderRadius: 9,
          padding: Icon ? "9px 12px 9px 32px" : "9px 12px", fontSize: 13, color: t.inp.text,
          outline: "none", minHeight: 40, cursor: "pointer", appearance: "auto",
        }}
      >
        {children}
      </select>
    </div>
  );
}

const EMPTY = { status: "", channel: "", date_from: "", date_to: "" };

export default function NotificationLogsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // admin gate
  const [me, setMe] = useState<ReturnType<typeof getStoredUser>>(null);
  const [meResolved, setMeResolved] = useState(false);
  useEffect(() => { setMe(getStoredUser()); setMeResolved(true); }, []);
  const isAdmin = me?.user_type === "admin";

  const [filters, setFilters] = useState({ ...EMPTY });

  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // reset to page 1 whenever a filter changes
  useEffect(() => { setPage(1); }, [filters.status, filters.channel, filters.date_from, filters.date_to]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    const res = await getNotificationLogs({
      page, per_page: PER_PAGE,
      status: filters.status || undefined,
      channel: filters.channel || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    });
    if (res.success && res.data) {
      setLogs(res.data.data);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    } else {
      setLogs([]);
      setLastPage(1);
      setTotal(0);
      setError(res.message || "Impossible de charger les notifications.");
    }
    setLoading(false);
  }, [isAdmin, page, filters]);

  useEffect(() => { load(); }, [load]);

  const hasActiveFilter = Object.values(filters).some(v => v !== "");
  const resetFilters = () => setFilters({ ...EMPTY });

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
          <Bell size={20} style={{ color: ORANGE }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Notifications</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
            Journal des notifications automatiques — emails, SMS, notifications & webhooks
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        padding: "14px 16px", boxShadow: t.shadow, marginBottom: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <SelectFilter t={t} icon={Filter} value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))} style={{ flex: "1 1 160px" }}>
            <option value="">Tous les statuts</option>
            <option value="sent">Envoyé</option>
            <option value="failed">Échec</option>
            <option value="pending">En attente</option>
          </SelectFilter>

          <SelectFilter t={t} icon={Bell} value={filters.channel} onChange={v => setFilters(f => ({ ...f, channel: v }))} style={{ flex: "1 1 160px" }}>
            <option value="">Tous les canaux</option>
            {NOTIFICATION_CHANNELS.map(c => (
              <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
            ))}
          </SelectFilter>

          <div style={{ position: "relative", flex: "0 1 150px" }}>
            <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box", background: t.inp.bg, border: `1.5px solid ${t.inp.border}`,
                borderRadius: 9, padding: "9px 12px", fontSize: 13, color: t.inp.text, outline: "none", minHeight: 40,
              }} />
          </div>
          <div style={{ position: "relative", flex: "0 1 150px" }}>
            <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box", background: t.inp.bg, border: `1.5px solid ${t.inp.border}`,
                borderRadius: 9, padding: "9px 12px", fontSize: 13, color: t.inp.text, outline: "none", minHeight: 40,
              }} />
          </div>

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
            {loading ? "Chargement…" : `${total} notification${total > 1 ? "s" : ""}`}
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
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: t.textMuted }}>Aucune notification</p>
            <p style={{ margin: 0, fontSize: 12 }}>
              {hasActiveFilter ? "Aucune notification ne correspond à ces filtres." : "Aucune notification envoyée pour le moment."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: t.head }}>
                  {["Quand", "Canal", "Destinataire", "Statut", "Déclencheur", "Erreur"].map(h => (
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
                      {formatDate(log.created_at)}
                    </td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      <ChannelCell channel={log.channel} />
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: t.text }}>
                          {log.recipient_role
                            ? (RECIPIENT_LABELS[log.recipient_role as RecipientRole] ?? log.recipient_role)
                            : "—"}
                        </span>
                        {log.recipient_address && (
                          <span style={{ fontSize: 11.5, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                            {log.recipient_address}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "11px 16px" }}><StatusBadge status={log.status} /></td>
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap", color: t.textSub }}>
                      {log.trigger_ref ? (
                        <span>
                          <code style={{ fontSize: 11.5, fontFamily: "monospace", color: t.textSub }}>{log.trigger_ref}</code>
                          {log.package?.tracking_number && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: t.textFaint }}>{log.package.tracking_number}</span>
                          )}
                        </span>
                      ) : <span style={{ color: t.textFaint }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 16px", color: "#ef4444", maxWidth: 280 }}>
                      {log.error ? (
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.error}>
                          {log.error}
                        </span>
                      ) : <span style={{ color: t.textFaint }}>—</span>}
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
