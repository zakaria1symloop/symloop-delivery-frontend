"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  Activity, RefreshCw, Loader2, AlertCircle, Search, X,
  ChevronLeft, ChevronRight, History, Clock, Globe, User as UserIcon,
  Package as PackageIcon, MessageSquareWarning, Boxes, Tags, Wallet,
  Building2, FileText, Layers,
} from "lucide-react";
import { ORANGE } from "../../../_ui";
import {
  getExpActivity,
  type ActivityLog,
} from "@/lib/expediteur-admin";
import {
  formatActivityDate, activityUserName, activityActionColor,
} from "@/lib/activity";
import {
  STATUS_LABELS, STATUS_COLORS, type PackageStatus,
} from "@/lib/packages";
import type { ExpTabProps } from "./types";

/* ── Config ─────────────────────────────────────────────────── */
const PER_PAGE = 20;

/* ── Module mapping (derived from the polymorphic `subject_type`) ──
 * The backend stores fully-qualified model class names; we surface a
 * human module label + icon + accent so the trail reads like an ERP audit. */
function moduleInfo(subjectType: string | null): { label: string; icon: ElementType; color: string } {
  const raw = (subjectType || "").split("\\").pop() || "";
  const key = raw.toLowerCase();
  if (/package|colis|shipment|parcel/.test(key)) return { label: "Colis", icon: PackageIcon, color: "#f97316" };
  if (/reclamation|claim|ticket|litige/.test(key)) return { label: "Réclamation", icon: MessageSquareWarning, color: "#ef4444" };
  if (/product|produit|catalog|article|stock/.test(key)) return { label: "Produit", icon: Boxes, color: "#8b5cf6" };
  if (/tarif|tarification|pricing|price/.test(key)) return { label: "Tarifs", icon: Tags, color: "#0ea5e9" };
  if (/wallet|payment|paiement|transaction|withdraw|retrait|ledger/.test(key)) return { label: "Finances", icon: Wallet, color: "#16a34a" };
  if (/bag|sac/.test(key)) return { label: "Sac", icon: Layers, color: "#a855f7" };
  if (/desk|bureau|hub|navette|center|centre/.test(key)) return { label: "Réseau", icon: Building2, color: "#14b8a6" };
  if (/user|expediteur|account|compte|client/.test(key)) return { label: "Compte", icon: UserIcon, color: "#6366f1" };
  if (!raw) return { label: "Système", icon: Activity, color: "#6b7280" };
  return { label: raw, icon: FileText, color: "#6b7280" };
}

/* ── Humanize a raw action key ("package.status_changed" → "Package Status Changed") ── */
function humanizeAction(action: string): string {
  if (!action) return "Action";
  return action
    .replace(/[._\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Reuse canonical package statuses: detect a status keyword in a Colis log ── */
const STATUS_KEYS = (Object.keys(STATUS_LABELS) as PackageStatus[])
  .sort((a, b) => b.length - a.length); // longest first → avoid substring collisions

function detectStatus(text: string): PackageStatus | null {
  const lower = (text || "").toLowerCase();
  for (const k of STATUS_KEYS) if (lower.includes(k)) return k;
  return null;
}

/* ── Relative "il y a …" stamp ── */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 0) return "";
  if (sec < 60) return "à l'instant";
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.round(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.round(months / 12)} an(s)`;
}

/* ── Status badge (mirrors the Colis tab styling) ── */
function StatusBadge({ status }: { status: PackageStatus }) {
  const c = STATUS_COLORS[status] || { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#9ca3af" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 9999,
      background: c.bg, color: c.text,
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  ACTIVITÉ TAB                                                    */
/* ═══════════════════════════════════════════════════════════════ */
export default function Activite({ userId, user, t }: ExpTabProps) {
  /* ── Data ── */
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Client-side filter (scopes the currently loaded page) ── */
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  /* ── Reset to first page when the merchant changes ── */
  useEffect(() => { setPage(1); }, [userId]);

  /* ── Fetch (alive-guarded) — keyed on userId + page ── */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getExpActivity(userId, page, PER_PAGE)
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data) {
          setLogs(res.data.data || []);
          setLastPage(res.data.last_page || 1);
          setTotal(res.data.total || 0);
        } else {
          setError(res.message || "Impossible de charger l'activité de cet expéditeur.");
          setLogs([]);
          setTotal(0);
          setLastPage(1);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Une erreur est survenue lors du chargement de l'activité.");
        setLogs([]);
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId, page, reloadKey]);

  /* ── Apply the local search to the loaded page ── */
  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return logs;
    return logs.filter((l) => {
      const mod = moduleInfo(l.subject_type).label;
      const hay = [
        l.action, l.description, mod, l.ip,
        activityUserName(l), humanizeAction(l.action),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [logs, term]);

  /* ── Distinct modules touched on this page (header chip) ── */
  const distinctModules = useMemo(
    () => new Set(logs.map((l) => moduleInfo(l.subject_type).label)).size,
    [logs],
  );

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
            <Activity size={18} color={ORANGE} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>Activité</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
              {loading ? "Chargement…" : (
                <>
                  {total.toLocaleString("fr-DZ")} événement{total > 1 ? "s" : ""} ·
                  {" "}journal d&apos;audit de {user.first_name}
                </>
              )}
            </p>
          </div>
        </div>
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

      {/* ── Mini summary tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <SummaryTile t={t} icon={History}  label="Total événements" value={loading ? "—" : total.toLocaleString("fr-DZ")} color={ORANGE} />
        <SummaryTile t={t} icon={Layers}   label="Modules (page)"    value={loading ? "—" : String(distinctModules)} color="#8b5cf6" />
        <SummaryTile t={t} icon={Clock}    label="Dernier événement" value={loading || logs.length === 0 ? "—" : (relativeTime(logs[0]?.created_at) || "—")} color="#0ea5e9" />
        <SummaryTile t={t} icon={Activity} label="Page"              value={loading ? "—" : `${page} / ${lastPage}`} color="#16a34a" />
      </div>

      {/* ── Local search ── */}
      <div style={{ position: "relative", maxWidth: 420 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer cette page (action, détail, module, IP…)"
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

      {/* ── Timeline card ── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        boxShadow: t.shadow, overflow: "hidden",
      }}>
        {loading ? (
          /* Loading */
          <div style={{ padding: 56, textAlign: "center" }}>
            <Loader2 size={24} color={t.textMuted} style={{ animation: "spin 0.8s linear infinite" }} />
            <div style={{ marginTop: 10, fontSize: 13, color: t.textMuted }}>Chargement de l&apos;activité…</div>
          </div>
        ) : error ? (
          /* Error */
          <div style={{ padding: 48, textAlign: "center" }}>
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
          </div>
        ) : logs.length === 0 ? (
          /* Empty (no data at all) */
          <div style={{ padding: 56, textAlign: "center" }}>
            <History size={34} color={t.textFaint} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>Aucune activité enregistrée</div>
            <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
              Les actions de cet expéditeur apparaîtront ici au fil du temps.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          /* Empty (search filtered everything out) */
          <div style={{ padding: 56, textAlign: "center" }}>
            <Search size={32} color={t.textFaint} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>Aucun résultat sur cette page</div>
            <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
              « {search.trim()} » ne correspond à aucun événement affiché.
            </div>
          </div>
        ) : (
          /* Timeline */
          <div style={{ padding: "18px 18px 6px" }}>
            {filtered.map((log, i) => {
              const accent = activityActionColor(log.action);
              const mod = moduleInfo(log.subject_type);
              const ModIcon = mod.icon;
              const isLast = i === filtered.length - 1;
              const status = mod.label === "Colis"
                ? detectStatus(`${log.action} ${log.description ?? ""}`)
                : null;
              const author = activityUserName(log);

              return (
                <div key={log.id} style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
                  {/* Rail: node + connector */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: accent + "1a", border: `1.5px solid ${accent}`,
                    }}>
                      <ModIcon size={16} color={accent} />
                    </div>
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 14, background: t.divider, marginTop: 2 }} />}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 18 }}>
                    {/* Action + module */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                        {humanizeAction(log.action)}
                      </span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "2px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                        background: mod.color + "14", color: mod.color,
                      }}>
                        <ModIcon size={11} /> {mod.label}
                        {log.subject_id != null && (
                          <span style={{ opacity: 0.7, fontFamily: "monospace" }}>#{log.subject_id}</span>
                        )}
                      </span>
                      {status && <StatusBadge status={status} />}
                    </div>

                    {/* Détails */}
                    {log.description && (
                      <div style={{ fontSize: 12.5, color: t.textSub, marginTop: 4, lineHeight: 1.55, wordBreak: "break-word" }}>
                        {log.description}
                      </div>
                    )}

                    {/* Meta line */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: t.textMuted }}>
                        <UserIcon size={12} color={t.textFaint} /> {author}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: t.textMuted }}>
                        <Clock size={12} color={t.textFaint} /> {formatActivityDate(log.created_at)}
                        {relativeTime(log.created_at) && (
                          <span style={{ color: t.textFaint }}>· {relativeTime(log.created_at)}</span>
                        )}
                      </span>
                      {log.ip && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: t.textFaint, fontFamily: "monospace" }}>
                          <Globe size={12} /> {log.ip}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && !error && logs.length > 0 && lastPage > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 16px", borderTop: `1px solid ${t.divider}`, gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12.5, color: t.textMuted }}>
              Page {page} / {lastPage} · {total.toLocaleString("fr-DZ")} événement{total > 1 ? "s" : ""}
              {term && filtered.length !== logs.length && (
                <span style={{ color: t.textFaint }}> · {filtered.length} affiché{filtered.length > 1 ? "s" : ""} (filtre)</span>
              )}
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

/* ── Mini summary tile ── */
function SummaryTile({ t, icon: Icon, label, value, color }: {
  t: ExpTabProps["t"]; icon: ElementType; label: string; value: React.ReactNode; color: string;
}) {
  return (
    <div style={{ background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{value}</span>
    </div>
  );
}
