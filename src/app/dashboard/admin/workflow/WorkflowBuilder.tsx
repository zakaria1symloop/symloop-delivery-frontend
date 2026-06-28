"use client";

import {
  useCallback, useContext, useEffect, useState, createContext,
} from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, MarkerType, addEdge,
  useNodesState, useEdgesState,
  type Node, type Edge, type NodeProps, type NodeTypes,
  type NodeMouseHandler, type Connection, type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import {
  Workflow, Plus, RotateCcw, Mail, MessageSquare, Bell, Webhook,
  X, Trash2, Save, Loader2, ExternalLink, AlertTriangle,
  ShieldCheck, FileText, Users, Search, GitBranch,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS, type PackageStatus } from "@/lib/packages";
import {
  getWorkflow, saveWorkflow, getChannelsStatus,
  RECIPIENT_LABELS, TEMPLATE_VARS,
  type ChannelType, type RecipientRole, type ChannelsStatus,
  type WorkflowDefinition, type WorkflowStatusNode, type WorkflowActionNode,
} from "@/lib/notifications";
import { getRoles, type Role } from "@/lib/roles";
import { getUsers, type StaffUser } from "@/lib/users";

/* ───────────────────────── theme tokens (admin design system) ───────────── */
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

function useTokens(isDark: boolean) {
  return isDark ? {
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", canvas: "#0b0e16", inpBg: "#1e2130", inpBorder: "#2a3145",
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", canvas: "#f8fafc", inpBg: "#ffffff", inpBorder: "#d1d5db",
  };
}
type T = ReturnType<typeof useTokens>;

const ACCENT = "#f97316";

/* ───────────────────────── domain model ─────────────────────────────────── */
type ActionType = ChannelType;
type StatusColors = { bg: string; text: string; dot: string };

// One configured automation action attached to a status node.
type ActionConfig = {
  type: ActionType;
  recipient: RecipientRole;
  custom_target?: string;
  subject?: string;
  template?: string;
};

// Type alias (not interface) so it satisfies `Record<string, unknown>` — required by Node<T>.
type StatusNodeData = {
  label: string;
  statusKey: string;
  colors: StatusColors;
  actions: ActionConfig[];
  isCustom: boolean;
  // ── Per-status governance (validated by the backend on PATCH /packages/:id/status) ──
  requireNote: boolean;      // → require_note
  allowedRoles: string[];    // → allowed_roles (user_type values and/or custom role names)
  allowedUsers: number[];    // → allowed_users (user ids)
  // Key of the main-flow outgoing transition the scanner auto-follows toward
  // acceptance. Undefined ⇒ operator is asked at forks. → default_transition
  defaultTransition?: string;
};
type StatusNode = Node<StatusNodeData, "status">;

/* Base user_types the backend compares `current.user_type` against, plus a label.
   Custom role names (from getRoles) are offered alongside these. */
const BASE_ROLES: { value: string; label: string }[] = [
  { value: "admin",             label: "Admin" },
  { value: "responsable",       label: "Responsable" },
  { value: "operator",          label: "Opérateur" },
  { value: "chauffeur",         label: "Chauffeur" },
  { value: "transit_chauffeur", label: "Chauffeur transit" },
  { value: "expediteur",        label: "Expéditeur" },
];

const ACTION_DEFS: { type: ActionType; label: string; icon: typeof Mail; color: string }[] = [
  { type: "email",        label: "Email",        icon: Mail,          color: "#3b82f6" },
  { type: "sms",          label: "SMS",          icon: MessageSquare, color: "#10b981" },
  { type: "notification", label: "Notification", icon: Bell,          color: "#f59e0b" },
  { type: "webhook",      label: "Webhook",      icon: Webhook,       color: "#8b5cf6" },
];
const ACTION_DEF: Record<ActionType, (typeof ACTION_DEFS)[number]> =
  Object.fromEntries(ACTION_DEFS.map((d) => [d.type, d])) as Record<ActionType, (typeof ACTION_DEFS)[number]>;

const RECIPIENT_OPTIONS: RecipientRole[] = ["expediteur", "destinataire", "chauffeur", "operateur", "admin", "custom"];

/** Coerce persisted action data (legacy ActionType[] strings or rich objects) into ActionConfig[]. */
function normalizeActions(raw: unknown): ActionConfig[] {
  if (!Array.isArray(raw)) return [];
  const valid = (s: unknown): s is ActionType =>
    typeof s === "string" && ["email", "sms", "notification", "webhook"].includes(s);
  const out: ActionConfig[] = [];
  for (const item of raw) {
    if (valid(item)) { out.push({ type: item, recipient: "destinataire" }); continue; }
    if (item && typeof item === "object") {
      const a = item as Partial<ActionConfig>;
      if (valid(a.type)) {
        out.push({
          type: a.type,
          recipient: (a.recipient as RecipientRole) ?? "destinataire",
          ...(a.custom_target ? { custom_target: a.custom_target } : {}),
          ...(a.subject ? { subject: a.subject } : {}),
          ...(a.template ? { template: a.template } : {}),
        });
      }
    }
  }
  return out;
}

const FALLBACK_COLOR: StatusColors = { bg: "rgba(107,114,128,0.1)", text: "#4b5563", dot: "#6b7280" };

/* DHD statuses are excluded — DHD was removed. */
const EXCLUDED: PackageStatus[] = ["externe_en_transit", "externe_livre", "externe_retour"];
const SEED_STATUSES = (Object.keys(STATUS_LABELS) as PackageStatus[]).filter((s) => !EXCLUDED.includes(s));

/* Default transitions — mirrors the backend TRANSITIONS map
   (backend-nest/src/packages/packages.constants.ts). */
const DEFAULT_TRANSITIONS: Record<string, string[]> = {
  en_attente:          ["pret_a_expedier", "accepte_operateur", "demande_ramassage", "annule"],
  pret_a_expedier:     ["accepte_operateur", "annule"],
  demande_ramassage:   ["en_ramassage", "en_attente", "annule"],
  en_ramassage:        ["accepte_operateur", "demande_ramassage", "en_attente"],
  accepte_operateur:   ["en_sac", "annule"],
  en_sac:              ["en_transit"],
  en_transit:          ["arrive_destination"],
  arrive_destination:  ["pret_pour_retrait", "pret_pour_chauffeur", "reporte", "echec_livraison"],
  reporte:             ["pret_pour_retrait", "pret_pour_chauffeur", "echec_livraison", "annule"],
  pret_pour_retrait:   ["livre", "echec_livraison"],
  pret_pour_chauffeur: ["en_cours_livraison", "echec_livraison"],
  en_cours_livraison:  ["livre", "echec_livraison", "pret_pour_chauffeur"],
  livre:               [],
  annule:              [],
  echec_livraison:     ["retour_en_sac", "pret_pour_chauffeur", "pret_pour_retrait"],
  retour_en_sac:       ["retour_en_transit", "echec_livraison"],
  retour_en_transit:   ["retour_arrive"],
  retour_arrive:       ["retourne"],
  retourne:            [],
};

/* Hand-tuned layout so the seeded flow reads left → right with the return chain below. */
const POSITIONS: Record<string, { x: number; y: number }> = {
  en_attente:          { x: 0,    y: 140 },
  demande_ramassage:   { x: 0,    y: 300 },
  pret_a_expedier:     { x: 240,  y: 40  },
  en_ramassage:        { x: 240,  y: 300 },
  accepte_operateur:   { x: 480,  y: 140 },
  annule:              { x: 480,  y: 320 },
  en_sac:              { x: 720,  y: 140 },
  en_transit:          { x: 960,  y: 140 },
  arrive_destination:  { x: 1200, y: 140 },
  reporte:             { x: 1200, y: 320 },
  pret_pour_retrait:   { x: 1440, y: 40  },
  pret_pour_chauffeur: { x: 1440, y: 200 },
  en_cours_livraison:  { x: 1680, y: 200 },
  livre:               { x: 1920, y: 120 },
  echec_livraison:     { x: 1440, y: 380 },
  retour_en_sac:       { x: 1200, y: 520 },
  retour_en_transit:   { x: 960,  y: 520 },
  retour_arrive:       { x: 720,  y: 520 },
  retourne:            { x: 480,  y: 520 },
  echange_retour:      { x: 240,  y: 520 },
  externe_expedie:     { x: 0,    y: 520 },
};

/* ───────────────────────── helpers ──────────────────────────────────────── */
const STORAGE_KEY = "symloop_status_workflow";

const PALETTE = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444", "#eab308", "#6366f1", "#06b6d4"];

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function makeNode(d: {
  id: string; statusKey: string; label: string; colors: StatusColors;
  actions: ActionConfig[]; isCustom: boolean; position: { x: number; y: number };
  requireNote?: boolean; allowedRoles?: string[]; allowedUsers?: number[];
  defaultTransition?: string;
}): StatusNode {
  return {
    id: d.id,
    type: "status",
    position: d.position,
    data: {
      label: d.label, statusKey: d.statusKey, colors: d.colors, actions: d.actions, isCustom: d.isCustom,
      requireNote: d.requireNote ?? false,
      allowedRoles: d.allowedRoles ?? [],
      allowedUsers: d.allowedUsers ?? [],
      defaultTransition: d.defaultTransition,
    },
  };
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: { strokeWidth: 1.6 },
  };
}

function buildSeed(): { nodes: StatusNode[]; edges: Edge[] } {
  const nodes: StatusNode[] = [];
  let gi = 0;
  for (const s of SEED_STATUSES) {
    const fixed = POSITIONS[s];
    const pos = fixed ?? { x: (gi % 5) * 240, y: 700 + Math.floor(gi / 5) * 140 };
    if (!fixed) gi++;
    nodes.push(makeNode({
      id: s, statusKey: s, label: STATUS_LABELS[s], colors: STATUS_COLORS[s] ?? FALLBACK_COLOR,
      actions: [], isCustom: false, position: pos,
    }));
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = [];
  for (const [from, tos] of Object.entries(DEFAULT_TRANSITIONS)) {
    if (!ids.has(from)) continue;
    for (const to of tos) {
      if (ids.has(to)) edges.push(makeEdge(from, to));
    }
  }
  return { nodes, edges };
}

type StoredNode = { id: string; position?: { x: number; y: number }; data?: Partial<StatusNodeData> & { actions?: unknown } };
type StoredEdge = { id?: string; source: string; target: string };

function serialize(nodes: StatusNode[], edges: Edge[]) {
  return {
    version: 1,
    nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

/* Merge a persisted graph (localStorage OR backend) with seeded defaults so
   default statuses always appear while custom statuses + positions + per-node
   actions + edge edits persist. */
function mergeStored(savedNodes: StoredNode[], savedEdges: StoredEdge[]): { nodes: StatusNode[]; edges: Edge[] } {
  const seed = buildSeed();
  if (savedNodes.length === 0) return seed;

  const seedById = new Map(seed.nodes.map((n) => [n.id, n]));
  const savedIds = new Set(savedNodes.map((n) => n.id));

  const nodes: StatusNode[] = savedNodes.map((sn) => {
    const seedNode = seedById.get(sn.id);
    const d = sn.data ?? {};
    return makeNode({
      id: sn.id,
      statusKey: d.statusKey ?? sn.id,
      label: d.label ?? seedNode?.data.label ?? sn.id,
      colors: d.colors ?? seedNode?.data.colors ?? FALLBACK_COLOR,
      actions: normalizeActions(d.actions),
      isCustom: d.isCustom ?? !seedNode,
      position: sn.position ?? seedNode?.position ?? { x: 0, y: 0 },
      requireNote: d.requireNote === true,
      allowedRoles: Array.isArray(d.allowedRoles) ? d.allowedRoles.filter((r): r is string => typeof r === "string") : [],
      allowedUsers: Array.isArray(d.allowedUsers) ? d.allowedUsers.filter((u): u is number => typeof u === "number") : [],
      defaultTransition: typeof d.defaultTransition === "string" ? d.defaultTransition : undefined,
    });
  });

  // Re-introduce any default status the saved graph predates.
  const newDefaultIds = new Set<string>();
  for (const sNode of seed.nodes) {
    if (!savedIds.has(sNode.id)) { nodes.push(sNode); newDefaultIds.add(sNode.id); }
  }

  const edges: Edge[] = savedEdges.map((e) => ({
    ...makeEdge(e.source, e.target),
    id: e.id || `${e.source}->${e.target}`,
  }));
  const edgeIds = new Set(edges.map((e) => e.id));
  // Bring default edges only for freshly re-introduced default nodes
  // (so the user's own edge deletions are preserved).
  for (const se of seed.edges) {
    if (newDefaultIds.has(se.source) && !edgeIds.has(se.id)) { edges.push(se); edgeIds.add(se.id); }
  }

  return { nodes, edges };
}

function loadGraph(): { nodes: StatusNode[]; edges: Edge[] } {
  const seed = buildSeed();
  if (typeof window === "undefined") return seed;

  let raw: string | null = null;
  try { raw = window.localStorage.getItem(STORAGE_KEY); } catch { raw = null; }
  if (!raw) return seed;

  try {
    const parsed = JSON.parse(raw) as { nodes?: StoredNode[]; edges?: StoredEdge[] };
    return mergeStored(
      Array.isArray(parsed.nodes) ? parsed.nodes : [],
      Array.isArray(parsed.edges) ? parsed.edges : [],
    );
  } catch {
    return seed;
  }
}

/* ── backend WorkflowDefinition bridge ─────────────────────────────────────── */
// Extra UI metadata (colors, position, transitions, isCustom) is stuffed onto the
// status nodes — the backend persists array elements verbatim, so it round-trips.
type StatusMeta = WorkflowStatusNode & {
  colors?: StatusColors; position?: { x: number; y: number }; isCustom?: boolean; transitions?: unknown;
  require_note?: unknown; allowed_roles?: unknown; allowed_users?: unknown; default_transition?: unknown;
};

/** Backend definition → builder graph (merged with seeded defaults). */
function workflowToGraph(def: WorkflowDefinition): { nodes: StatusNode[]; edges: Edge[] } {
  const statuses = Array.isArray(def.statuses) ? def.statuses : [];
  const actions = Array.isArray(def.actions) ? def.actions : [];

  const savedNodes: StoredNode[] = statuses.map((s) => {
    const meta = s as StatusMeta;
    const colors: StatusColors | undefined =
      meta.colors ?? (s.color ? { bg: hexToRgba(s.color, 0.12), text: s.color, dot: s.color } : undefined);
    return {
      id: s.key,
      position: meta.position,
      data: {
        statusKey: s.key,
        label: s.label ?? s.key,
        colors,
        isCustom: meta.isCustom,
        actions: actions.filter((a) => a.status_key === s.key),
        requireNote: meta.require_note === true,
        allowedRoles: Array.isArray(meta.allowed_roles)
          ? meta.allowed_roles.filter((r): r is string => typeof r === "string")
          : undefined,
        allowedUsers: Array.isArray(meta.allowed_users)
          ? meta.allowed_users.filter((u): u is number => typeof u === "number")
          : undefined,
        defaultTransition: typeof meta.default_transition === "string" ? meta.default_transition : undefined,
      },
    };
  });

  const savedEdges: StoredEdge[] = [];
  for (const s of statuses) {
    const trans = (s as StatusMeta).transitions;
    if (Array.isArray(trans)) {
      for (const to of trans) {
        if (typeof to === "string") savedEdges.push({ id: `${s.key}->${to}`, source: s.key, target: to });
      }
    }
  }

  return mergeStored(savedNodes, savedEdges);
}

/** Builder graph → backend definition. Outgoing edges encoded as `transitions`. */
function graphToWorkflow(nodes: StatusNode[], edges: Edge[]): WorkflowDefinition {
  const statuses: WorkflowStatusNode[] = nodes.map((n, i) => {
    // CRITICAL: outgoing edges → per-node `transitions` (the backend validates moves against this).
    const transitions = edges.filter((e) => e.source === n.id).map((e) => e.target);
    // Only persist a default transition that is still a real outgoing edge target
    // (an edge may have been removed since it was selected) — otherwise omit it.
    const dt = n.data.defaultTransition;
    const validDefault = dt && transitions.includes(dt) ? dt : undefined;
    return {
      key: n.data.statusKey,
      label: n.data.label,
      color: n.data.colors.dot,
      order: i,
      colors: n.data.colors,
      position: n.position,
      isCustom: n.data.isCustom,
      transitions,
      // Per-status governance — read verbatim by the backend WorkflowStatusNode.
      require_note: n.data.requireNote,
      allowed_roles: n.data.allowedRoles,
      allowed_users: n.data.allowedUsers,
      // Main-flow transition the scanner auto-follows (omitted when unset/stale).
      ...(validDefault ? { default_transition: validDefault } : {}),
    };
  });

  const actions: WorkflowActionNode[] = [];
  for (const n of nodes) {
    for (const a of n.data.actions) {
      actions.push({
        status_key: n.data.statusKey,
        type: a.type,
        recipient: a.recipient,
        ...(a.recipient === "custom" && a.custom_target ? { custom_target: a.custom_target } : {}),
        ...(a.subject ? { subject: a.subject } : {}),
        ...(a.template ? { template: a.template } : {}),
      });
    }
  }

  return { statuses, actions };
}

/* ───────────────────────── custom node ──────────────────────────────────── */
const DarkContext = createContext(false);

function StatusNodeView({ data, selected }: NodeProps<StatusNode>) {
  const isDark = useContext(DarkContext);
  const c = data.colors;
  const count = data.actions.length;
  return (
    <div
      style={{
        minWidth: 172,
        background: isDark ? "#111827" : "#ffffff",
        border: `2px solid ${selected ? ACCENT : c.dot}`,
        borderRadius: 12,
        padding: "10px 13px",
        boxShadow: selected
          ? `0 0 0 3px ${hexToRgba(ACCENT, 0.25)}`
          : isDark ? "0 1px 4px rgba(0,0,0,0.5)" : "0 1px 4px rgba(0,0,0,0.10)",
        fontFamily: "var(--font-jakarta, sans-serif)",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: c.dot, width: 9, height: 9, border: "2px solid #fff" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f0f0f5" : "#111827", lineHeight: 1.2 }}>
          {data.label}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: c.bg, color: c.text }}>
          {count} action{count === 1 ? "" : "s"}
        </span>
        {data.isCustom && (
          <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            perso
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: c.dot, width: 9, height: 9, border: "2px solid #fff" }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { status: StatusNodeView };

/* ───────────────────────── side panel ───────────────────────────────────── */
/** GREEN when the channel is ready, AMBER (with a Configurer link) otherwise. */
function ChannelBadge({ ready }: { ready: boolean }) {
  if (ready) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: "#16a34a" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 0 3px rgba(22,163,74,0.15)" }} />
        Configuré
      </span>
    );
  }
  return (
    <Link
      href="/dashboard/admin/api-keys"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#d97706", textDecoration: "none" }}
    >
      <AlertTriangle size={12} /> Non configuré — Configurer <ExternalLink size={10} />
    </Link>
  );
}

function ActionCard({ t, action, ready, onUpdate, onRemove }: {
  t: T; action: ActionConfig; ready: boolean;
  onUpdate: (patch: Partial<ActionConfig>) => void;
  onRemove: () => void;
}) {
  const def = ACTION_DEF[action.type];
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, fontSize: 12.5,
    background: t.inpBg, border: `1.5px solid ${t.inpBorder}`, color: t.text, outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase",
    letterSpacing: "0.05em", margin: "10px 0 5px",
  };
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 11, padding: "11px 12px", background: t.rowHover }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: hexToRgba(def.color, 0.14),
        }}>
          <def.icon size={14} style={{ color: def.color }} />
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.text }}>{def.label}</span>
        <button onClick={onRemove} title="Retirer l'action"
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textFaint, padding: 3, display: "flex" }}>
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ marginTop: 7 }}>
        <ChannelBadge ready={ready} />
      </div>

      <label style={labelStyle}>Destinataire</label>
      <select
        value={action.recipient}
        onChange={(e) => onUpdate({ recipient: e.target.value as RecipientRole })}
        style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
      >
        {RECIPIENT_OPTIONS.map((r) => <option key={r} value={r}>{RECIPIENT_LABELS[r]}</option>)}
      </select>

      {action.recipient === "custom" && (
        <>
          <label style={labelStyle}>Cible personnalisée</label>
          <input
            value={action.custom_target ?? ""}
            onChange={(e) => onUpdate({ custom_target: e.target.value })}
            placeholder={action.type === "webhook" ? "https://exemple.com/webhook" : action.type === "email" ? "email@exemple.com" : "+213…"}
            style={inputStyle}
          />
        </>
      )}

      <label style={labelStyle}>Sujet</label>
      <input
        value={action.subject ?? ""}
        onChange={(e) => onUpdate({ subject: e.target.value })}
        placeholder="Colis {{tracking_number}} — {{status}}"
        style={inputStyle}
      />

      <label style={labelStyle}>Modèle du message</label>
      <textarea
        value={action.template ?? ""}
        onChange={(e) => onUpdate({ template: e.target.value })}
        rows={3}
        placeholder="Bonjour {{recipient_name}}, votre colis {{tracking_number}} est : {{status}}."
        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
      />
      <p style={{ margin: "6px 0 0", fontSize: 10, color: t.textFaint, lineHeight: 1.5 }}>
        Variables : {TEMPLATE_VARS.map((v) => `{{${v}}}`).join(", ")}
      </p>
    </div>
  );
}

/* ── Per-status governance (note requirement + who may move TO this status) ──── */
function GovernanceSection({ t, node, roles, users, onPatch }: {
  t: T; node: StatusNode; roles: Role[]; users: StaffUser[];
  onPatch: (patch: Partial<StatusNodeData>) => void;
}) {
  const [userQuery, setUserQuery] = useState("");

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase",
    letterSpacing: "0.05em", margin: "14px 0 7px",
  };

  const allowedRoles = node.data.allowedRoles;
  const allowedUsers = node.data.allowedUsers;

  const toggleRole = (value: string) => {
    onPatch({
      allowedRoles: allowedRoles.includes(value)
        ? allowedRoles.filter((r) => r !== value)
        : [...allowedRoles, value],
    });
  };

  // Base user_types + any custom role names (deduped against the base values/labels).
  const roleOptions: { value: string; label: string; custom?: boolean }[] = [
    ...BASE_ROLES,
    ...roles
      .filter((r) => !BASE_ROLES.some((b) => b.value === r.name || b.label === r.name))
      .map((r) => ({ value: r.name, label: r.name, custom: true })),
  ];

  const usersById = new Map(users.map((u) => [u.id, u]));
  const q = userQuery.trim().toLowerCase();
  const userMatches = q
    ? users
        .filter((u) => !allowedUsers.includes(u.id))
        .filter((u) =>
          `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q))
        .slice(0, 6)
    : [];

  const addUser = (id: number) => {
    if (!allowedUsers.includes(id)) onPatch({ allowedUsers: [...allowedUsers, id] });
    setUserQuery("");
  };
  const removeUser = (id: number) =>
    onPatch({ allowedUsers: allowedUsers.filter((u) => u !== id) });

  const chipBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999,
    fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${t.border}`,
    transition: "background 0.12s, border-color 0.12s",
  };

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.divider}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <ShieldCheck size={14} style={{ color: ACCENT }} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: t.text }}>Gouvernance du statut</span>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
        Conditions pour qu&apos;un colis puisse passer <strong>à</strong> ce statut.
      </p>

      {/* require note */}
      <button
        onClick={() => onPatch({ requireNote: !node.data.requireNote })}
        style={{
          display: "flex", alignItems: "center", gap: 9, width: "100%", marginTop: 8,
          padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
          background: node.data.requireNote ? hexToRgba(ACCENT, 0.08) : t.rowHover,
          border: `1px solid ${node.data.requireNote ? hexToRgba(ACCENT, 0.35) : t.border}`,
        }}
      >
        <span style={{
          width: 34, height: 20, borderRadius: 999, flexShrink: 0, position: "relative",
          background: node.data.requireNote ? ACCENT : t.inpBorder, transition: "background 0.15s",
        }}>
          <span style={{
            position: "absolute", top: 2, left: node.data.requireNote ? 16 : 2,
            width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }} />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: t.text }}>
            <FileText size={13} style={{ color: t.textMuted }} /> Requiert une note
          </span>
          <span style={{ fontSize: 10.5, color: t.textMuted }}>
            Une note obligatoire sera demandée lors du passage à ce statut.
          </span>
        </span>
      </button>

      {/* allowed roles */}
      <label style={labelStyle}>
        <Users size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 5 }} />
        Rôles autorisés à passer à ce statut
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {roleOptions.map((r) => {
          const on = allowedRoles.includes(r.value);
          return (
            <button
              key={r.value}
              onClick={() => toggleRole(r.value)}
              title={r.custom ? "Rôle personnalisé" : "Type d'utilisateur"}
              style={{
                ...chipBase,
                background: on ? ACCENT : t.rowHover,
                color: on ? "#fff" : t.textSub,
                borderColor: on ? ACCENT : t.border,
              }}
            >
              {r.label}{r.custom ? " ·" : ""}
            </button>
          );
        })}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 10, color: t.textFaint, lineHeight: 1.5 }}>
        {allowedRoles.length === 0
          ? "Aucune restriction de rôle (tous les rôles autorisés par défaut)."
          : "Seuls ces rôles pourront effectuer la transition."}
      </p>

      {/* allowed users */}
      <label style={labelStyle}>
        <Users size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 5 }} />
        Utilisateurs autorisés (tags)
      </label>
      {allowedUsers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {allowedUsers.map((id) => {
            const u = usersById.get(id);
            return (
              <span key={id} style={{ ...chipBase, cursor: "default", background: hexToRgba(ACCENT, 0.1), color: t.text, borderColor: hexToRgba(ACCENT, 0.3) }}>
                {u ? `${u.first_name} ${u.last_name}` : `#${id}`}
                <button
                  onClick={() => removeUser(id)}
                  title="Retirer"
                  style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 0, display: "flex" }}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
        <input
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Rechercher un utilisateur…"
          style={{
            width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 30px", borderRadius: 8, fontSize: 12.5,
            background: t.inpBg, border: `1.5px solid ${t.inpBorder}`, color: t.text, outline: "none",
          }}
        />
        {userMatches.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}>
            {userMatches.map((u) => (
              <button
                key={u.id}
                onClick={() => addUser(u.id)}
                style={{
                  display: "flex", flexDirection: "column", width: "100%", textAlign: "left",
                  padding: "8px 11px", background: "none", border: "none", cursor: "pointer", borderBottom: `1px solid ${t.divider}`,
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>{u.first_name} {u.last_name}</span>
                <span style={{ fontSize: 10.5, color: t.textMuted }}>{u.email} · {u.user_type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 10, color: t.textFaint, lineHeight: 1.5 }}>
        Optionnel — autorise aussi nommément ces utilisateurs (en plus des rôles).
      </p>
    </div>
  );
}

/* ── Default (main-flow) transition picker ───────────────────────────────────
   A status can fan out into several outgoing transitions. Some are the main flow
   (auto-followed by the scanner toward acceptance); others are action-driven
   branches (e.g. demande_ramassage, annule) that must NOT be auto-followed.
   `defaultTransition` marks the one main-flow edge to auto-follow. */
function DefaultTransitionSection({ t, node, targets, onPatch }: {
  t: T; node: StatusNode;
  targets: { key: string; label: string }[];
  onPatch: (patch: Partial<StatusNodeData>) => void;
}) {
  // If the previously-selected default was deleted (edge removed), treat it as
  // unset so we never show — or persist — a stale value.
  const current = node.data.defaultTransition;
  const selected = current && targets.some((tg) => tg.key === current) ? current : "";

  const heading = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <GitBranch size={14} style={{ color: ACCENT }} />
        <span style={{ fontSize: 12.5, fontWeight: 800, color: t.text }}>Transition par défaut (flux principal)</span>
      </div>
    </>
  );

  if (targets.length === 0) {
    return (
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.divider}` }}>
        {heading}
        <p style={{ margin: "0 0 0", fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
          Aucune transition sortante — reliez ce statut à un autre statut pour définir le flux suivi
          automatiquement par le scan.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.divider}` }}>
      {heading}
      <p style={{ margin: "0 0 8px", fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
        Étape suivie <strong>automatiquement</strong> par le scan vers l&apos;acceptation. Les autres
        transitions restent des branches déclenchées par une action (ex. demande de ramassage, annulation).
      </p>
      <select
        value={selected}
        onChange={(e) => onPatch({ defaultTransition: e.target.value || undefined })}
        style={{
          width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, fontSize: 12.5,
          background: t.inpBg, border: `1.5px solid ${selected ? hexToRgba(ACCENT, 0.5) : t.inpBorder}`,
          color: t.text, outline: "none", cursor: "pointer", appearance: "auto",
        }}
      >
        <option value="">— Aucune (demander à chaque fork) —</option>
        {targets.map((tg) => (
          <option key={tg.key} value={tg.key}>{tg.label}</option>
        ))}
      </select>
      <p style={{ margin: "6px 0 0", fontSize: 10, color: t.textFaint, lineHeight: 1.5 }}>
        {targets.length === 1
          ? "Une seule transition sortante — sélectionnez-la pour que le scan la suive sans demander."
          : selected
            ? "Le scan suivra uniquement cette transition ; les autres resteront manuelles."
            : "Sans valeur, l'opérateur sera invité à choisir à chaque embranchement."}
      </p>
    </div>
  );
}

function ActionsPanel({
  t, node, channels, roles, users, outgoingTargets,
  onAddAction, onUpdateAction, onRemoveAction, onPatch, onDelete, onClose,
}: {
  t: T; node: StatusNode;
  channels: ChannelsStatus | null;
  roles: Role[];
  users: StaffUser[];
  outgoingTargets: { key: string; label: string }[];
  onAddAction: (type: ActionType) => void;
  onUpdateAction: (index: number, patch: Partial<ActionConfig>) => void;
  onRemoveAction: (index: number) => void;
  onPatch: (patch: Partial<StatusNodeData>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        width: 340, flexShrink: 0, display: "flex", flexDirection: "column",
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        boxShadow: t.shadow, overflow: "hidden",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${t.divider}` }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: node.data.colors.dot, marginTop: 4, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Actions du statut
          </p>
          <h3 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 800, color: t.text, lineHeight: 1.25 }}>
            «&nbsp;{node.data.label}&nbsp;»
          </h3>
          <code style={{ fontSize: 10.5, color: t.textFaint, fontFamily: "monospace" }}>{node.data.statusKey}</code>
        </div>
        <button
          onClick={onClose}
          title="Fermer"
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4, display: "flex" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        <p style={{ margin: "0 0 10px", fontSize: 11.5, color: t.textMuted, lineHeight: 1.5 }}>
          Ajoutez les actions à déclencher lorsqu&apos;un colis atteint ce statut. Choisissez le canal,
          le destinataire et personnalisez le message.
        </p>

        <p style={{ margin: "0 0 7px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Ajouter une action
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
          {ACTION_DEFS.map((def) => (
            <button
              key={def.type}
              onClick={() => onAddAction(def.type)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 10px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 600,
                color: t.textSub, background: t.rowHover, border: `1px solid ${t.border}`,
              }}
            >
              <def.icon size={14} style={{ color: def.color }} /> {def.label}
            </button>
          ))}
        </div>

        {node.data.actions.length === 0 ? (
          <div style={{
            padding: "18px 14px", borderRadius: 11, border: `1px dashed ${t.border}`,
            fontSize: 12, color: t.textFaint, textAlign: "center", lineHeight: 1.5,
          }}>
            Aucune action configurée pour ce statut.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {node.data.actions.map((a, i) => (
              <ActionCard
                key={i}
                t={t}
                action={a}
                ready={channels ? channels[a.type] : true}
                onUpdate={(patch) => onUpdateAction(i, patch)}
                onRemove={() => onRemoveAction(i)}
              />
            ))}
          </div>
        )}

        <DefaultTransitionSection t={t} node={node} targets={outgoingTargets} onPatch={onPatch} />

        <GovernanceSection t={t} node={node} roles={roles} users={users} onPatch={onPatch} />
      </div>

      {/* footer */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.divider}` }}>
        <button
          onClick={onDelete}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
            padding: "9px 12px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            color: "#ef4444", background: hexToRgba("#ef4444", 0.08), border: `1px solid ${hexToRgba("#ef4444", 0.25)}`,
          }}
        >
          <Trash2 size={14} /> Supprimer ce statut
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── builder ──────────────────────────────────────── */
function Builder() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [initial] = useState(loadGraph); // lazy: reads localStorage once on mount (client-only)
  const [nodes, setNodes, onNodesChange] = useNodesState<StatusNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const [channels, setChannels] = useState<ChannelsStatus | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Persist the whole graph (nodes incl. positions + actions, edges) to
  // localStorage on every change — a fast cache; the backend is the source of truth.
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(nodes, edges))); } catch { /* quota / private mode */ }
  }, [nodes, edges]);

  // On mount: hydrate from the backend (workflow + channel readiness). The graph
  // was already painted from localStorage/seed; replace it only if the backend has
  // a non-empty definition.
  useEffect(() => {
    let alive = true;
    getChannelsStatus().then((res) => {
      if (alive && res.success && res.data) setChannels(res.data);
    });
    getRoles().then((res) => {
      if (alive && res.success && res.data) setRoles(res.data);
    });
    getUsers().then((res) => {
      if (alive && res.success && res.data) setUsers(res.data);
    });
    getWorkflow().then((res) => {
      if (!alive) return;
      const def = res.data;
      if (res.success && def && Array.isArray(def.statuses) && def.statuses.length > 0) {
        const g = workflowToGraph(def);
        setNodes(g.nodes);
        setEdges(g.edges);
      }
    });
    return () => { alive = false; };
  }, [setNodes, setEdges]);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    setEdges((eds) => addEdge(makeEdge(conn.source, conn.target), eds));
  }, [setEdges]);

  const onNodeClick = useCallback<NodeMouseHandler<StatusNode>>((_, node) => {
    setSelectedId(node.id);
  }, []);

  const addAction = useCallback((nodeId: string, type: ActionType) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, actions: [...n.data.actions, { type, recipient: "destinataire" as RecipientRole }] } }
        : n,
    ));
  }, [setNodes]);

  const updateAction = useCallback((nodeId: string, index: number, patch: Partial<ActionConfig>) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const actions = n.data.actions.map((a, i) => (i === index ? { ...a, ...patch } : a));
      return { ...n, data: { ...n.data, actions } };
    }));
  }, [setNodes]);

  const removeAction = useCallback((nodeId: string, index: number) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, actions: n.data.actions.filter((_, i) => i !== index) } } : n,
    ));
  }, [setNodes]);

  // Patch per-status governance fields (requireNote / allowedRoles / allowedUsers).
  const patchNodeData = useCallback((nodeId: string, patch: Partial<StatusNodeData>) => {
    setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [setNodes]);

  const save = useCallback(async () => {
    setSaving(true);
    setFeedback(null);
    const res = await saveWorkflow(graphToWorkflow(nodes, edges));
    setSaving(false);
    if (res.success) {
      setFeedback({ kind: "ok", msg: "Workflow enregistré." });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ kind: "err", msg: res.message || "Échec de l'enregistrement." });
    }
  }, [nodes, edges]);

  const deleteNode = useCallback((nodeId: string) => {
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setSelectedId((cur) => (cur === nodeId ? null : cur));
  }, [setNodes, setEdges]);

  const addStatus = useCallback(() => {
    const label = newLabel.trim();
    if (!label) return;
    const base = "custom_" + (label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "statut");
    const existing = new Set(nodes.map((n) => n.id));
    let id = base, i = 1;
    while (existing.has(id)) id = `${base}_${i++}`;
    const colors: StatusColors = { bg: hexToRgba(newColor, 0.12), text: newColor, dot: newColor };
    setNodes((nds) => [
      ...nds,
      makeNode({ id, statusKey: id, label, colors, actions: [], isCustom: true, position: { x: 80 + Math.random() * 120, y: 80 + Math.random() * 120 } }),
    ]);
    setSelectedId(id);
    setNewLabel("");
    setAdding(false);
  }, [newLabel, newColor, nodes, setNodes]);

  const reset = useCallback(() => {
    if (!window.confirm("Réinitialiser le workflow aux valeurs par défaut ? Les statuts personnalisés et les actions seront perdus.")) return;
    const seed = buildSeed();
    setNodes(seed.nodes);
    setEdges(seed.edges);
    setSelectedId(null);
  }, [setNodes, setEdges]);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  // Outgoing transition targets of the selected node, labelled by the target's
  // status label — feeds the "default transition" picker.
  const outgoingTargets = selectedNode
    ? edges
        .filter((e) => e.source === selectedNode.id)
        .map((e) => ({ key: e.target, label: nodes.find((n) => n.id === e.target)?.data.label ?? e.target }))
    : [];

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px",
    borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${t.border}`, transition: "background 0.12s, border-color 0.12s",
  };

  return (
    <DarkContext.Provider value={isDark}>
      <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
            background: hexToRgba(ACCENT, 0.1), border: `1px solid ${hexToRgba(ACCENT, 0.2)}`,
          }}>
            <Workflow size={20} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Workflow des statuts</h1>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
              Éditeur visuel des transitions de colis & actions automatiques — Admin uniquement
            </p>
          </div>
        </div>

        {/* toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "relative",
          padding: "12px 14px", marginBottom: 14, background: t.card, border: `1px solid ${t.border}`,
          borderRadius: 14, boxShadow: t.shadow,
        }}>
          <button
            onClick={() => setAdding((v) => !v)}
            style={{ ...btnBase, background: ACCENT, border: "none", color: "#fff" }}
          >
            <Plus size={15} /> Ajouter un statut
          </button>

          <button
            onClick={reset}
            style={{ ...btnBase, background: t.card, color: t.textSub }}
          >
            <RotateCcw size={14} /> Réinitialiser
          </button>

          <button
            onClick={save}
            disabled={saving}
            style={{ ...btnBase, background: ACCENT, border: "none", color: "#fff", opacity: saving ? 0.7 : 1, cursor: saving ? "wait" : "pointer" }}
          >
            {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />}
            Enregistrer
          </button>

          {feedback && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: feedback.kind === "ok" ? "#16a34a" : "#ef4444" }}>
              {feedback.msg}
            </span>
          )}

          <span style={{ flex: 1 }} />

          <span style={{ fontSize: 11.5, color: t.textMuted }}>
            Glissez pour déplacer · reliez les poignées pour créer une transition · sélectionnez puis
            <kbd style={{ margin: "0 4px", padding: "1px 5px", borderRadius: 4, background: t.rowHover, border: `1px solid ${t.border}`, fontSize: 10.5 }}>Suppr</kbd>
            pour supprimer
          </span>

          {/* add-status popover */}
          {adding && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 14, zIndex: 20, width: 300,
              padding: 16, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
              boxShadow: isDark ? "0 12px 32px rgba(0,0,0,0.5)" : "0 12px 32px rgba(0,0,0,0.14)",
            }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Nouveau statut
              </p>
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addStatus(); if (e.key === "Escape") setAdding(false); }}
                placeholder="Libellé du statut"
                style={{
                  width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, fontSize: 13,
                  background: t.inpBg, border: `1.5px solid ${t.inpBorder}`, color: t.text, outline: "none",
                }}
              />
              <p style={{ margin: "12px 0 7px", fontSize: 11, fontWeight: 600, color: t.textMuted }}>Couleur</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    title={c}
                    style={{
                      width: 26, height: 26, borderRadius: 8, cursor: "pointer", background: c,
                      border: newColor === c ? `2px solid ${t.text}` : "2px solid transparent",
                      boxShadow: newColor === c ? `0 0 0 2px ${t.card}, 0 0 0 4px ${c}` : "none",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={addStatus}
                  disabled={!newLabel.trim()}
                  style={{
                    ...btnBase, flex: 1, justifyContent: "center", border: "none", color: "#fff",
                    background: newLabel.trim() ? ACCENT : t.textFaint, cursor: newLabel.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  <Plus size={14} /> Ajouter
                </button>
                <button onClick={() => setAdding(false)} style={{ ...btnBase, background: t.card, color: t.textSub }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* canvas + side panel */}
        <div style={{ display: "flex", gap: 14, height: "calc(100vh - 11rem)" }}>
          <div style={{
            flex: 1, minWidth: 0, position: "relative", borderRadius: 14, overflow: "hidden",
            border: `1px solid ${t.border}`, background: t.canvas,
          }}>
            <ReactFlow<StatusNode, Edge>
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedId(null)}
              nodeTypes={nodeTypes}
              colorMode={(isDark ? "dark" : "light") as ColorMode}
              deleteKeyCode={["Backspace", "Delete"]}
              minZoom={0.2}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={18} />
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => {
                  const d = n.data as StatusNodeData;
                  return d?.colors?.dot ?? "#94a3b8";
                }}
              />
            </ReactFlow>
          </div>

          {selectedNode && (
            <ActionsPanel
              t={t}
              node={selectedNode}
              channels={channels}
              roles={roles}
              users={users}
              outgoingTargets={outgoingTargets}
              onAddAction={(type) => addAction(selectedNode.id, type)}
              onUpdateAction={(i, patch) => updateAction(selectedNode.id, i, patch)}
              onRemoveAction={(i) => removeAction(selectedNode.id, i)}
              onPatch={(patch) => patchNodeData(selectedNode.id, patch)}
              onDelete={() => deleteNode(selectedNode.id)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </DarkContext.Provider>
  );
}

export default function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <Builder />
    </ReactFlowProvider>
  );
}
