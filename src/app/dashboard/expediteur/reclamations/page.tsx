"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquareWarning, Plus, X, Package, Clock, Loader2, Send, AlertTriangle,
  CheckCircle2, Inbox, Lock, Calendar, RefreshCw, FileText, Download,
} from "lucide-react";
import { useIsDark, useTokens, PageHeader, Badge, ORANGE, type Tokens } from "../_ui";
import {
  getReclamations, getReclamation, createReclamation, addReclamationNote,
  resolvePackageRef, attachmentUrl, formatBytes, getReclamationTypes,
  RECLAMATION_PRIORITIES, RECLAMATION_TYPES, RECLAMATION_TYPE_LABELS,
  type ReclamationListItem, type ReclamationDetail, type ReclamationStatus,
  type ReclamationPriority, type ReclamationType, type UserBrief, type ReclamationSla,
} from "@/lib/reclamations";

// ── Display meta (mirrors the admin page) ─────────────────────────────────────
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

// Resolved/closed → read-only (mutations are 403'd server-side).
const isLockedStatus = (s: ReclamationStatus | string): boolean =>
  s === "resolved" || s === "closed";

// ── Helpers ───────────────────────────────────────────────────────────────────
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
function fullName(u: UserBrief | null | undefined): string {
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
function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}j`;
}

const SLA_OLD_MINUTES = 48 * 60;

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

// ════════════════════════════════════════════════════════════════════════════
export default function ExpediteurReclamationsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [rows, setRows] = useState<ReclamationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReclamationStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // GET /reclamations is auto-scoped to created_by = the expéditeur server-side,
  // so this list only ever contains their own tickets.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getReclamations({ per_page: 100 });
    if (res.success && res.data) setRows(res.data.data);
    else { setError(res.message || "Impossible de charger vos réclamations."); setRows([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { all: rows.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const r of rows) {
      if (r.status === "open") c.open++;
      else if (r.status === "in_progress") c.in_progress++;
      else if (r.status === "resolved") c.resolved++;
      else if (r.status === "closed") c.closed++;
    }
    return c;
  }, [rows]);

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  // Make a freshly-filed réclamation appear immediately: prepend optimistically,
  // then refetch from the (scoped) backend to stay in sync, and open its detail.
  function handleCreated(created: ReclamationDetail) {
    setShowCreate(false);
    const optimistic: ReclamationListItem = {
      id: created.id,
      type: created.type,
      package_id: created.package_id,
      subject: created.subject,
      description: created.description,
      status: created.status,
      priority: created.priority,
      assigned_to: created.assigned_to,
      stop_desk_id: created.stop_desk_id,
      created_by: created.created_by,
      created_at: created.created_at,
      updated_at: created.updated_at,
      package: created.package,
      assignee: created.assignee,
      creator: created.creator,
      stop_desk: created.stop_desk,
      notes_count: created.notes.length,
      attachments_count: created.attachments.length,
      sla: created.sla,
    };
    setRows((prev) => [optimistic, ...prev.filter((r) => r.id !== created.id)]);
    setFilter("all");
    load();
    setDetailId(created.id);
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="Mes Réclamations"
        subtitle="Ouvrez une réclamation et suivez son traitement"
        icon={MessageSquareWarning}
        t={t}
        action={
          <button onClick={() => setShowCreate(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none", background: ORANGE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(249,115,22,0.3)" }}>
            <Plus size={16} /> Nouvelle réclamation
          </button>
        }
      />

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", "open", "in_progress", "resolved", "closed"] as const).map((k) => {
          const active = filter === k;
          const c = k === "all" ? ORANGE : STATUS_META[k].color;
          const label = k === "all" ? "Toutes" : STATUS_META[k].label;
          const count = k === "all" ? counts.all : counts[k];
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${active ? c : t.border}`, background: active ? c + "14" : t.card, color: active ? c : t.textSub,
            }}>
              {label} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
        <button onClick={load} disabled={loading} title="Actualiser"
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, border: `1px solid ${t.border}`, background: t.card, color: t.textSub, cursor: loading ? "wait" : "pointer" }}>
          <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} />{error}
        </div>
      )}

      {/* List */}
      {loading && rows.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: t.textMuted, background: t.card, border: `1px solid ${t.border}`, borderRadius: 13 }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
          <div style={{ marginTop: 10, fontSize: 13 }}>Chargement…</div>
        </div>
      ) : shown.length === 0 ? (
        <div style={{ padding: 44, textAlign: "center", color: t.textMuted, background: t.card, border: `1px solid ${t.border}`, borderRadius: 13 }}>
          <Inbox size={26} color={t.textFaint} />
          <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600, color: t.text }}>Aucune réclamation</div>
          <div style={{ marginTop: 4, fontSize: 12.5 }}>
            {filter === "all" ? "Vous n'avez ouvert aucune réclamation pour le moment." : "Aucune réclamation dans cette catégorie."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((tk) => {
            const sm = STATUS_META[tk.status] ?? { label: tk.status, color: t.textMuted };
            const pm = PRIORITY_META[tk.priority] ?? { label: tk.priority, color: t.textMuted };
            return (
              <div key={tk.id} onClick={() => setDetailId(tk.id)}
                style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 13, padding: 18, boxShadow: t.shadow, cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = ORANGE + "66")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: ORANGE }}>#{tk.id}</span>
                      <Badge color={sm.color} bg={sm.color + "18"}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.color }} />{sm.label}
                      </Badge>
                      <Badge color={pm.color} bg={pm.color + "18"}>Priorité {pm.label}</Badge>
                      {tk.sla && <SlaChip sla={tk.sla} t={t} />}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 650, color: t.text, marginBottom: 5 }}>{tk.subject}</div>
                    <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 8px", maxWidth: 640, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{tk.description}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11.5, color: t.textFaint, flexWrap: "wrap" }}>
                      {tk.package && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "monospace" }}><Package size={12} />{tk.package.tracking_number}</span>}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={12} />{fmtDate(tk.created_at)}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MessageSquareWarning size={12} />{tk.notes_count} note{tk.notes_count > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes slideInR { from { transform: translateX(100%) } to { transform: translateX(0) } } @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      {showCreate && (
        <CreateModal t={t} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {detailId != null && (
        <DetailDrawer id={detailId} t={t} isDark={isDark}
          onClose={() => setDetailId(null)} onChanged={load} />
      )}
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
  t: Tokens; onClose: () => void; onCreated: (created: ReclamationDetail) => void;
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
    if (res.success && res.data) onCreated(res.data);
    else setErr(res.message || "Échec de la création.");
  }

  const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.15s ease" }}>
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
            {saving ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Detail drawer (expéditeur view — read status + SLA, add notes, no admin controls)
function DetailDrawer({ id, t, isDark, onClose, onChanged }: {
  id: number; t: Tokens; isDark: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [data, setData] = useState<ReclamationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getReclamation(id);
    if (res.success && res.data) { setData(res.data); setErr(null); }
    else setErr(res.message || "Réclamation introuvable.");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addNote() {
    const body = noteText.trim();
    if (!body) return;
    setBusy(true);
    setNotice(null);
    const res = await addReclamationNote(id, body);
    if (!res.success) setNotice(res.message || "L'envoi de la note a échoué.");
    else setNoteText("");
    await load();
    onChanged();
    setBusy(false);
  }

  const locked = !!data && isLockedStatus(data.status);
  const sm = data ? (STATUS_META[data.status] ?? { label: data.status, color: t.textMuted }) : null;
  const pm = data ? (PRIORITY_META[data.priority] ?? { label: data.priority, color: t.textMuted }) : null;
  const sectionHead: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.6, margin: "22px 0 10px" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 540, height: "100%", background: t.card, borderLeft: `1px solid ${t.border}`, boxShadow: "-16px 0 48px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", fontFamily: "var(--font-jakarta, sans-serif)", animation: "slideInR 0.22s ease" }}>

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
            <button onClick={onClose} title="Fermer" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={16} color={t.textMuted} /></button>
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
                <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "#f59e0b14", border: "1px solid #f59e0b40", display: "flex", alignItems: "center", gap: 10 }}>
                  <Lock size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>Réclamation clôturée — lecture seule.</span>
                </div>
              )}

              {/* Description */}
              <div style={sectionHead}>Description</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: t.textSub, whiteSpace: "pre-wrap" }}>{data.description}</p>

              {/* Meta */}
              <div style={sectionHead}>Informations</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Meta t={t} icon={Package} label="Colis lié" value={data.package ? data.package.tracking_number : "Aucun"} mono={!!data.package} />
                <Meta t={t} icon={MessageSquareWarning} label="Priorité" value={pm?.label ?? data.priority} />
                <Meta t={t} icon={Calendar} label="Créée le" value={fmtDateTime(data.created_at)} />
                <Meta t={t} icon={RefreshCw} label="Mise à jour" value={fmtDateTime(data.updated_at)} />
              </div>

              {/* Attachments (read-only) */}
              {data.attachments.length > 0 && (
                <>
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
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Notes timeline */}
              <div style={sectionHead}>Suivi & notes ({data.notes.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {data.notes.map((n) => {
                  const system = /^Statut changé en|^Réclamation rouverte/i.test(n.body);
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
                <div ref={endRef} />
              </div>

              {/* Composer (hidden once read-only) */}
              {!locked && (
                <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} placeholder="Ajouter une note…"
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(); }}
                    style={{ ...inputStyle(t), resize: "vertical", minHeight: 44 }} />
                  <button onClick={addNote} disabled={busy || !noteText.trim()}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 16px", borderRadius: 9, border: "none", background: ORANGE, color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy || !noteText.trim() ? "not-allowed" : "pointer", opacity: busy || !noteText.trim() ? 0.6 : 1, flexShrink: 0 }}>
                    {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
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
