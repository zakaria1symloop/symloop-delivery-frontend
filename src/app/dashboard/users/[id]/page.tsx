"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity, Loader2, AlertCircle, Inbox, Globe, ChevronRight,
  BarChart3, Boxes,
} from "lucide-react";
import {
  useIsDark, useTokens, PageHeader, BackButton, Badge, ORANGE, type Tokens,
} from "../../_ui";
import {
  getUserActivity, formatActivityDate, activityUserName, activityActionColor,
  type ActivityLog,
} from "@/lib/activity";

const PER_PAGE = 20;

export default function UserDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (p: number) => {
    if (!id) return;
    if (p === 1) setLoading(true); else setLoadingMore(true);
    setError(null);
    const res = await getUserActivity(id, p, PER_PAGE);
    if (res.success && res.data) {
      setLogs(prev => (p === 1 ? res.data!.data : [...prev, ...res.data!.data]));
      setPage(res.data.current_page);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    } else {
      setError(res.message || "Impossible de charger l'activité de cet utilisateur.");
    }
    setLoading(false);
    setLoadingMore(false);
  }, [id]);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  // header name — derive from the first log's author, fall back to "#id"
  const headerName = logs[0] ? activityUserName(logs[0]) : `Utilisateur #${id}`;
  const canLoadMore = page < lastPage;

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <BackButton t={t} href="/dashboard/users" label="Retour aux utilisateurs" />

      <PageHeader
        title={headerName}
        subtitle={`Détails et activité — utilisateur #${id}`}
        icon={Activity}
        t={t}
      />

      {/* Quick links to the other detail views */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
        <QuickLink href={`/dashboard/users/${id}/performance`} icon={BarChart3} label="Performance" t={t} />
        <QuickLink href={`/dashboard/users/${id}/stock`} icon={Boxes} label="Stock & produits" t={t} />
      </div>

      {/* ── Activité section ── */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: `1px solid ${t.divider}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Activity size={16} color={ORANGE} />
            <span style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>Activité</span>
          </div>
          {!loading && !error && (
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
              {total} action{total > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "36px 24px", color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
            <AlertCircle size={16} /> {error}
          </div>
        ) : loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 44, color: t.textMuted, fontSize: 13, justifyContent: "center" }}>
            <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement…
          </div>
        ) : logs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "48px 24px", color: t.textFaint }}>
            <Inbox size={28} />
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: t.textMuted }}>Aucune activité</p>
            <p style={{ margin: 0, fontSize: 12 }}>Cet utilisateur n&apos;a effectué aucune action enregistrée.</p>
          </div>
        ) : (
          <div style={{ padding: "8px 18px 4px" }}>
            {logs.map((log, i) => (
              <TimelineRow key={log.id} log={log} t={t} last={i === logs.length - 1} />
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && !error && logs.length > 0 && (
          <div style={{ padding: "12px 18px", borderTop: `1px solid ${t.divider}`, display: "flex", justifyContent: "center" }}>
            {canLoadMore ? (
              <button onClick={() => fetchPage(page + 1)} disabled={loadingMore}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  background: t.card, border: `1.5px solid ${t.border}`, borderRadius: 9,
                  padding: "8px 18px", fontSize: 13, fontWeight: 600, color: t.textSub,
                  cursor: loadingMore ? "default" : "pointer",
                }}>
                {loadingMore && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />}
                {loadingMore ? "Chargement…" : "Charger plus"}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: t.textFaint }}>Fin de l&apos;historique · {logs.length} / {total}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── timeline row ────────────────────────────────────────── */
function TimelineRow({ log, t, last }: { log: ActivityLog; t: Tokens; last: boolean }) {
  const c = activityActionColor(log.action);
  return (
    <div style={{ display: "flex", gap: 12, position: "relative" }}>
      {/* dot + connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 14 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, boxShadow: `0 0 0 3px ${c}22` }} />
        {!last && <span style={{ flex: 1, width: 2, background: t.divider, marginTop: 4 }} />}
      </div>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0, padding: "10px 0", borderBottom: last ? "none" : `1px solid ${t.divider}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Badge color={c} bg={`${c}16`}>{log.action}</Badge>
          {log.subject_type && (
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
              {log.subject_type}
              {log.subject_id != null && <span style={{ color: t.textFaint }}> #{log.subject_id}</span>}
            </span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: t.textMuted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {formatActivityDate(log.created_at)}
          </span>
        </div>
        {log.description && (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>{log.description}</p>
        )}
        {log.ip && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 11.5, color: t.textFaint, fontFamily: "monospace" }}>
            <Globe size={11} /> {log.ip}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── quick link card ─────────────────────────────────────── */
function QuickLink({ href, icon: Icon, label, t }: { href: string; icon: React.ElementType; label: string; t: Tokens }) {
  return (
    <Link href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none",
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 11,
      padding: "10px 16px", boxShadow: t.shadow, color: t.text,
    }}>
      <Icon size={16} color={ORANGE} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <ChevronRight size={15} color={t.textFaint} />
    </Link>
  );
}
