"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Boxes, RefreshCw, Search, X, ChevronLeft, ChevronRight, ChevronDown,
  Loader2, Package2, Phone, MapPin, Truck, CreditCard,
  Calendar, Weight, AlertTriangle, FileText, Store, User,
  Hash, Clock, CheckSquare, Archive, History, Building2,
  ArrowUpRight, ArrowDownLeft,
  PhoneCall, PhoneMissed, PhoneOff, CheckCircle, XCircle, Clock3, Printer,
} from "lucide-react";
import {
  getPackages, getPackageStats, updatePackageStatus, getPackage, getPackageHistory, bulkMarkReady,
  recordPackageCall, getEchecThreshold, declareEchec, deletePackage,
  type Package, type PaginatedPackages, type PackageStatus, type ServiceType,
  type PackageStatusLog, type PackageStats, type CallOutcome,
  STATUS_LABELS, STATUS_COLORS, SERVICE_LABELS, TRANSITIONS,
  CALLABLE_STATUSES, CALL_OUTCOME_LABELS,
} from "@/lib/packages";
import { getWilayas, type Wilaya } from "@/lib/geography";
import { getStatusWorkflow, type WorkflowDefinition } from "@/lib/notifications";
import { api, getStoredUser, isSDLocked, getLockedSDId, type ApiResponse } from "@/lib/api";
import PackageLabel from "@/components/PackageLabel";
import SDSelector from "@/components/SDSelector";

/* ── SD option type (matches /stop-desks response) ────────── */
interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  commune_id: number;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

const COLIS_SD_KEY = "colis_selected_sd";

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
    textFaint: "#4b5563", shadow: "none", modalBg: "#111827", overlay: "rgba(0,0,0,0.6)",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    chipActive: { bg: "rgba(249,115,22,0.15)", text: "#fb923c", border: "#f97316" },
    chipDefault: { bg: "#1e2130", text: "#6b7280", border: "#2a3145" },
    iconBg: "rgba(255,255,255,0.07)",
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6",
    rowHover: "#f9fafb", text: "#111827", textSub: "#374151", textMuted: "#6b7280",
    textFaint: "#9ca3af", shadow: "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    modalBg: "#ffffff", overlay: "rgba(0,0,0,0.35)",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    chipActive: { bg: "rgba(249,115,22,0.1)", text: "#ea580c", border: "#f97316" },
    chipDefault: { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" },
    iconBg: "#f3f4f6",
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── helpers ──────────────────────────────────────────────── */
const PER_PAGE = 20;
function formatDA(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-DZ") + " DA";
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* Virtual filter values that map to comma-separated API statuses */
type ColisFilterValue = PackageStatus | "all" | "a_traiter" | "en_cours" | "termines";

interface ColisStatusChip {
  value: ColisFilterValue;
  label: string;
  /** Comma-separated API statuses (undefined = no filter) */
  apiStatuses?: string;
  color?: string;
}

const ENVOI_COLIS_STATUSES: ColisStatusChip[] = [
  { value: "a_traiter",  label: "À traiter",  apiStatuses: "en_attente,pret_a_expedier,accepte_operateur", color: "#f59e0b" },
  { value: "en_cours",   label: "En cours",   apiStatuses: "en_sac,en_transit,demande_ramassage,en_ramassage", color: "#3b82f6" },
  { value: "termines",   label: "Terminés",   apiStatuses: "arrive_destination,pret_pour_retrait,livre", color: "#10b981" },
  { value: "en_attente",       label: "Attente",    apiStatuses: "en_attente" },
  { value: "accepte_operateur", label: "Accepté",   apiStatuses: "accepte_operateur" },
  { value: "demande_ramassage" as ColisFilterValue, label: "Demande ramassage", apiStatuses: "demande_ramassage" },
  { value: "en_ramassage" as ColisFilterValue, label: "En ramassage", apiStatuses: "en_ramassage" },
  { value: "en_sac",           label: "En sac",     apiStatuses: "en_sac" },
  { value: "en_transit",       label: "Transit",    apiStatuses: "en_transit" },
  { value: "livre",            label: "Livré",      apiStatuses: "livre" },
  { value: "annule",           label: "Annulé",     apiStatuses: "annule" },
  { value: "all",              label: "Tous" },
];

const RECEPTION_COLIS_STATUSES: ColisStatusChip[] = [
  { value: "a_traiter",  label: "À traiter",  apiStatuses: "arrive_destination,pret_pour_retrait,pret_pour_chauffeur,reporte", color: "#f59e0b" },
  { value: "en_transit",  label: "En route",   apiStatuses: "en_transit", color: "#3b82f6" },
  { value: "chauffeur" as ColisFilterValue, label: "Livreur", apiStatuses: "pret_pour_chauffeur,en_cours_livraison", color: "#f97316" },
  { value: "termines",    label: "Terminés",   apiStatuses: "livre,annule", color: "#10b981" },
  { value: "arrive_destination",  label: "Arrivé",   apiStatuses: "arrive_destination" },
  { value: "reporte" as ColisFilterValue, label: "Reporté", apiStatuses: "reporte" },
  { value: "pret_pour_retrait",   label: "Retrait",  apiStatuses: "pret_pour_retrait" },
  { value: "pret_pour_chauffeur" as ColisFilterValue, label: "Prêt livreur", apiStatuses: "pret_pour_chauffeur" },
  { value: "en_cours_livraison" as ColisFilterValue, label: "En livraison", apiStatuses: "en_cours_livraison" },
  { value: "echec_livraison" as ColisFilterValue, label: "Échec", apiStatuses: "echec_livraison", color: "#ef4444" },
  { value: "livre",               label: "Livré",    apiStatuses: "livre" },
  { value: "all",                 label: "Tous" },
];

const ALL_SERVICES: { value: ServiceType | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "livraison", label: "Livraison" },
  { value: "pickup", label: "Pickup" },
  { value: "echange", label: "Échange" },
  { value: "recouvrement", label: "Recouvrement" },
];

const SERVICE_COLORS: Record<ServiceType, { bg: string; text: string }> = {
  livraison: { bg: "rgba(59,130,246,0.1)", text: "#2563eb" },
  pickup: { bg: "rgba(16,185,129,0.1)", text: "#059669" },
  echange: { bg: "rgba(245,158,11,0.1)", text: "#d97706" },
  recouvrement: { bg: "rgba(168,85,247,0.1)", text: "#7c3aed" },
};

/* ── sub-components ──────────────────────────────────────── */
function StatusBadge({ status }: { status: PackageStatus }) {
  const c = STATUS_COLORS[status] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ServiceBadge({ type }: { type: ServiceType }) {
  const c = SERVICE_COLORS[type] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>
      {SERVICE_LABELS[type] ?? type}
    </span>
  );
}

function Chip({ active, label, color, onClick, t, icon }: {
  active: boolean; label: string; color?: { bg: string; text: string; dot?: string };
  onClick: () => void; t: Tokens; icon?: React.ReactNode;
}) {
  const base = active ? t.chipActive : t.chipDefault;
  const dotColor = active && color?.dot ? color.dot : active ? t.chipActive.text : undefined;
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 13px", borderRadius: 999, fontSize: 12, fontWeight: 600,
        background: active && color ? color.bg : base.bg,
        color: active && color ? color.text : base.text,
        border: `1px solid ${active ? (color ? color.text + "33" : base.border) : base.border}`,
        cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
      }}
    >
      {icon}
      {dotColor && !icon && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />}
      {label}
    </button>
  );
}

/* ── Pipeline bar (flat chip row, same style as Chip) ───── */
function PipelineBar({ chips, statusFilter, onFilter, t }: {
  chips: ColisStatusChip[];
  statusFilter: ColisFilterValue;
  onFilter: (v: ColisFilterValue) => void;
  t: Tokens;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map(chip => {
        const active = statusFilter === chip.value;
        const c = chip.value !== "all" && (chip.value as string) in STATUS_COLORS
          ? STATUS_COLORS[chip.value as PackageStatus]
          : undefined;
        return (
          <Chip
            key={chip.value}
            active={active}
            label={chip.label}
            color={c}
            onClick={() => onFilter(chip.value)}
            t={t}
          />
        );
      })}
    </div>
  );
}

/* ── Active Filter Tags ──────────────────────────────────── */
function ActiveFilterTags({ filters, onClear, onClearAll, t }: {
  filters: { key: string; label: string }[];
  onClear: (key: string) => void;
  onClearAll: () => void;
  t: Tokens;
}) {
  if (filters.length === 0) return null;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 14,
    }}>
      {filters.map(f => (
        <span
          key={f.key}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: "rgba(249,115,22,0.1)", color: "#ea580c",
            border: "1px solid rgba(249,115,22,0.2)",
          }}
        >
          {f.label}
          <button
            onClick={() => onClear(f.key)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              color: "#ea580c", display: "flex", alignItems: "center",
            }}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        style={{
          fontSize: 11, fontWeight: 700, color: t.textMuted,
          background: "none", border: "none", cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Effacer tout
      </button>
    </div>
  );
}

/* ── Timeline ────────────────────────────────────────────── */
function TimelineView({ logs, t }: { logs: PackageStatusLog[]; t: Tokens }) {
  if (!logs.length) return <p style={{ color: t.textMuted, fontSize: 13, textAlign: "center", padding: 20 }}>Aucun historique</p>;
  return (
    <div style={{ padding: "8px 0" }}>
      {logs.map((log, i) => {
        const c = STATUS_COLORS[log.to_status as PackageStatus] ?? { dot: "#6b7280", text: "#6b7280" };
        return (
          <div key={log.id} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.dot, flexShrink: 0, marginTop: 4 }} />
              {i < logs.length - 1 && <div style={{ width: 2, flex: 1, background: t.divider, minHeight: 24 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>
                  {STATUS_LABELS[log.to_status as PackageStatus] ?? log.to_status}
                </span>
                {log.from_status && (
                  <span style={{ fontSize: 10, color: t.textFaint }}>
                    depuis {STATUS_LABELS[log.from_status as PackageStatus] ?? log.from_status}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted }}>
                {log.changed_by_user ? `${log.changed_by_user.first_name} ${log.changed_by_user.last_name}` : `#${log.changed_by}`}
                {" · "}{formatDate(log.created_at)}
                {log.bag && <span> · Sac {log.bag.tracking_number}</span>}
              </div>
              {log.notes && <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>{log.notes}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Workflow-aware next-status options ──────────────────────
   Reads the admin-defined workflow (per-status `transitions` / `require_note`,
   incl. custom statuses with their builder label/color). Returns null when no
   workflow node governs the current status → caller falls back to TRANSITIONS. */
type NextStatusOption = { key: string; label: string; color: string; requireNote: boolean };

function workflowNextOptions(
  workflow: WorkflowDefinition | null,
  current: PackageStatus,
): NextStatusOption[] | null {
  if (!workflow || !Array.isArray(workflow.statuses) || workflow.statuses.length === 0) return null;
  const node = workflow.statuses.find(s => s.key === current);
  if (!node) return null;
  const trans = (node as { transitions?: unknown }).transitions;
  if (!Array.isArray(trans)) return null;
  const byKey = new Map(workflow.statuses.map(s => [s.key, s]));
  const opts: NextStatusOption[] = [];
  for (const tk of trans) {
    if (typeof tk !== "string") continue;
    const target = byKey.get(tk);
    opts.push({
      key: tk,
      label: target?.label ?? STATUS_LABELS[tk as PackageStatus] ?? tk,
      color: (typeof target?.color === "string" ? target.color : undefined)
        ?? STATUS_COLORS[tk as PackageStatus]?.dot ?? "#6b7280",
      requireNote: target ? (target as { require_note?: unknown }).require_note === true : false,
    });
  }
  return opts;
}

/* ── Detail modal ────────────────────────────────────────── */
function DetailModal({
  pkg, t, onClose, onStatusChange, onRefresh,
}: {
  pkg: Package; t: Tokens; onClose: () => void;
  onStatusChange: (id: number, status: PackageStatus, notes?: string) => Promise<ApiResponse<Package>>;
  onRefresh: () => void;
}) {
  const [newStatus, setNewStatus] = useState<string>(pkg.status);
  const [note, setNote] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [tab, setTab] = useState<"info" | "timeline">("info");
  const [showLabel, setShowLabel] = useState(false);
  const [timeline, setTimeline] = useState<PackageStatusLog[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);

  // Workflow-aware transitions: prefer the admin workflow's per-status `transitions`
  // (with custom labels/colors), otherwise fall back to the static TRANSITIONS map.
  const wfOptions = workflowNextOptions(workflow, pkg.status);
  const statusOptions: NextStatusOption[] = wfOptions ?? (TRANSITIONS[pkg.status] ?? []).map(s => ({
    key: s,
    label: STATUS_LABELS[s] ?? s,
    color: STATUS_COLORS[s]?.dot ?? "#6b7280",
    requireNote: false,
  }));
  const selectedOption = statusOptions.find(o => o.key === newStatus) ?? null;
  const noteRequired = !!selectedOption?.requireNote;

  useEffect(() => {
    getStatusWorkflow().then(res => {
      if (res.success && res.data) setWorkflow(res.data);
    });
  }, []);

  useEffect(() => {
    if (tab === "timeline") {
      setLoadingTimeline(true);
      getPackageHistory(pkg.id).then(res => {
        if (res.success && res.data) setTimeline(res.data);
        setLoadingTimeline(false);
      });
    }
  }, [tab, pkg.id]);

  const handleChange = async () => {
    if (newStatus === pkg.status) return;
    if (noteRequired && !note.trim()) {
      setChangeError("Une note est requise pour ce statut.");
      return;
    }
    setChangeError(null);
    setChanging(true);
    const res = await onStatusChange(pkg.id, newStatus as PackageStatus, note.trim() || undefined);
    setChanging(false);
    if (res.success) {
      setNote("");
    } else {
      setChangeError(res.message || "Échec du changement de statut.");
    }
  };

  const sectionStyle: React.CSSProperties = {
    padding: "14px 18px", borderRadius: 10,
    border: `1px solid ${t.border}`, marginBottom: 14,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8,
    display: "flex", alignItems: "center", gap: 6,
  };
  const valStyle: React.CSSProperties = { fontSize: 13, color: t.text, lineHeight: 1.6 };
  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: t.overlay, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.modalBg, borderRadius: 16,
          border: `1px solid ${t.border}`,
          width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 4 }}>N° TRACKING</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text, fontFamily: "monospace" }}>
              {pkg.tracking_number}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusBadge status={pkg.status} />
              <ServiceBadge type={pkg.service_type} />
              {pkg.bag && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                  background: "rgba(99,102,241,0.1)", color: "#4f46e5",
                }}>
                  <Archive size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
                  {pkg.bag.tracking_number}
                </span>
              )}
              {pkg.days_waiting != null && pkg.days_waiting > 7 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                  background: "rgba(245,158,11,0.15)", color: "#d97706",
                }}>
                  <AlertTriangle size={11} style={{ display: "inline", marginRight: 3, verticalAlign: "-1px" }} />
                  {pkg.days_waiting}j en attente
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: "pointer", color: t.textMuted,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {(["info", "timeline"] as const).map(tb => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              style={{
                padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: tab === tb ? t.chipActive.bg : "transparent",
                color: tab === tb ? t.chipActive.text : t.textMuted,
                border: tab === tb ? `1px solid ${t.chipActive.border}33` : "1px solid transparent",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {tb === "info" ? <><FileText size={13} /> Détails</> : <><History size={13} /> Historique</>}
            </button>
          ))}
        </div>

        {tab === "timeline" ? (
          loadingTimeline ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: t.textMuted }} />
            </div>
          ) : (
            <TimelineView logs={timeline} t={t} />
          )
        ) : (
          <>
            {/* Expéditeur */}
            <div style={sectionStyle}>
              <div style={labelStyle}><User size={13} /> Expéditeur</div>
              <div style={valStyle}>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Nom</span><span style={{ fontWeight: 600 }}>{pkg.sender_name}</span></div>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Téléphone</span><span>{pkg.sender_phone}</span></div>
              </div>
            </div>

            {/* Destinataire */}
            <div style={sectionStyle}>
              <div style={labelStyle}><MapPin size={13} /> Destinataire</div>
              <div style={valStyle}>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Nom</span><span style={{ fontWeight: 600 }}>{pkg.recipient_name}</span></div>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Téléphone</span><span>{pkg.recipient_phone}</span></div>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Wilaya</span><span>{pkg.recipient_wilaya?.name ?? "—"}</span></div>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Commune</span><span>{pkg.recipient_commune?.name ?? "—"}</span></div>
                {pkg.recipient_address && (
                  <div style={rowStyle}><span style={{ color: t.textMuted }}>Adresse</span><span style={{ textAlign: "right", maxWidth: 250 }}>{pkg.recipient_address}</span></div>
                )}
              </div>
            </div>

            {/* Livraison */}
            <div style={sectionStyle}>
              <div style={labelStyle}><Truck size={13} /> Livraison</div>
              <div style={valStyle}>
                <div style={rowStyle}>
                  <span style={{ color: t.textMuted }}>Type</span>
                  <span>{pkg.delivery_type === "home_delivery" ? "Domicile" : "Stop Desk"}</span>
                </div>
                {pkg.origin_stop_desk && (
                  <div style={rowStyle}><span style={{ color: t.textMuted }}>SD Origine</span><span>{pkg.origin_stop_desk.name}</span></div>
                )}
                {pkg.destination_stop_desk && (
                  <div style={rowStyle}><span style={{ color: t.textMuted }}>SD Destination</span><span>{pkg.destination_stop_desk.name}</span></div>
                )}
              </div>
            </div>

            {/* Paiement */}
            <div style={sectionStyle}>
              <div style={labelStyle}><CreditCard size={13} /> Paiement</div>
              <div style={valStyle}>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Type paiement</span><span>{pkg.payment_type === "sender" ? "Expéditeur" : "Destinataire"}</span></div>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Montant COD</span><span style={{ fontWeight: 700 }}>{formatDA(pkg.cod_amount)}</span></div>
                <div style={rowStyle}><span style={{ color: t.textMuted }}>Frais livraison</span><span>{formatDA(pkg.shipping_cost)}</span></div>
                <div style={{ ...rowStyle, borderTop: `1px solid ${t.divider}`, paddingTop: 6, marginTop: 4 }}>
                  <span style={{ color: t.textMuted, fontWeight: 700 }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{formatDA((pkg.cod_amount || 0) + (pkg.shipping_cost || 0))}</span>
                </div>
              </div>
            </div>

            {/* Call tracking */}
            {pkg.call_attempts > 0 && (
              <div style={sectionStyle}>
                <div style={labelStyle}><Phone size={13} /> Suivi appels</div>
                <div style={valStyle}>
                  <div style={rowStyle}>
                    <span style={{ color: t.textMuted }}>Tentatives</span>
                    <span style={{ fontWeight: 700 }}>{pkg.call_attempts}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ color: t.textMuted }}>Dernier résultat</span>
                    <span style={{
                      padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: CALL_BUTTONS.find(b => b.outcome === pkg.last_call_status)?.bg ?? "rgba(107,114,128,0.1)",
                      color: CALL_BUTTONS.find(b => b.outcome === pkg.last_call_status)?.color ?? t.textMuted,
                    }}>
                      {pkg.last_call_status ? (CALL_OUTCOME_LABELS[pkg.last_call_status] ?? pkg.last_call_status) : "—"}
                    </span>
                  </div>
                  {pkg.last_called_at && (
                    <div style={rowStyle}>
                      <span style={{ color: t.textMuted }}>Dernier appel</span>
                      <span style={{ fontSize: 12 }}>{formatDate(pkg.last_called_at)}</span>
                    </div>
                  )}
                  {pkg.last_call_notes && (
                    <div style={{ marginTop: 4, fontSize: 12, color: t.textSub, fontStyle: "italic" }}>
                      {pkg.last_call_notes}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status change (workflow-aware) */}
            {statusOptions.length > 0 && (
              <div style={{ ...sectionStyle, marginBottom: 0, background: t.iconBg }}>
                <div style={labelStyle}>Changer le statut</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0, alignSelf: "center",
                    background: selectedOption?.color ?? STATUS_COLORS[pkg.status]?.dot ?? "#6b7280",
                  }} />
                  <select
                    value={newStatus}
                    onChange={e => { setNewStatus(e.target.value); setChangeError(null); }}
                    style={{
                      flex: 1, background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                      borderRadius: 8, padding: "8px 12px", fontSize: 13,
                      color: t.inp.text, outline: "none", cursor: "pointer",
                    }}
                  >
                    <option value={pkg.status}>{STATUS_LABELS[pkg.status] ?? pkg.status} (actuel)</option>
                    {statusOptions.map(o => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleChange}
                    disabled={changing || newStatus === pkg.status || (noteRequired && !note.trim())}
                    style={{
                      padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: (newStatus === pkg.status || (noteRequired && !note.trim())) ? t.chipDefault.bg : "#f97316",
                      color: (newStatus === pkg.status || (noteRequired && !note.trim())) ? t.textMuted : "#fff",
                      border: "none", cursor: (newStatus === pkg.status || (noteRequired && !note.trim())) ? "default" : "pointer",
                      opacity: changing ? 0.6 : 1, transition: "all 0.15s",
                    }}
                  >
                    {changing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "Changer"}
                  </button>
                </div>

                {/* Note — required when the target status demands it */}
                {newStatus !== pkg.status && (
                  <textarea
                    value={note}
                    onChange={e => { setNote(e.target.value); if (changeError) setChangeError(null); }}
                    rows={2}
                    placeholder={noteRequired ? "Note obligatoire pour ce statut…" : "Note (optionnelle)…"}
                    style={{
                      width: "100%", boxSizing: "border-box", marginTop: 8, resize: "vertical",
                      background: t.inp.bg, border: `1px solid ${noteRequired && !note.trim() ? "#ef4444" : t.inp.border}`,
                      borderRadius: 8, padding: "8px 12px", fontSize: 13, lineHeight: 1.5,
                      color: t.inp.text, outline: "none", fontFamily: "inherit",
                    }}
                  />
                )}
                {noteRequired && (
                  <div style={{ marginTop: 4, fontSize: 11, color: t.textMuted }}>
                    <AlertTriangle size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
                    Une note est obligatoire pour passer à « {selectedOption?.label} ».
                  </div>
                )}
                {changeError && (
                  <div style={{
                    marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                  }}>
                    {changeError}
                  </div>
                )}
              </div>
            )}

            {/* Print label */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
              <button
                onClick={() => setShowLabel(true)}
                style={{
                  width: "100%", padding: "8px 0", borderRadius: 8, border: `1px solid ${t.border}`,
                  background: "transparent", color: t.textSub,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <Printer size={13} /> Imprimer l'étiquette
              </button>
            </div>
            {showLabel && <PackageLabel pkg={pkg} onClose={() => setShowLabel(false)} />}

            {/* Admin: delete button */}
            {getStoredUser()?.user_type === "admin" && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
                <button
                  onClick={async () => {
                    if (!confirm("Supprimer définitivement ce colis ? Cette action est irréversible.")) return;
                    const res = await deletePackage(pkg.id);
                    if ((res as any).success) { onClose(); onRefresh(); }
                  }}
                  style={{
                    width: "100%", padding: "8px 0", borderRadius: 8, border: `1px solid rgba(239,68,68,0.3)`,
                    background: "rgba(239,68,68,0.06)", color: "#ef4444",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <XCircle size={13} /> Supprimer ce colis
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Call outcome button config ────────────────────────────── */
const CALL_BUTTONS: {
  outcome: CallOutcome;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}[] = [
  { outcome: "joint",          label: "Joint",           desc: "Confirmé, prêt au retrait",       icon: <CheckCircle size={20} />,  color: "#16a34a", bg: "rgba(34,197,94,0.1)" },
  { outcome: "pas_de_reponse", label: "Pas de réponse",  desc: "Réessayer plus tard",             icon: <PhoneMissed size={20} />,  color: "#d97706", bg: "rgba(245,158,11,0.1)" },
  { outcome: "reporte",        label: "Reporté",         desc: "Le destinataire demande un report",icon: <Clock3 size={20} />,       color: "#7c3aed", bg: "rgba(139,92,246,0.1)" },
  { outcome: "refuse",         label: "Refusé",          desc: "Le destinataire refuse",          icon: <XCircle size={20} />,      color: "#dc2626", bg: "rgba(239,68,68,0.1)" },
  { outcome: "injoignable",    label: "Injoignable",     desc: "Numéro injoignable",              icon: <PhoneOff size={20} />,     color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
];

/* ── CallModal (single or stepper) ───────────────────────── */
function CallModal({
  packages: pkgList,
  t,
  onClose,
  onCallRecorded,
  echecThreshold = 3,
}: {
  packages: Package[];
  t: Tokens;
  onClose: () => void;
  onCallRecorded: () => void;
  echecThreshold?: number;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [outcomes, setOutcomes] = useState<Record<number, CallOutcome>>({});
  const [echecSuggested, setEchecSuggested] = useState<number | null>(null);
  const [declaringEchec, setDeclaringEchec] = useState(false);
  const isStepper = pkgList.length > 1;
  const pkg = pkgList[currentIdx];
  if (!pkg) return null;

  const processedCount = Object.keys(outcomes).length;
  const jointCount = Object.values(outcomes).filter(o => o === "joint").length;

  const handleOutcome = async (outcome: CallOutcome) => {
    setRecording(true);
    try {
      const res = await recordPackageCall(pkg.id, outcome, notes || undefined);
      setOutcomes(prev => ({ ...prev, [pkg.id]: outcome }));
      setNotes("");
      setShowNotes(false);

      // Check if we should suggest échec livraison
      const updatedPkg = res.data;
      const newAttempts = updatedPkg?.call_attempts ?? (pkg.call_attempts + 1);
      if (outcome !== "joint" && newAttempts >= echecThreshold && updatedPkg?.status !== "echec_livraison") {
        setEchecSuggested(pkg.id);
        setRecording(false);
        return; // Don't auto-advance — show échec warning
      }

      // Auto-advance to next uncalled package in stepper mode
      if (isStepper) {
        const nextIdx = pkgList.findIndex((p, i) => i > currentIdx && !outcomes[p.id]);
        if (nextIdx !== -1) {
          setCurrentIdx(nextIdx);
        } else {
          onCallRecorded();
          onClose();
        }
      } else {
        onCallRecorded();
        onClose();
      }
    } catch {
      // silently handle — API error
    }
    setRecording(false);
  };

  const handleDeclareEchec = async () => {
    if (!echecSuggested) return;
    setDeclaringEchec(true);
    try {
      await declareEchec(echecSuggested);
      setEchecSuggested(null);
      onCallRecorded();
      if (!isStepper) {
        onClose();
      } else {
        const nextIdx = pkgList.findIndex((p, i) => i > currentIdx && !outcomes[p.id]);
        if (nextIdx !== -1) setCurrentIdx(nextIdx);
        else onClose();
      }
    } catch {
      // silently handle
    }
    setDeclaringEchec(false);
  };

  const dismissEchec = () => {
    setEchecSuggested(null);
    if (isStepper) {
      const nextIdx = pkgList.findIndex((p, i) => i > currentIdx && !outcomes[p.id]);
      if (nextIdx !== -1) setCurrentIdx(nextIdx);
      else { onCallRecorded(); onClose(); }
    } else {
      onCallRecorded();
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: t.overlay, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.modalBg, borderRadius: 18,
          border: `1px solid ${t.border}`,
          width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
          padding: 0,
        }}
      >
        {/* Stepper progress bar */}
        {isStepper && (
          <div style={{ padding: "16px 20px 0" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted }}>
                Colis {currentIdx + 1} / {pkgList.length}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
                {processedCount} traité{processedCount > 1 ? "s" : ""}
                {jointCount > 0 && <span style={{ color: "#16a34a" }}> · {jointCount} joint{jointCount > 1 ? "s" : ""}</span>}
              </span>
            </div>
            {/* Progress dots */}
            <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
              {pkgList.map((p, i) => {
                const o = outcomes[p.id];
                let bg = t.border;
                if (o === "joint") bg = "#22c55e";
                else if (o === "refuse") bg = "#ef4444";
                else if (o === "reporte") bg = "#8b5cf6";
                else if (o === "pas_de_reponse" || o === "injoignable") bg = "#f59e0b";
                else if (i === currentIdx) bg = "#f97316";
                return (
                  <div
                    key={p.id}
                    onClick={() => setCurrentIdx(i)}
                    style={{
                      flex: 1, height: 4, borderRadius: 2, background: bg,
                      cursor: "pointer", transition: "background 0.2s",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Package header */}
        <div style={{ padding: "18px 22px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 2 }}>N° TRACKING</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: t.text, fontFamily: "monospace" }}>
                {pkg.tracking_number}
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", cursor: "pointer", color: t.textMuted,
            }}>
              <X size={16} />
            </button>
          </div>

          {/* Recipient info */}
          <div style={{
            marginTop: 14, padding: "14px 16px", borderRadius: 12,
            border: `1px solid ${t.border}`, background: t.iconBg,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(6,182,212,0.1)",
              }}>
                <User size={18} style={{ color: "#0891b2" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{pkg.recipient_name}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  {pkg.recipient_wilaya?.name ?? ""}{pkg.recipient_commune ? ` · ${pkg.recipient_commune.name}` : ""}
                </div>
              </div>
              <StatusBadge status={pkg.status} />
            </div>

            {/* Phone — clickable */}
            <a
              href={`tel:${pkg.recipient_phone}`}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                textDecoration: "none", transition: "all 0.15s",
              }}
            >
              <PhoneCall size={18} style={{ color: "#16a34a" }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a", letterSpacing: "0.5px" }}>
                {pkg.recipient_phone}
              </span>
              <span style={{ fontSize: 11, color: "#16a34a", marginLeft: "auto", fontWeight: 600 }}>
                Appeler
              </span>
            </a>

            {/* Previous call info */}
            {pkg.call_attempts > 0 && (
              <div style={{
                marginTop: 8, display: "flex", alignItems: "center", gap: 8,
                fontSize: 11, color: t.textMuted,
              }}>
                <Phone size={12} />
                <span>{pkg.call_attempts} tentative{pkg.call_attempts > 1 ? "s" : ""}</span>
                {pkg.last_call_status && (
                  <span style={{
                    padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                    background: CALL_BUTTONS.find(b => b.outcome === pkg.last_call_status)?.bg ?? t.iconBg,
                    color: CALL_BUTTONS.find(b => b.outcome === pkg.last_call_status)?.color ?? t.textMuted,
                  }}>
                    {CALL_OUTCOME_LABELS[pkg.last_call_status] ?? pkg.last_call_status}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Outcome buttons */}
        <div style={{ padding: "16px 22px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
            Résultat de l'appel
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {CALL_BUTTONS.map(btn => (
              <button
                key={btn.outcome}
                onClick={() => handleOutcome(btn.outcome)}
                disabled={recording}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "14px 10px", borderRadius: 12,
                  background: btn.bg, border: `1px solid ${btn.color}22`,
                  cursor: recording ? "default" : "pointer",
                  opacity: recording ? 0.5 : 1, transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!recording) (e.currentTarget.style.transform = "translateY(-1px)"); }}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <span style={{ color: btn.color }}>{btn.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: btn.color }}>{btn.label}</span>
                <span style={{ fontSize: 10, color: t.textMuted, textAlign: "center", lineHeight: 1.3 }}>{btn.desc}</span>
              </button>
            ))}
          </div>

          {/* Notes (collapsible) */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowNotes(!showNotes)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 600, color: t.textMuted,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <FileText size={12} />
              {showNotes ? "Masquer les notes" : "Ajouter une note"}
              <ChevronDown size={11} style={{ transform: showNotes ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
            </button>
            {showNotes && (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Note optionnelle..."
                rows={2}
                style={{
                  width: "100%", marginTop: 6, background: t.inp.bg,
                  border: `1px solid ${t.inp.border}`, borderRadius: 8,
                  padding: "8px 12px", fontSize: 12, color: t.inp.text,
                  outline: "none", resize: "vertical", fontFamily: "inherit",
                }}
              />
            )}
          </div>
        </div>

        {/* Échec livraison warning */}
        {echecSuggested && (
          <div style={{
            margin: "0 22px 16px", padding: 16, borderRadius: 12,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={16} style={{ color: "#ef4444" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>
                Seuil d'appels atteint ({echecThreshold} tentatives)
              </span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
              Ce colis a atteint le nombre maximum de tentatives d'appel.
              Voulez-vous le déclarer en échec de livraison ?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDeclareEchec} disabled={declaringEchec} style={{
                padding: "8px 16px", borderRadius: 10, border: "none",
                background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700,
                cursor: declaringEchec ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {declaringEchec ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                Déclarer échec
              </button>
              <button onClick={dismissEchec} style={{
                padding: "8px 16px", borderRadius: 10, border: `1px solid ${t.border}`,
                background: "transparent", color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
                Ignorer
              </button>
            </div>
          </div>
        )}

        {/* Stepper navigation */}
        {isStepper && (
          <div style={{
            padding: "12px 22px 16px",
            borderTop: `1px solid ${t.divider}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <button
              onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: t.iconBg, border: `1px solid ${t.border}`,
                color: currentIdx === 0 ? t.textFaint : t.textSub,
                cursor: currentIdx === 0 ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <ChevronLeft size={13} /> Précédent
            </button>
            <button
              onClick={() => {
                if (currentIdx < pkgList.length - 1) {
                  setCurrentIdx(i => i + 1);
                } else {
                  onCallRecorded();
                  onClose();
                }
              }}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: currentIdx === pkgList.length - 1 ? "#f97316" : t.iconBg,
                border: `1px solid ${currentIdx === pkgList.length - 1 ? "#f97316" : t.border}`,
                color: currentIdx === pkgList.length - 1 ? "#fff" : t.textSub,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {currentIdx === pkgList.length - 1 ? "Terminer" : <>Passer <ChevronRight size={13} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function GestionColisPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // SD context
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const [direction, setDirection] = useState<"envoi" | "reception">("envoi");
  const sdLoaded = useRef(false);

  // Stats
  const [stats, setStats] = useState<PackageStats | null>(null);

  // Wilayas for filter
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);

  // Packages + pagination
  const [packages, setPackages] = useState<Package[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ColisFilterValue>("a_traiter");
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [wilayaFilter, setWilayaFilter] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lateOnly, setLateOnly] = useState(false);

  // UI
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [labelPkg, setLabelPkg] = useState<Package | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulking, setBulking] = useState(false);
  const [callModalPkgs, setCallModalPkgs] = useState<Package[]>([]);
  const [echecThreshold, setEchecThreshold] = useState(3);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load stop desks + restore from localStorage
  useEffect(() => {
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); sdLoaded.current = true; return; }
        const saved = localStorage.getItem(COLIS_SD_KEY);
        if (saved) {
          const id = Number(saved);
          if (res.data.some(sd => sd.id === id)) setSelectedSD(id);
          else if (res.data.length > 0) setSelectedSD(res.data[0].id);
        } else if (res.data.length > 0) {
          setSelectedSD(res.data[0].id);
        }
        sdLoaded.current = true;
      }
    });
    getWilayas().then(res => {
      if (res.success && res.data) setWilayas(res.data);
    });
    getEchecThreshold().then(res => {
      if (res.success && res.data) setEchecThreshold(res.data.threshold);
    });
  }, []);

  // Persist SD selection
  useEffect(() => {
    if (selectedSD !== null) localStorage.setItem(COLIS_SD_KEY, String(selectedSD));
  }, [selectedSD]);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Reset status filter when direction changes
  useEffect(() => {
    setStatusFilter("a_traiter");
  }, [direction]);

  // Debounce search
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Resolve virtual filter to API status param
  const resolveStatusParam = useCallback((filter: ColisFilterValue): string | undefined => {
    if (filter === "all") return undefined;
    const chips = direction === "envoi" ? ENVOI_COLIS_STATUSES : RECEPTION_COLIS_STATUSES;
    const chip = chips.find(c => c.value === filter);
    return chip?.apiStatuses;
  }, [direction]);

  // Fetch stats when SD or direction changes
  useEffect(() => {
    if (!selectedSD) { setStats(null); return; }
    const sdParam = direction === "envoi"
      ? { origin_stop_desk_id: selectedSD }
      : { destination_stop_desk_id: selectedSD };
    getPackageStats(sdParam).then(res => {
      if (res.success && res.data) setStats(res.data);
    });
  }, [selectedSD, direction]);

  // Fetch packages
  const fetchPackages = useCallback(async (p = page) => {
    if (!selectedSD) { setLoading(false); setPackages([]); return; }
    setLoading(true);
    const params: Record<string, any> = {
      page: p, per_page: PER_PAGE,
    };
    if (direction === "envoi") {
      params.origin_stop_desk_id = selectedSD;
    } else {
      params.destination_stop_desk_id = selectedSD;
    }
    const apiStatus = resolveStatusParam(statusFilter);
    if (apiStatus) params.status = apiStatus;
    if (serviceFilter !== "all") params.service_type = serviceFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    if (wilayaFilter) params.destination_wilaya_id = wilayaFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (lateOnly) params.late_only = true;

    const res = await getPackages(params);
    if (res.success && res.data) {
      setPackages(res.data.data);
      setPage(res.data.current_page);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [statusFilter, serviceFilter, debouncedSearch, page, selectedSD, direction, wilayaFilter, dateFrom, dateTo, lateOnly, resolveStatusParam]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [statusFilter, serviceFilter, debouncedSearch, selectedSD, direction, wilayaFilter, dateFrom, dateTo, lateOnly]);
  useEffect(() => { if (sdLoaded.current) fetchPackages(page); }, [page, statusFilter, serviceFilter, debouncedSearch, selectedSD, direction, wilayaFilter, dateFrom, dateTo, lateOnly]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(() => fetchPackages(page), 30000);
    return () => clearInterval(iv);
  }, [fetchPackages, page]);

  // Refresh stats after any status change
  const refreshStats = () => {
    if (selectedSD) {
      const sdParam = direction === "envoi"
        ? { origin_stop_desk_id: selectedSD }
        : { destination_stop_desk_id: selectedSD };
      getPackageStats(sdParam).then(res => {
        if (res.success && res.data) setStats(res.data);
      });
    }
  };

  const handleStatusChange = async (id: number, status: PackageStatus, notes?: string): Promise<ApiResponse<Package>> => {
    const res = await updatePackageStatus(id, status, notes);
    if (res.success) {
      if (selectedPkg?.id === id) {
        const detail = await getPackage(id);
        if (detail.success && detail.data) setSelectedPkg(detail.data);
      }
      fetchPackages(page);
      refreshStats();
    }
    return res;
  };

  const handleBulkReady = () => {
    if (selected.size === 0) return;
    // Open call stepper for selected packages that need calling
    const selectedPkgs = packages.filter(p => selected.has(p.id) && CALLABLE_STATUSES.includes(p.status));
    if (selectedPkgs.length > 0) {
      setCallModalPkgs(selectedPkgs);
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const selectablePackages = packages.filter(p => CALLABLE_STATUSES.includes(p.status));
  const allSelected = selectablePackages.length > 0 && selectablePackages.every(p => selected.has(p.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectablePackages.map(p => p.id)));
  };

  // Active filter tags
  const activeFilters: { key: string; label: string }[] = [];
  if (statusFilter !== "all" && statusFilter !== "a_traiter") {
    const chipLabel = [...ENVOI_COLIS_STATUSES, ...RECEPTION_COLIS_STATUSES].find(c => c.value === statusFilter)?.label
      ?? STATUS_LABELS[statusFilter as PackageStatus] ?? statusFilter;
    activeFilters.push({ key: "status", label: `Statut: ${chipLabel}` });
  }
  if (serviceFilter !== "all") activeFilters.push({ key: "service", label: `Service: ${SERVICE_LABELS[serviceFilter] ?? serviceFilter}` });
  if (wilayaFilter) {
    const w = wilayas.find(w => w.id === wilayaFilter);
    activeFilters.push({ key: "wilaya", label: `Wilaya: ${w?.name ?? wilayaFilter}` });
  }
  if (dateFrom) activeFilters.push({ key: "dateFrom", label: `Du: ${dateFrom}` });
  if (dateTo) activeFilters.push({ key: "dateTo", label: `Au: ${dateTo}` });
  if (lateOnly) activeFilters.push({ key: "late", label: "En retard (>7j)" });
  if (debouncedSearch) activeFilters.push({ key: "search", label: `Recherche: "${debouncedSearch}"` });

  const handleClearFilter = (key: string) => {
    if (key === "status") setStatusFilter("all");
    if (key === "service") setServiceFilter("all");
    if (key === "wilaya") setWilayaFilter(null);
    if (key === "dateFrom") setDateFrom("");
    if (key === "dateTo") setDateTo("");
    if (key === "late") setLateOnly(false);
    if (key === "search") { setSearch(""); setDebouncedSearch(""); }
  };
  const handleClearAllFilters = () => {
    setStatusFilter("all"); setServiceFilter("all"); setWilayaFilter(null);
    setDateFrom(""); setDateTo(""); setLateOnly(false); setSearch(""); setDebouncedSearch("");
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: 11, fontWeight: 700,
    color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
    textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0,
    background: t.card, borderBottom: `1px solid ${t.border}`, zIndex: 2,
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: 13, color: t.text,
    borderBottom: `1px solid ${t.divider}`, whiteSpace: "nowrap",
  };

  return (
    <div style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(249,115,22,0.1)",
          }}>
            <Boxes size={20} style={{ color: "#f97316" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>Gestion des Colis</h1>
            <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>{total} colis au total</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selected.size > 0 && direction === "reception" && (
            <button
              onClick={handleBulkReady}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: "#f97316", color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <PhoneCall size={14} />
              Appeler & préparer ({selected.size})
            </button>
          )}
          <button
            onClick={() => { fetchPackages(page); refreshStats(); }}
            style={{
              width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: t.iconBg, border: `1px solid ${t.border}`, cursor: "pointer", color: t.textMuted,
            }}
            title="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* SD Context Selector */}
      <div style={{
        background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
        padding: 16, marginBottom: 14, boxShadow: t.shadow,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 260px", minWidth: 200 }}>
          <SDSelector
            stopDesks={stopDesks}
            value={selectedSD}
            onChange={setSelectedSD}
            disabled={isSDLocked(getStoredUser())}
          />
        </div>

        <div style={{
          display: "flex", borderRadius: 10, overflow: "hidden",
          border: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          {([
            { key: "envoi" as const, label: "Expéditeur", icon: <ArrowUpRight size={14} />, desc: "Colis que j'ai créés" },
            { key: "reception" as const, label: "Destinataire", icon: <ArrowDownLeft size={14} />, desc: "Colis reçus chez moi" },
          ]).map(tab => {
            const active = direction === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setDirection(tab.key)}
                title={tab.desc}
                style={{
                  padding: "8px 18px", fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 6,
                  background: active ? (tab.key === "envoi" ? "rgba(249,115,22,0.12)" : "rgba(59,130,246,0.12)") : "transparent",
                  color: active ? (tab.key === "envoi" ? "#ea580c" : "#2563eb") : t.textMuted,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  borderRight: tab.key === "envoi" ? `1px solid ${t.border}` : "none",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* No SD selected warning */}
      {!selectedSD && (
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 12, padding: "24px 20px", textAlign: "center", marginBottom: 18,
        }}>
          <Building2 size={28} style={{ color: "#d97706", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>
            Sélectionnez un Stop Desk
          </div>
          <div style={{ fontSize: 13, color: t.textMuted }}>
            Choisissez le stop desk depuis lequel vous travaillez pour voir les colis correspondants.
          </div>
        </div>
      )}

      {/* Content — only shown when SD is selected */}
      {selectedSD && (
        <>
          {/* Filters */}
          <div style={{
            background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
            padding: 18, marginBottom: 18, boxShadow: t.shadow,
          }}>
            {/* Search bar + service chips + toggle row */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={16} style={{
                  position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                  color: searchFocused ? "#f97316" : t.textFaint,
                  transition: "color 0.2s",
                }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Rechercher par tracking, nom, téléphone... (Ctrl+K)"
                  style={{
                    width: "100%", background: t.inp.bg,
                    border: `2px solid ${searchFocused ? "#f97316" : t.inp.border}`,
                    borderRadius: 10, padding: "10px 40px 10px 38px",
                    fontSize: 14, fontWeight: 500,
                    color: t.inp.text, outline: "none",
                    transition: "border-color 0.2s",
                  }}
                />
                {search ? (
                  <button
                    onClick={() => setSearch("")}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: t.iconBg, border: "none", cursor: "pointer", color: t.textMuted,
                      width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <X size={13} />
                  </button>
                ) : !searchFocused ? (
                  <span style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    fontSize: 10, fontWeight: 600, color: t.textFaint,
                    background: t.iconBg, padding: "2px 7px", borderRadius: 5,
                    border: `1px solid ${t.border}`,
                  }}>
                    Ctrl+K
                  </span>
                ) : null}
              </div>

              {/* Filters toggle */}
              {(() => {
                const advCount = (wilayaFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (lateOnly ? 1 : 0) + (serviceFilter !== "all" ? 1 : 0);
                return (
                  <button
                    onClick={() => setFiltersOpen(o => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                      padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: filtersOpen || advCount > 0 ? t.chipActive.bg : t.iconBg,
                      color: filtersOpen || advCount > 0 ? t.chipActive.text : t.textMuted,
                      border: `1px solid ${filtersOpen || advCount > 0 ? t.chipActive.border + "44" : t.border}`,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    <Search size={14} />
                    Filtres
                    {advCount > 0 && (
                      <span style={{
                        width: 18, height: 18, borderRadius: 999, fontSize: 10, fontWeight: 800,
                        background: t.chipActive.text, color: "#fff",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {advCount}
                      </span>
                    )}
                    <ChevronDown size={13} style={{
                      transition: "transform 0.2s",
                      transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }} />
                  </button>
                );
              })()}
            </div>

            {/* Pipeline bar (always visible) */}
            <PipelineBar
              chips={direction === "envoi" ? ENVOI_COLIS_STATUSES : RECEPTION_COLIS_STATUSES}
              statusFilter={statusFilter}
              onFilter={setStatusFilter}
              t={t}
            />

            {/* Expandable filters panel */}
            {filtersOpen && (
              <div style={{
                borderTop: `1px solid ${t.divider}`, paddingTop: 14, marginTop: 4,
                display: "flex", flexDirection: "column", gap: 12,
                animation: "filterSlide 0.2s ease-out",
              }}>
                {/* Service chips */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Service</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ALL_SERVICES.map(s => (
                      <Chip
                        key={s.value}
                        active={serviceFilter === s.value}
                        label={s.label}
                        color={s.value !== "all" ? SERVICE_COLORS[s.value as ServiceType] : undefined}
                        onClick={() => setServiceFilter(s.value as ServiceType | "all")}
                        t={t}
                      />
                    ))}
                  </div>
                </div>

                {/* Wilaya + Date + Late row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  {/* Wilaya dropdown */}
                  <div style={{ position: "relative", minWidth: 180 }}>
                    <select
                      value={wilayaFilter ?? ""}
                      onChange={e => setWilayaFilter(e.target.value ? Number(e.target.value) : null)}
                      style={{
                        width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                        borderRadius: 8, padding: "7px 28px 7px 10px", fontSize: 12, fontWeight: 600,
                        color: t.inp.text, outline: "none", cursor: "pointer",
                        appearance: "none" as const,
                      }}
                    >
                      <option value="">Toutes les wilayas</option>
                      {wilayas.map(w => (
                        <option key={w.id} value={w.id}>{w.code ? `${w.code} - ` : ""}{w.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: t.textFaint, pointerEvents: "none" }} />
                  </div>

                  {/* Date range */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={13} style={{ color: t.textFaint, flexShrink: 0 }} />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      style={{
                        background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                        borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600,
                        color: t.inp.text, outline: "none",
                      }}
                    />
                    <span style={{ fontSize: 12, color: t.textFaint }}>—</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      style={{
                        background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                        borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600,
                        color: t.inp.text, outline: "none",
                      }}
                    />
                  </div>

                  {/* Late toggle */}
                  <Chip
                    active={lateOnly}
                    label="En retard (>7j)"
                    onClick={() => setLateOnly(!lateOnly)}
                    t={t}
                    color={lateOnly ? { bg: "rgba(245,158,11,0.15)", text: "#d97706", dot: "#f59e0b" } : undefined}
                    icon={<AlertTriangle size={12} />}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Active filter tags */}
          <ActiveFilterTags
            filters={activeFilters}
            onClear={handleClearFilter}
            onClearAll={handleClearAllFilters}
            t={t}
          />

          {/* Table */}
          <div style={{
            background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
            boxShadow: t.shadow, overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 540px)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 36, textAlign: "center" }}>
                      {selectablePackages.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          style={{ cursor: "pointer" }}
                        />
                      )}
                    </th>
                    <th style={thStyle}># Tracking</th>
                    <th style={thStyle}>Expéditeur</th>
                    <th style={thStyle}>Destinataire</th>
                    <th style={thStyle}>Wilaya</th>
                    <th style={thStyle}>Service</th>
                    <th style={thStyle}>Statut</th>
                    <th style={{ ...thStyle, width: 40, textAlign: "center" }}></th>
                    <th style={{ ...thStyle, textAlign: "right" }}>COD</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Livraison</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} style={{ ...tdStyle, textAlign: "center", padding: 48 }}>
                        <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: t.textMuted, margin: "0 auto" }} />
                      </td>
                    </tr>
                  ) : packages.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ ...tdStyle, textAlign: "center", padding: 48, color: t.textMuted }}>
                        Aucun colis trouvé
                      </td>
                    </tr>
                  ) : (
                    packages.map(pkg => {
                      const isSelectable = CALLABLE_STATUSES.includes(pkg.status);
                      return (
                        <tr
                          key={pkg.id}
                          style={{ cursor: "pointer", transition: "background 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ ...tdStyle, textAlign: "center", width: 36 }}>
                            {isSelectable && (
                              <input
                                type="checkbox"
                                checked={selected.has(pkg.id)}
                                onChange={() => toggleSelect(pkg.id)}
                                onClick={e => e.stopPropagation()}
                                style={{ cursor: "pointer" }}
                              />
                            )}
                          </td>
                          <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }} onClick={() => setSelectedPkg(pkg)}>
                            {pkg.tracking_number}
                            {pkg.tracking_number.startsWith("ECH-") && pkg.content_description?.match(/réf: (DLV-[\w-]+)/)?.[1] && (
                              <div style={{ fontSize: 9, color: "#9ca3af", fontFamily: "sans-serif", fontWeight: 500, marginTop: 2 }}>
                                ← {pkg.content_description.match(/réf: (DLV-[\w-]+)/)?.[1]}
                              </div>
                            )}
                            {pkg.service_type === "echange" && !pkg.tracking_number.startsWith("ECH-") && (
                              <div style={{ fontSize: 9, color: "#7c3aed", fontFamily: "sans-serif", fontWeight: 600, marginTop: 2 }}>
                                ÉCHANGE
                              </div>
                            )}
                          </td>
                          <td style={tdStyle} onClick={() => setSelectedPkg(pkg)}>
                            <div style={{ fontWeight: 600 }}>{pkg.sender_name}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{pkg.sender_phone}</div>
                          </td>
                          <td style={tdStyle} onClick={() => setSelectedPkg(pkg)}>
                            <div style={{ fontWeight: 600 }}>{pkg.recipient_name}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{pkg.recipient_phone}</div>
                          </td>
                          <td style={{ ...tdStyle, color: t.textSub }} onClick={() => setSelectedPkg(pkg)}>
                            {pkg.recipient_wilaya?.name ?? "—"}
                          </td>
                          <td style={tdStyle} onClick={() => setSelectedPkg(pkg)}>
                            <ServiceBadge type={pkg.service_type} />
                          </td>
                          <td style={tdStyle} onClick={() => setSelectedPkg(pkg)}>
                            <StatusBadge status={pkg.status} />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", width: 40 }}>
                            {direction === "reception" && CALLABLE_STATUSES.includes(pkg.status) && (
                              <button
                                onClick={e => { e.stopPropagation(); setCallModalPkgs([pkg]); }}
                                title="Appeler le destinataire"
                                style={{
                                  width: 28, height: 28, borderRadius: 7, display: "inline-flex",
                                  alignItems: "center", justifyContent: "center",
                                  background: pkg.last_call_status === "joint" ? "rgba(34,197,94,0.12)"
                                    : pkg.call_attempts >= echecThreshold ? "rgba(239,68,68,0.12)"
                                    : "rgba(6,182,212,0.1)",
                                  border: pkg.call_attempts >= echecThreshold ? "1px solid rgba(239,68,68,0.3)" : "none",
                                  cursor: "pointer",
                                  color: pkg.last_call_status === "joint" ? "#16a34a"
                                    : pkg.call_attempts >= echecThreshold ? "#ef4444"
                                    : "#0891b2",
                                  position: "relative",
                                }}
                              >
                                <PhoneCall size={14} />
                                {pkg.call_attempts > 0 && (
                                  <span style={{
                                    position: "absolute", top: -4, right: -4,
                                    width: 14, height: 14, borderRadius: 999, fontSize: 8, fontWeight: 800,
                                    background: CALL_BUTTONS.find(b => b.outcome === pkg.last_call_status)?.color ?? "#6b7280",
                                    color: "#fff",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}>
                                    {pkg.call_attempts}
                                  </span>
                                )}
                              </button>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }} onClick={() => setSelectedPkg(pkg)}>
                            {formatDA(pkg.cod_amount)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", color: t.textSub }} onClick={() => setSelectedPkg(pkg)}>
                            {formatDA(pkg.shipping_cost)}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: t.textMuted }} onClick={() => setSelectedPkg(pkg)}>
                            {formatDate(pkg.created_at)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", width: pkg.service_type === "echange" ? 70 : 36 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                              <button
                                onClick={e => { e.stopPropagation(); setLabelPkg(pkg); }}
                                title="Imprimer l'étiquette"
                                style={{
                                  width: 26, height: 26, borderRadius: 6, display: "inline-flex",
                                  alignItems: "center", justifyContent: "center",
                                  background: "transparent", border: "none", cursor: "pointer",
                                  color: t.textFaint,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                                onMouseLeave={e => (e.currentTarget.style.color = t.textFaint)}
                              >
                                <Printer size={14} />
                              </button>
                              {pkg.service_type === "echange" && (
                                <button
                                  onClick={async e => {
                                    e.stopPropagation();
                                    // Find ECH return by searching
                                    const res = await api<any>(`/packages?search=ECH-&per_page=50`);
                                    if (res.success && res.data?.data) {
                                      const echPkg = res.data.data.find((p: any) =>
                                        p.tracking_number?.startsWith("ECH-") &&
                                        p.content_description?.includes(pkg.tracking_number)
                                      );
                                      if (echPkg) setLabelPkg(echPkg);
                                      else alert("Étiquette échange non trouvée. Le sac n'a peut-être pas encore été déballé.");
                                    }
                                  }}
                                  title="Imprimer étiquette échange retour"
                                  style={{
                                    height: 22, borderRadius: 5, display: "inline-flex",
                                    alignItems: "center", gap: 3, padding: "0 6px",
                                    background: "rgba(139,92,246,0.08)", border: "none", cursor: "pointer",
                                    color: "#7c3aed", fontSize: 9, fontWeight: 700,
                                  }}
                                >
                                  <Printer size={10} /> ECH
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px", borderTop: `1px solid ${t.border}`,
              }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>Page {page} sur {lastPage}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    style={{
                      width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                      background: t.iconBg, border: `1px solid ${t.border}`, cursor: page <= 1 ? "default" : "pointer",
                      color: page <= 1 ? t.textFaint : t.textSub, opacity: page <= 1 ? 0.5 : 1,
                    }}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                    disabled={page >= lastPage}
                    style={{
                      width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                      background: t.iconBg, border: `1px solid ${t.border}`, cursor: page >= lastPage ? "default" : "pointer",
                      color: page >= lastPage ? t.textFaint : t.textSub, opacity: page >= lastPage ? 0.5 : 1,
                    }}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail modal */}
      {selectedPkg && (
        <DetailModal
          pkg={selectedPkg}
          t={t}
          onClose={() => setSelectedPkg(null)}
          onStatusChange={handleStatusChange}
          onRefresh={() => fetchPackages(page)}
        />
      )}

      {/* Call modal (single or stepper) */}
      {labelPkg && <PackageLabel pkg={labelPkg} onClose={() => setLabelPkg(null)} />}

      {callModalPkgs.length > 0 && (
        <CallModal
          packages={callModalPkgs}
          t={t}
          onClose={() => { setCallModalPkgs([]); setSelected(new Set()); }}
          onCallRecorded={() => { fetchPackages(page); refreshStats(); }}
          echecThreshold={echecThreshold}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes filterSlide { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
