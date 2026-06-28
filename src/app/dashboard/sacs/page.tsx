"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive, RefreshCw, Search, X, ChevronLeft, ChevronRight,
  Loader2, Package2, MapPin, Truck, User, Clock, Plus,
  Lock, Send, PackageOpen, XCircle, ScanLine, Trash2,
  ArrowRight, ArrowLeft, ChevronDown, Building2, ArrowUpRight, ArrowDownLeft,
  Eye, Pencil, MoreVertical, AlertTriangle, Check, CheckCircle2,
} from "lucide-react";
import {
  getBags, getBag, createBag, addPackageToBag, removePackageFromBag,
  sealBag, startBagTransit, receiveBag, unpackBag, cancelBag,
  updateBag, deleteBag,
  type Bag, type BagType, type BagStatus, type PaginatedBags, type BagScanLog,
  BAG_STATUS_LABELS, BAG_STATUS_COLORS, BAG_TYPE_LABELS, BAG_TYPE_COLORS,
} from "@/lib/bags";
import {
  type Package, STATUS_LABELS, STATUS_COLORS, type PackageStatus,
} from "@/lib/packages";
import { api, getStoredUser, isSDLocked, getLockedSDId } from "@/lib/api";
import SDSelector from "@/components/SDSelector";

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
    bg:        "#0e1017",
    card:      "#111827",
    border:    "#1e2130",
    divider:   "#1e2130",
    rowHover:  "#1a1f2e",
    text:      "#f0f0f5",
    textSub:   "#d1d5db",
    textMuted: "#6b7280",
    textFaint: "#4b5563",
    shadow:    "none",
    modalBg:   "#111827",
    overlay:   "rgba(0,0,0,0.6)",
    inp:       { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    chipActive:  { bg: "rgba(249,115,22,0.15)", text: "#fb923c", border: "#f97316" },
    chipDefault: { bg: "#1e2130", text: "#6b7280", border: "#2a3145" },
    iconBg:    "rgba(255,255,255,0.07)",
    danger:    { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", text: "#ef4444" },
    success:   { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", text: "#22c55e" },
  } : {
    bg:        "#ffffff",
    card:      "#ffffff",
    border:    "#e5e7eb",
    divider:   "#f3f4f6",
    rowHover:  "#f9fafb",
    text:      "#111827",
    textSub:   "#374151",
    textMuted: "#6b7280",
    textFaint: "#9ca3af",
    shadow:    "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    modalBg:   "#ffffff",
    overlay:   "rgba(0,0,0,0.35)",
    inp:       { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    chipActive:  { bg: "rgba(249,115,22,0.1)", text: "#ea580c", border: "#f97316" },
    chipDefault: { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" },
    iconBg:    "#f3f4f6",
    danger:    { bg: "rgba(239,68,68,0.05)", border: "rgba(239,68,68,0.15)", text: "#dc2626" },
    success:   { bg: "rgba(34,197,94,0.05)", border: "rgba(34,197,94,0.15)", text: "#16a34a" },
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── types ────────────────────────────────────────────────── */
interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  commune_id: number;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

type Direction = "envoi" | "passage" | "reception";

const SD_LS_KEY = "sacs_selected_sd";
const AUTO_UNPACK_LS_KEY = "sacs_auto_unpack";
const AUTO_SCAN_DELAY = 600; // ms after last keystroke

/* ── tracking format validators ──────────────────────────── */
// Package: DLV-YYYYMMDD-XXXXXX
const isValidPackageTracking = (v: string) => /^DLV-\d{8}-[A-Z0-9]{6}$/i.test(v.trim());
// Bag: SAC-YYYYMMDD-XXXX
const isValidBagTracking = (v: string) => /^SAC-\d{8}-[A-Z0-9]{4}$/i.test(v.trim());

/* ── helpers ──────────────────────────────────────────────── */
const PER_PAGE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* Virtual filter values map to comma-separated API statuses */
type StatusFilterValue = BagStatus | "all" | "actifs" | "historique" | "a_traiter" | "passage";

interface StatusChip {
  value: StatusFilterValue;
  label: string;
  /** Comma-separated API statuses this chip resolves to (undefined = no filter) */
  apiStatuses?: string;
}

const ENVOI_STATUSES: StatusChip[] = [
  { value: "actifs",     label: "Actifs",     apiStatuses: "cree,scelle" },
  { value: "cree",       label: "Créé",       apiStatuses: "cree" },
  { value: "scelle",     label: "Scellé",     apiStatuses: "scelle" },
  { value: "en_transit", label: "En transit",  apiStatuses: "en_transit" },
  { value: "historique", label: "Historique",  apiStatuses: "recu,deballe,annule" },
  { value: "all",        label: "Tous" },
];

const PASSAGE_STATUSES: StatusChip[] = [
  { value: "passage",    label: "Tous",        apiStatuses: "passage" },
];

const RECEPTION_STATUSES: StatusChip[] = [
  { value: "a_traiter",  label: "À traiter",   apiStatuses: "en_transit,recu" },
  { value: "en_transit",  label: "En transit",  apiStatuses: "en_transit" },
  { value: "recu",        label: "Reçu",        apiStatuses: "recu" },
  { value: "deballe",     label: "Déballé",     apiStatuses: "deballe" },
  { value: "all",         label: "Tous" },
];

/** Pipeline stage definitions for count display */
const ENVOI_PIPELINE: { label: string; status: string; color: string }[] = [
  { label: "Créés",      status: "cree",                  color: "#6b7280" },
  { label: "Scellés",    status: "scelle",                color: "#f59e0b" },
  { label: "En transit", status: "en_transit",             color: "#3b82f6" },
  { label: "Historique", status: "recu,deballe,annule",    color: "#6b7280" },
];

const PASSAGE_PIPELINE: { label: string; status: string; color: string }[] = [
  { label: "En passage", status: "passage",  color: "#f97316" },
];

const RECEPTION_PIPELINE: { label: string; status: string; color: string }[] = [
  { label: "En transit", status: "en_transit",  color: "#3b82f6" },
  { label: "Reçus",      status: "recu",        color: "#8b5cf6" },
  { label: "Déballés",   status: "deballe",     color: "#10b981" },
];

const ALL_TYPES: { value: BagType | "all"; label: string }[] = [
  { value: "all",    label: "Tous" },
  { value: "aller",  label: "Aller" },
  { value: "retour", label: "Retour" },
];

/* ── inline badge components ────────────────────────────── */
function BagStatusBadge({ status }: { status: BagStatus }) {
  const c = BAG_STATUS_COLORS[status] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {BAG_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Compact destination display: Wilaya + SD detail */
function DestLabel({ bag, size = "sm" }: { bag: Bag; size?: "sm" | "md" }) {
  const w = bag.destination_wilaya?.name;
  const sd = bag.destination_stop_desk;
  const commune = sd?.commune?.name;
  const isMd = size === "md";

  if (!sd) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <MapPin size={isMd ? 13 : 11} style={{ color: "#f97316", flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: isMd ? 14 : 13 }}>{w ?? "—"}</span>
      </span>
    );
  }

  const sub = commune && commune !== sd.name ? `${commune} · ${sd.name}` : sd.name;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: isMd ? 26 : 22, height: isMd ? 26 : 22, borderRadius: 6,
        background: "rgba(249,115,22,0.1)", display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <MapPin size={isMd ? 13 : 11} style={{ color: "#f97316" }} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: isMd ? 14 : 12.5, whiteSpace: "nowrap" }}>{w}</span>
        <span style={{
          fontSize: isMd ? 12 : 10.5, fontWeight: 500,
          color: "#8b5cf6", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {sub}
        </span>
      </span>
    </span>
  );
}

function BagTypeBadge({ type }: { type: BagType }) {
  const c = BAG_TYPE_COLORS[type] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>
      {type === "aller" ? <ArrowRight size={11} /> : <ArrowLeft size={11} />}
      {BAG_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function PkgStatusBadge({ status }: { status: PackageStatus }) {
  const c = STATUS_COLORS[status] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Chip({ active, label, color, onClick, t }: {
  active: boolean; label: string; color?: { bg: string; text: string; dot?: string };
  onClick: () => void; t: Tokens;
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
      {dotColor && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />}
      {label}
    </button>
  );
}

/* ── Toast notification ─────────────────────────────────── */
function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);
  const isSuccess = type === "success";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 99999,
      padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600,
      background: isSuccess ? "#059669" : "#dc2626", color: "#fff",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", gap: 8,
      animation: "toastIn 0.25s ease-out",
    }}>
      {isSuccess ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {message}
    </div>
  );
}

/* ── Row Actions Dropdown ────────────────────────────────── */
function RowActions({
  bag, t, onView, onEdit, onDelete,
}: {
  bag: Bag; t: Tokens;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const canEdit = bag.status === "cree";
  const canDelete = bag.status === "cree" || bag.status === "annule";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open); }}
        style={{
          width: 30, height: 30, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: open ? t.iconBg : "transparent", border: "none",
          cursor: "pointer", color: t.textMuted, transition: "all 0.15s",
        }}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "100%", marginTop: 4,
            background: t.modalBg, borderRadius: 10,
            border: `1px solid ${t.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            minWidth: 160, zIndex: 100, overflow: "hidden",
          }}
        >
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); onView(); }}
            style={{
              width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 600,
              color: t.text, background: "transparent", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              textAlign: "left",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = t.rowHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <Eye size={14} style={{ color: t.textMuted }} />
            Voir détails
          </button>
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); onEdit(); }}
              style={{
                width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 600,
                color: t.text, background: "transparent", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = t.rowHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Pencil size={14} style={{ color: t.textMuted }} />
              Modifier
            </button>
          )}
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}
              style={{
                width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 600,
                color: "#dc2626", background: "transparent", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Create Bag Modal (2-step: details → scan, no bag created until finish) ── */
function CreateBagModal({
  t, onClose, onCreated, prefillOriginSD,
}: {
  t: Tokens; onClose: () => void; onCreated: () => void; prefillOriginSD?: number;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: bag config
  const [bagType, setBagType] = useState<BagType>("aller");
  const [originStopDeskId, setOriginStopDeskId] = useState<number | "">(prefillOriginSD ?? "");
  const [destinationWilayaId, setDestinationWilayaId] = useState<number | "">("");
  const [destinationSDId, setDestinationSDId] = useState<number | "">("");
  const [stopDesks, setStopDesks] = useState<{ id: number; name: string; commune_id: number; commune?: { wilaya_id: number } }[]>([]);
  const [wilayas, setWilayas] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState("");

  // Step 2: buffered scans (client-side only, no bag exists yet)
  const [bufferedTrackings, setBufferedTrackings] = useState<string[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    api<{ id: number; name: string; commune_id: number; commune?: { wilaya_id: number } }[]>("/stop-desks").then(res => {
      if (res.success && res.data) setStopDesks(res.data);
    });
    api<{ id: number; name: string }[]>("/wilayas").then(res => {
      if (res.success && res.data) setWilayas(res.data);
    });
  }, []);

  // Filter destination SDs by selected wilaya
  const destSDOptions = destinationWilayaId
    ? stopDesks.filter(sd => sd.commune?.wilaya_id === destinationWilayaId)
    : [];

  // Reset destination SD when wilaya changes
  useEffect(() => {
    setDestinationSDId("");
  }, [destinationWilayaId]);

  useEffect(() => {
    if (step === 2 && scanRef.current) scanRef.current.focus();
  }, [step]);

  // Auto-scan: trigger when input matches package tracking format
  useEffect(() => {
    if (!scanInput.trim() || step !== 2) return;
    if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    if (isValidPackageTracking(scanInput)) {
      autoScanTimerRef.current = setTimeout(() => { handleAddTracking(); }, AUTO_SCAN_DELAY);
    }
    return () => { if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanInput, step]);

  // Step 1 → 2: just validate form, don't create yet
  const handleNext = () => {
    if (!originStopDeskId || !destinationWilayaId) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setError("");
    setStep(2);
  };

  // Buffer a tracking number (client-side dedup)
  const handleAddTracking = () => {
    const tn = scanInput.trim().toUpperCase();
    if (!tn) return;
    if (bufferedTrackings.includes(tn)) {
      setScanError("Ce tracking est déjà dans la liste.");
      return;
    }
    setScanError("");
    setBufferedTrackings(prev => [...prev, tn]);
    setScanInput("");
    scanRef.current?.focus();
  };

  const handleRemoveTracking = (tn: string) => {
    setBufferedTrackings(prev => prev.filter(t => t !== tn));
  };

  // Final submit: create bag then add all packages
  const handleFinish = async () => {
    if (bufferedTrackings.length === 0) return;
    setSubmitting(true);
    setError("");

    // 1. Create the bag
    const bagRes = await createBag({
      type: bagType,
      origin_stop_desk_id: originStopDeskId as number,
      destination_wilaya_id: destinationWilayaId as number,
      destination_stop_desk_id: destinationSDId ? (destinationSDId as number) : null,
    });

    if (!bagRes.success || !bagRes.data) {
      setError(bagRes.message || "Erreur lors de la création du sac.");
      setSubmitting(false);
      return;
    }

    const newBag = bagRes.data;

    // 2. Add all packages sequentially
    const errors: string[] = [];
    for (const tn of bufferedTrackings) {
      const res = await addPackageToBag(newBag.id, tn);
      if (!res.success) {
        errors.push(`${tn}: ${res.message || "Erreur"}`);
      }
    }

    // 3. If ALL failed, cancel the bag
    if (errors.length === bufferedTrackings.length) {
      await cancelBag(newBag.id);
      setError("Aucun colis n'a pu être ajouté. Sac annulé.\n" + errors.join("\n"));
      setSubmitting(false);
      return;
    }

    // 4. If some failed, show partial warning but keep bag
    if (errors.length > 0) {
      setError(`${bufferedTrackings.length - errors.length} colis ajouté(s), ${errors.length} erreur(s):\n${errors.join("\n")}`);
    }

    setSubmitting(false);
    onCreated();
    if (errors.length === 0) onClose();
  };

  const typeCardStyle = (selected: boolean): React.CSSProperties => ({
    flex: 1, padding: "16px 14px", borderRadius: 12, cursor: "pointer",
    border: `2px solid ${selected ? "#f97316" : t.border}`,
    background: selected ? "rgba(249,115,22,0.06)" : t.card,
    textAlign: "center", transition: "all 0.15s",
  });

  const selectStyle: React.CSSProperties = {
    width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 8, padding: "9px 12px", fontSize: 13,
    color: t.inp.text, outline: "none", cursor: "pointer",
    appearance: "none" as const,
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
          width: "100%", maxWidth: step === 1 ? 480 : 580,
          maxHeight: "90vh", overflowY: "auto",
          padding: 24, transition: "max-width 0.2s",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: t.text, margin: 0 }}>
              {step === 1 ? "Nouveau Sac" : "Ajouter les Colis"}
            </h2>
            <span style={{
              padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: "rgba(249,115,22,0.1)", color: "#ea580c",
            }}>
              Étape {step}/2
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: "pointer", color: t.textMuted,
          }}>
            <X size={18} />
          </button>
        </div>

        {step === 1 ? (
          <>
            {/* Type selector */}
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              Type de sac
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <div onClick={() => setBagType("aller")} style={typeCardStyle(bagType === "aller")}>
                <ArrowRight size={20} style={{ color: bagType === "aller" ? "#f97316" : t.textMuted, margin: "0 auto 6px" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: bagType === "aller" ? t.text : t.textSub }}>Aller</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Vers destination</div>
              </div>
              <div onClick={() => setBagType("retour")} style={typeCardStyle(bagType === "retour")}>
                <ArrowLeft size={20} style={{ color: bagType === "retour" ? "#f97316" : t.textMuted, margin: "0 auto 6px" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: bagType === "retour" ? t.text : t.textSub }}>Retour</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Retour expéditeur</div>
              </div>
            </div>

            {/* Origin Stop Desk */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Stop Desk Origine
              </div>
              <div style={{ position: "relative" }}>
                <select value={originStopDeskId} onChange={e => setOriginStopDeskId(e.target.value ? Number(e.target.value) : "")} style={selectStyle}>
                  <option value="">Sélectionner un stop desk...</option>
                  {stopDesks.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint, pointerEvents: "none" }} />
              </div>
            </div>

            {/* Destination Wilaya */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Wilaya Destination
              </div>
              <div style={{ position: "relative" }}>
                <select value={destinationWilayaId} onChange={e => setDestinationWilayaId(e.target.value ? Number(e.target.value) : "")} style={selectStyle}>
                  <option value="">Sélectionner une wilaya...</option>
                  {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint, pointerEvents: "none" }} />
              </div>
            </div>

            {/* Destination Stop Desk */}
            {destinationWilayaId && destSDOptions.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  Stop Desk Destination
                </div>
                <div style={{ position: "relative" }}>
                  <select value={destinationSDId} onChange={e => setDestinationSDId(e.target.value ? Number(e.target.value) : "")} style={selectStyle}>
                    <option value="">Hub principal (wilaya)</option>
                    {destSDOptions.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint, pointerEvents: "none" }} />
                </div>
                <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>
                  Sélectionnez le SD exact pour un routage précis dans la hiérarchie.
                </div>
              </div>
            )}

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, background: "rgba(239,68,68,0.1)", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button onClick={handleNext} style={{
              width: "100%", padding: "11px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: "#f97316", color: "#fff", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s",
            }}>
              <ArrowRight size={16} />
              Suivant — Scanner les colis
            </button>
          </>
        ) : (
          <>
            {/* Step 2: Scan tracking numbers (buffered client-side) */}
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 16,
              background: t.iconBg, border: `1px solid ${t.border}`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Archive size={16} style={{ color: "#f97316", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                {BAG_TYPE_LABELS[bagType]} · {wilayas.find(w => w.id === destinationWilayaId)?.name ?? ""}
              </span>
              <button onClick={() => setStep(1)} style={{
                marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#f97316",
                background: "transparent", border: "none", cursor: "pointer",
              }}>
                Modifier
              </button>
            </div>

            {/* Scan input */}
            <div style={{
              padding: "14px 16px", borderRadius: 10, marginBottom: 14,
              background: t.iconBg, border: `1px solid ${t.border}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <ScanLine size={13} /> Scanner les colis
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={scanRef}
                  value={scanInput}
                  onChange={e => { setScanInput(e.target.value); setScanError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current); handleAddTracking(); } }}
                  placeholder="Numéro de tracking..."
                  style={{
                    flex: 1, background: t.inp.bg,
                    border: `2px solid ${t.inp.border}`,
                    borderRadius: 8, padding: "9px 12px", fontSize: 13,
                    color: t.inp.text, outline: "none", fontFamily: "monospace",
                  }}
                />
                <button
                  onClick={handleAddTracking}
                  disabled={!scanInput.trim()}
                  style={{
                    padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: "#f97316", color: "#fff", border: "none",
                    cursor: !scanInput.trim() ? "default" : "pointer",
                    opacity: !scanInput.trim() ? 0.5 : 1,
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Plus size={14} />
                  Ajouter
                </button>
              </div>
              {scanError && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#dc2626", fontSize: 12, fontWeight: 600 }}>
                  {scanError}
                </div>
              )}
            </div>

            {/* Buffered list */}
            <div style={{
              padding: "14px 16px", borderRadius: 10, marginBottom: 14,
              border: `1px solid ${t.border}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Package2 size={13} /> Colis à ajouter ({bufferedTrackings.length})
              </div>
              {bufferedTrackings.length === 0 ? (
                <div style={{
                  fontSize: 13, color: t.textMuted, textAlign: "center", padding: "18px 0",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                }}>
                  <ScanLine size={28} style={{ color: t.textFaint, opacity: 0.5 }} />
                  <div>Scannez au moins <strong style={{ color: "#ea580c" }}>1 colis</strong> pour créer le sac</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {bufferedTrackings.map(tn => (
                    <div key={tn} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "5px 8px 5px 12px", borderRadius: 8,
                      background: t.iconBg, border: `1px solid ${t.border}`,
                      fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: t.text,
                    }}>
                      {tn}
                      <button
                        onClick={() => handleRemoveTracking(tn)}
                        style={{
                          width: 18, height: 18, borderRadius: 4,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(239,68,68,0.1)", border: "none",
                          cursor: "pointer", color: "#dc2626",
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: 8, marginBottom: 14,
                background: "rgba(239,68,68,0.1)", color: "#dc2626", fontSize: 13, fontWeight: 600,
                whiteSpace: "pre-line",
              }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{
                padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: t.chipDefault.bg, color: t.textMuted,
                border: `1px solid ${t.border}`, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <XCircle size={14} />
                Annuler
              </button>
              <button
                onClick={handleFinish}
                disabled={bufferedTrackings.length === 0 || submitting}
                style={{
                  flex: 1, padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: bufferedTrackings.length === 0 || submitting ? t.chipDefault.bg : "#f97316",
                  color: bufferedTrackings.length === 0 || submitting ? t.textMuted : "#fff",
                  border: "none",
                  cursor: bufferedTrackings.length === 0 || submitting ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {submitting
                  ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  : <Check size={16} />
                }
                {submitting ? "Création..." : `Créer le Sac (${bufferedTrackings.length} colis)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Edit Bag Modal ─────────────────────────────────────── */
function EditBagModal({
  bag, t, onClose, onUpdated,
}: {
  bag: Bag; t: Tokens; onClose: () => void; onUpdated: () => void;
}) {
  const [bagType, setBagType] = useState<BagType>(bag.type);
  const [destinationWilayaId, setDestinationWilayaId] = useState<number>(bag.destination_wilaya_id);
  const [wilayas, setWilayas] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ id: number; name: string }[]>("/wilayas").then(res => {
      if (res.success && res.data) setWilayas(res.data);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const res = await updateBag(bag.id, {
      type: bagType,
      destination_wilaya_id: destinationWilayaId,
    });
    if (res.success) {
      onUpdated();
      onClose();
    } else {
      setError(res.message || "Erreur lors de la modification.");
    }
    setSaving(false);
  };

  const typeCardStyle = (selected: boolean): React.CSSProperties => ({
    flex: 1, padding: "14px 12px", borderRadius: 10, cursor: "pointer",
    border: `2px solid ${selected ? "#f97316" : t.border}`,
    background: selected ? "rgba(249,115,22,0.06)" : t.card,
    textAlign: "center", transition: "all 0.15s",
  });

  const selectStyle: React.CSSProperties = {
    width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 8, padding: "9px 12px", fontSize: 13,
    color: t.inp.text, outline: "none", cursor: "pointer",
    appearance: "none" as const,
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: t.overlay, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, borderRadius: 16, border: `1px solid ${t.border}`,
        width: "100%", maxWidth: 440, padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: t.text, margin: 0 }}>
            Modifier le Sac
          </h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: "pointer", color: t.textMuted,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tracking badge */}
        <div style={{
          padding: "8px 14px", borderRadius: 8, marginBottom: 16,
          background: t.iconBg, border: `1px solid ${t.border}`,
          fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: t.text,
          textAlign: "center",
        }}>
          {bag.tracking_number}
        </div>

        {/* Type */}
        <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
          Type de sac
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div onClick={() => setBagType("aller")} style={typeCardStyle(bagType === "aller")}>
            <ArrowRight size={18} style={{ color: bagType === "aller" ? "#f97316" : t.textMuted, margin: "0 auto 4px" }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: bagType === "aller" ? t.text : t.textSub }}>Aller</div>
          </div>
          <div onClick={() => setBagType("retour")} style={typeCardStyle(bagType === "retour")}>
            <ArrowLeft size={18} style={{ color: bagType === "retour" ? "#f97316" : t.textMuted, margin: "0 auto 4px" }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: bagType === "retour" ? t.text : t.textSub }}>Retour</div>
          </div>
        </div>

        {/* Wilaya */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
            Wilaya Destination
          </div>
          <div style={{ position: "relative" }}>
            <select value={destinationWilayaId} onChange={e => setDestinationWilayaId(Number(e.target.value))} style={selectStyle}>
              {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint, pointerEvents: "none" }} />
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, background: "rgba(239,68,68,0.1)", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: t.chipDefault.bg, color: t.textMuted,
            border: `1px solid ${t.border}`, cursor: "pointer",
          }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
            background: saving ? t.chipDefault.bg : "#f97316", color: saving ? t.textMuted : "#fff",
            border: "none", cursor: saving ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ───────────────────────────────── */
function DeleteConfirmModal({
  bag, t, onClose, onDeleted,
}: {
  bag: Bag; t: Tokens; onClose: () => void; onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteBag(bag.id);
    if (res.success) {
      onDeleted();
      onClose();
    } else {
      setError(res.message || "Erreur lors de la suppression.");
    }
    setDeleting(false);
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: t.overlay, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, borderRadius: 16, border: `1px solid ${t.danger.border}`,
        width: "100%", maxWidth: 420, padding: 24,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: "0 auto 16px",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: t.danger.bg,
        }}>
          <AlertTriangle size={24} style={{ color: t.danger.text }} />
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 800, color: t.text, margin: "0 0 8px", textAlign: "center" }}>
          Supprimer ce sac ?
        </h2>
        <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 6px", textAlign: "center" }}>
          Le sac <strong style={{ fontFamily: "monospace", color: t.text }}>{bag.tracking_number}</strong> sera supprimé définitivement.
        </p>
        {bag.packages_count > 0 && (
          <p style={{ fontSize: 12, color: t.danger.text, margin: "0 0 6px", textAlign: "center", fontWeight: 600 }}>
            Les {bag.packages_count} colis seront libérés et reviendront au statut "Accepté opérateur".
          </p>
        )}

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 8, marginTop: 12, background: "rgba(239,68,68,0.1)", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: t.chipDefault.bg, color: t.textMuted,
            border: `1px solid ${t.border}`, cursor: "pointer",
          }}>
            Annuler
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{
            flex: 1, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: deleting ? t.chipDefault.bg : "#dc2626",
            color: deleting ? t.textMuted : "#fff",
            border: "none", cursor: deleting ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {deleting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Detail Modal ────────────────────────────────────────── */
function DetailModal({
  bagId, t, onClose, onRefresh, currentWilayaId, currentSDId,
}: {
  bagId: number; t: Tokens; onClose: () => void; onRefresh: () => void; currentWilayaId?: number | null; currentSDId?: number | null;
}) {
  const [bag, setBag] = useState<Bag | null>(null);
  const [loading, setLoading] = useState(true);
  const [localPackages, setLocalPackages] = useState<Package[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [scanFlash, setScanFlash] = useState<"success" | "error" | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [transitDriverId, setTransitDriverId] = useState<number | "">("");
  const [transitDrivers, setTransitDrivers] = useState<{ id: number; first_name: string; last_name: string }[]>([]);
  const scanRef = useRef<HTMLInputElement>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchBag = useCallback(async () => {
    setLoading(true);
    const res = await getBag(bagId);
    if (res.success && res.data) {
      setBag(res.data);
      setLocalPackages(res.data.packages ?? []);
    }
    setLoading(false);
  }, [bagId]);

  useEffect(() => { fetchBag(); }, [fetchBag]);

  useEffect(() => {
    api<{ id: number; first_name: string; last_name: string }[]>("/users?type=transit_chauffeur").then(res => {
      if (res.success && res.data) setTransitDrivers(res.data);
    });
  }, []);

  useEffect(() => {
    if (bag?.status === "cree" && scanRef.current) scanRef.current.focus();
  }, [bag?.status, loading]);

  const triggerFlash = (type: "success" | "error") => {
    setScanFlash(type);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setScanFlash(null), 800);
  };

  const handleScan = async () => {
    const tracking = scanInput.trim();
    if (!tracking || scanning || !bag) return;
    setScanning(true);
    setScanError("");
    const res = await addPackageToBag(bag.id, tracking);
    if (res.success && res.data) {
      setLocalPackages(prev => [res.data!, ...prev]);
      triggerFlash("success");
      setScanInput("");
    } else {
      triggerFlash("error");
      setScanError(res.message || "Erreur lors du scan.");
    }
    setScanning(false);
    scanRef.current?.focus();
  };

  // Auto-scan: trigger when input matches package tracking format
  useEffect(() => {
    if (!scanInput.trim() || scanning || bag?.status !== "cree") return;
    if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
    if (isValidPackageTracking(scanInput)) {
      autoScanTimerRef.current = setTimeout(() => { handleScan(); }, AUTO_SCAN_DELAY);
    }
    return () => { if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanInput, scanning, bag?.status]);

  const handleRemovePackage = async (packageId: number) => {
    if (!bag) return;
    const res = await removePackageFromBag(bag.id, packageId);
    if (res.success) {
      setLocalPackages(prev => prev.filter(p => p.id !== packageId));
    }
  };

  const handleSeal = async () => {
    if (!bag) return;
    setActionLoading(true);
    const res = await sealBag(bag.id);
    if (res.success && res.data) { setBag(res.data); onRefresh(); }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    if (!bag) return;
    setActionLoading(true);
    const res = await cancelBag(bag.id);
    if (res.success && res.data) { setBag(res.data); onRefresh(); }
    setActionLoading(false);
  };

  const handleStartTransit = async () => {
    if (!bag || !transitDriverId) return;
    setActionLoading(true);
    const res = await startBagTransit(bag.id, transitDriverId as number);
    if (res.success && res.data) { setBag(res.data); onRefresh(); }
    setActionLoading(false);
  };

  const handleReceive = async () => {
    if (!bag) return;
    setActionLoading(true);
    const res = await receiveBag(bag.id);
    if (res.success && res.data) { setBag(res.data); onRefresh(); }
    setActionLoading(false);
  };

  const handleUnpack = async () => {
    if (!bag) return;
    setActionLoading(true);
    const res = await unpackBag(bag.id);
    if (res.success) {
      // Refetch full bag with packages to get updated statuses
      await fetchBag();
      onRefresh();
      // Check for échange returns
      const exchangeReturns = (res as any).exchange_returns ?? [];
      if (exchangeReturns.length > 0) {
        const trackings = exchangeReturns.map((r: any) => r.return_tracking).join(", ");
        alert(`⚠️ Échange détecté!\n\n${exchangeReturns.length} colis retour créé(s):\n${trackings}\n\nImprimez les étiquettes et collez-les sur les produits d'échange.`);
      }
    }
    setActionLoading(false);
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
  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "3px 0",
  };
  const valStyle: React.CSSProperties = {
    fontSize: 13, color: t.text, lineHeight: 1.6,
  };

  const scanBorderColor = scanFlash === "success"
    ? "#22c55e"
    : scanFlash === "error"
      ? "#ef4444"
      : t.inp.border;

  const selectStyle: React.CSSProperties = {
    flex: 1, background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 8, padding: "8px 12px", fontSize: 13,
    color: t.inp.text, outline: "none", cursor: "pointer",
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
          width: "100%", maxWidth: 660, maxHeight: "90vh", overflowY: "auto",
          padding: 24,
        }}
      >
        {loading || !bag ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: t.textMuted }} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 4 }}>N\° TRACKING SAC</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: "monospace" }}>
                  {bag.tracking_number}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <BagStatusBadge status={bag.status} />
                  <BagTypeBadge type={bag.type} />
                </div>
              </div>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer", color: t.textMuted,
              }}>
                <X size={18} />
              </button>
            </div>

            {/* Bag info */}
            <div style={sectionStyle}>
              <div style={labelStyle}><Archive size={13} /> Informations du sac</div>
              <div style={valStyle}>
                <div style={rowStyle}>
                  <span style={{ color: t.textMuted }}>SD Origine</span>
                  <span style={{ fontWeight: 600 }}>{bag.origin_stop_desk?.name ?? "—"}</span>
                </div>
                <div style={rowStyle}>
                  <span style={{ color: t.textMuted }}>Destination</span>
                  <DestLabel bag={bag} size="md" />
                </div>
                <div style={rowStyle}>
                  <span style={{ color: t.textMuted }}>Nb Colis</span>
                  <span style={{ fontWeight: 700 }}>{localPackages.length}</span>
                </div>
                {bag.transit_driver && (
                  <div style={rowStyle}>
                    <span style={{ color: t.textMuted }}>Livreur Transit</span>
                    <span>{bag.transit_driver.first_name} {bag.transit_driver.last_name}</span>
                  </div>
                )}
                <div style={rowStyle}>
                  <span style={{ color: t.textMuted }}>Créé par</span>
                  <span>{bag.creator ? `${bag.creator.first_name} ${bag.creator.last_name}` : `#${bag.created_by}`}</span>
                </div>
                <div style={rowStyle}>
                  <span style={{ color: t.textMuted }}>Date création</span>
                  <span>{formatDate(bag.created_at)}</span>
                </div>
                {bag.sealed_at && (
                  <div style={rowStyle}>
                    <span style={{ color: t.textMuted }}>Scellé le</span>
                    <span>{formatDate(bag.sealed_at)}</span>
                  </div>
                )}
                {bag.transit_at && (
                  <div style={rowStyle}>
                    <span style={{ color: t.textMuted }}>Départ transit</span>
                    <span>{formatDate(bag.transit_at)}</span>
                  </div>
                )}
                {bag.received_at && (
                  <div style={rowStyle}>
                    <span style={{ color: t.textMuted }}>Reçu le</span>
                    <span>{formatDate(bag.received_at)}</span>
                  </div>
                )}
                {bag.unpacked_at && (
                  <div style={rowStyle}>
                    <span style={{ color: t.textMuted }}>Déballé le</span>
                    <span>{formatDate(bag.unpacked_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Route chain */}
            {bag.route_steps && bag.route_steps.length > 0 && (
              <div style={{ ...sectionStyle, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 10 }}>Routage</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {bag.route_steps.map((step, i) => {
                    const isDone = step.status === "done" || step.status === "forwarded";
                    const isActive = step.status === "arrived";
                    return (
                      <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontSize: 12, fontWeight: isDone || isActive ? 700 : 500,
                          color: isDone ? "#10b981" : isActive ? "#f97316" : t.textFaint,
                        }}>
                          {step.stop_desk?.name ?? `#${step.stop_desk_id}`}
                        </span>
                        {i < bag.route_steps!.length - 1 && (
                          <span style={{
                            fontSize: 11, color: isDone ? "#10b981" : t.textFaint, fontWeight: 300,
                          }}>
                            {bag.route_steps![i + 1]?.step_type === "transit" ? "···" : "›"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scan zone - only when status is cree */}
            {bag.status === "cree" && (
              <div style={{
                ...sectionStyle,
                background: scanFlash === "success"
                  ? "rgba(34,197,94,0.06)"
                  : scanFlash === "error"
                    ? "rgba(239,68,68,0.06)"
                    : t.iconBg,
                transition: "background 0.3s",
              }}>
                <div style={labelStyle}><ScanLine size={13} /> Scanner un colis</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    ref={scanRef}
                    value={scanInput}
                    onChange={e => { setScanInput(e.target.value); setScanError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current); handleScan(); } }}
                    placeholder="Scanner un tracking colis..."
                    style={{
                      flex: 1, background: t.inp.bg,
                      border: `2px solid ${scanBorderColor}`,
                      borderRadius: 8, padding: "9px 12px", fontSize: 13,
                      color: t.inp.text, outline: "none",
                      transition: "border-color 0.3s",
                      fontFamily: "monospace",
                    }}
                  />
                  <button
                    onClick={handleScan}
                    disabled={scanning || !scanInput.trim()}
                    style={{
                      padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: "#f97316", color: "#fff", border: "none",
                      cursor: scanning || !scanInput.trim() ? "default" : "pointer",
                      opacity: scanning || !scanInput.trim() ? 0.5 : 1,
                      transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {scanning ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
                    Ajouter
                  </button>
                </div>
                {scanError && (
                  <div style={{
                    marginTop: 8, padding: "8px 12px", borderRadius: 6,
                    background: "rgba(239,68,68,0.1)", color: "#dc2626",
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {scanError}
                  </div>
                )}
              </div>
            )}

            {/* Package list */}
            <div style={sectionStyle}>
              <div style={labelStyle}><Package2 size={13} /> Colis dans le sac ({localPackages.length})</div>
              {localPackages.length === 0 ? (
                <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "12px 0" }}>
                  Aucun colis dans ce sac
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{
                          padding: "6px 10px", fontSize: 10, fontWeight: 700,
                          color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                          textAlign: "left", borderBottom: `1px solid ${t.border}`,
                        }}>Tracking</th>
                        <th style={{
                          padding: "6px 10px", fontSize: 10, fontWeight: 700,
                          color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                          textAlign: "left", borderBottom: `1px solid ${t.border}`,
                        }}>Destinataire</th>
                        <th style={{
                          padding: "6px 10px", fontSize: 10, fontWeight: 700,
                          color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                          textAlign: "left", borderBottom: `1px solid ${t.border}`,
                        }}>Wilaya</th>
                        <th style={{
                          padding: "6px 10px", fontSize: 10, fontWeight: 700,
                          color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                          textAlign: "left", borderBottom: `1px solid ${t.border}`,
                        }}>Statut</th>
                        {bag.status === "cree" && (
                          <th style={{
                            padding: "6px 10px", fontSize: 10, fontWeight: 700,
                            color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                            textAlign: "center", borderBottom: `1px solid ${t.border}`,
                            width: 40,
                          }}></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {localPackages.map(pkg => (
                        <tr key={pkg.id}>
                          <td style={{
                            padding: "7px 10px", fontSize: 12, color: t.text,
                            fontFamily: "monospace", fontWeight: 600,
                            borderBottom: `1px solid ${t.divider}`,
                          }}>
                            {pkg.tracking_number}
                          </td>
                          <td style={{
                            padding: "7px 10px", fontSize: 12, color: t.textSub,
                            borderBottom: `1px solid ${t.divider}`,
                          }}>
                            {pkg.recipient_name}
                          </td>
                          <td style={{
                            padding: "7px 10px", fontSize: 12, color: t.textSub,
                            borderBottom: `1px solid ${t.divider}`,
                          }}>
                            {pkg.recipient_wilaya?.name ?? "—"}
                          </td>
                          <td style={{
                            padding: "7px 10px", borderBottom: `1px solid ${t.divider}`,
                          }}>
                            <PkgStatusBadge status={pkg.status} />
                          </td>
                          {bag.status === "cree" && (
                            <td style={{
                              padding: "7px 10px", textAlign: "center",
                              borderBottom: `1px solid ${t.divider}`,
                            }}>
                              <button
                                onClick={() => handleRemovePackage(pkg.id)}
                                style={{
                                  width: 24, height: 24, borderRadius: 6,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  background: "rgba(239,68,68,0.1)", border: "none",
                                  cursor: "pointer", color: "#dc2626",
                                  transition: "all 0.15s",
                                }}
                                title="Retirer du sac"
                              >
                                <X size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{
              ...sectionStyle, marginBottom: 14,
              background: t.iconBg,
            }}>
              <div style={labelStyle}>Actions</div>

              {bag.status === "cree" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleSeal}
                    disabled={actionLoading || localPackages.length === 0}
                    style={{
                      flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: localPackages.length === 0 ? t.chipDefault.bg : "#f97316",
                      color: localPackages.length === 0 ? t.textMuted : "#fff",
                      border: "none", cursor: localPackages.length === 0 ? "default" : "pointer",
                      opacity: actionLoading ? 0.6 : 1, transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {actionLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Lock size={14} />}
                    Sceller le Sac
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    style={{
                      padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: t.chipDefault.bg, color: t.textMuted,
                      border: `1px solid ${t.border}`, cursor: actionLoading ? "default" : "pointer",
                      opacity: actionLoading ? 0.6 : 1, transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    <XCircle size={14} />
                    Annuler
                  </button>
                </div>
              )}

              {bag.status === "scelle" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <select
                      value={transitDriverId}
                      onChange={e => setTransitDriverId(e.target.value ? Number(e.target.value) : "")}
                      style={selectStyle}
                    >
                      <option value="">Sélectionner un chauffeur...</option>
                      {transitDrivers.map(d => (
                        <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleStartTransit}
                    disabled={actionLoading || !transitDriverId}
                    style={{
                      padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: !transitDriverId ? t.chipDefault.bg : "#f97316",
                      color: !transitDriverId ? t.textMuted : "#fff",
                      border: "none", cursor: !transitDriverId || actionLoading ? "default" : "pointer",
                      opacity: actionLoading ? 0.6 : 1, transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {actionLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                    Départ Transit
                  </button>
                </div>
              )}

              {bag.status === "en_transit" && (() => {
                const u = getStoredUser();
                const isAdmin = u?.user_type === "admin";
                // Any SD in the route can receive
                const inRoute = bag.route_steps?.some(s => s.stop_desk_id === u?.stop_desk_id) ?? false;
                return (isAdmin || inRoute) ? (
                  <button
                    onClick={handleReceive}
                    disabled={actionLoading}
                    style={{
                      width: "100%", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: "#3b82f6", color: "#fff",
                      border: "none", cursor: actionLoading ? "default" : "pointer",
                      opacity: actionLoading ? 0.6 : 1, transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {actionLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Package2 size={14} />}
                    Réceptionner
                  </button>
                ) : (
                  <div style={{ padding: "10px 16px", textAlign: "center", fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
                    En route vers {bag.destination_stop_desk?.name ?? "destination"}
                  </div>
                );
              })()}

              {bag.status === "recu" && (() => {
                const u = getStoredUser();
                const mySD = u?.stop_desk_id ?? currentSDId;
                // Only the exact destination SD can unpack
                const isDestSD = bag.destination_stop_desk_id
                  ? mySD === bag.destination_stop_desk_id
                  : !bag.destination_stop_desk_id && currentWilayaId && bag.destination_wilaya_id === currentWilayaId;

                if (!isDestSD) {
                  // Not the destination — show forward controls only
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ position: "relative", flex: 1 }}>
                          <select
                            value={transitDriverId}
                            onChange={e => setTransitDriverId(e.target.value ? Number(e.target.value) : "")}
                            style={selectStyle}
                          >
                            <option value="">Sélectionner un livreur transit...</option>
                            {transitDrivers.map(d => (
                              <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={handleStartTransit}
                          disabled={actionLoading || !transitDriverId}
                          style={{
                            padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                            background: !transitDriverId ? t.chipDefault.bg : "#f97316",
                            color: !transitDriverId ? t.textMuted : "#fff",
                            border: "none", cursor: !transitDriverId || actionLoading ? "default" : "pointer",
                            opacity: actionLoading ? 0.6 : 1, transition: "all 0.15s",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {actionLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                          Mettre en Transit
                        </button>
                      </div>
                      {/* Next stop hint */}
                      {bag.route_steps && (() => {
                        const nextPending = bag.route_steps.find(s => s.status === "pending");
                        return nextPending ? (
                          <div style={{ fontSize: 11, color: t.textMuted, textAlign: "center" }}>
                            Prochaine étape : <strong style={{ color: t.text }}>{nextPending.stop_desk?.name}</strong>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  );
                }

                // This IS the destination — show only Déballer
                return (
                  <button
                    onClick={handleUnpack}
                    disabled={actionLoading}
                    style={{
                      width: "100%", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: "#10b981", color: "#fff",
                      border: "none", cursor: actionLoading ? "default" : "pointer",
                      opacity: actionLoading ? 0.6 : 1, transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {actionLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <PackageOpen size={14} />}
                    Déballer
                  </button>
                );
              })()}

              {(bag.status === "deballe" || bag.status === "annule") && (
                <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "4px 0" }}>
                  Aucune action disponible pour ce statut.
                </div>
              )}
            </div>

            {/* Scan logs timeline */}
            {bag.scan_logs && bag.scan_logs.length > 0 && (
              <div style={sectionStyle}>
                <div style={labelStyle}><Clock size={13} /> Historique des scans</div>
                <div style={{ position: "relative", paddingLeft: 18 }}>
                  <div style={{
                    position: "absolute", left: 5, top: 4, bottom: 4,
                    width: 2, background: t.border, borderRadius: 1,
                  }} />
                  {bag.scan_logs.map((log, i) => (
                    <div key={log.id} style={{ position: "relative", marginBottom: i < bag.scan_logs!.length - 1 ? 12 : 0 }}>
                      <div style={{
                        position: "absolute", left: -16, top: 4,
                        width: 8, height: 8, borderRadius: "50%",
                        background: i === 0 ? "#f97316" : t.textFaint,
                        border: `2px solid ${t.modalBg}`,
                      }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                        {log.action_label}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                        {log.scanned_by && typeof log.scanned_by === "object"
                          ? `${(log.scanned_by as any).first_name} ${(log.scanned_by as any).last_name}`
                          : log.scanned_by_user
                            ? `${log.scanned_by_user.first_name} ${log.scanned_by_user.last_name}`
                            : `#${log.scanned_by}`}
                        {" · "}
                        {formatDate(log.created_at)}
                      </div>
                      {log.notes && (
                        <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2, fontStyle: "italic" }}>
                          {log.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function GestionSacsPage() {
  return (
    <Suspense fallback={null}>
      <GestionSacsContent />
    </Suspense>
  );
}

function GestionSacsContent() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const searchParams = useSearchParams();

  // SD context
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>("envoi");
  const sdLoaded = useRef(false);

  const selectedSDObj = stopDesks.find(sd => sd.id === selectedSD);
  const selectedWilayaId = selectedSDObj?.commune?.wilaya_id ?? null;
  const selectedWilayaName = selectedSDObj?.commune?.wilaya?.name ?? null;

  // Hierarchy info for selected SD
  const [sdHierarchy, setSdHierarchy] = useState<any>(null);
  useEffect(() => {
    setSdHierarchy(null); // Reset immediately on SD change
    if (!selectedSD) return;
    api<any>(`/stop-desks/${selectedSD}/hierarchy`).then(res => {
      if (res.success && res.data) setSdHierarchy(res.data);
    });
  }, [selectedSD]);
  const sdRole: string = sdHierarchy?.role ?? "autonome";
  const hasPassageTab = sdRole === "hub" || (sdHierarchy?.children?.length > 0);

  // Reset to envoi if passage tab disappears (switched to a commune SD)
  useEffect(() => {
    if (direction === "passage" && !hasPassageTab) setDirection("envoi");
  }, [hasPassageTab, direction]);

  useEffect(() => {
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); sdLoaded.current = true; return; }
        // URL param ?sd=X takes priority for easy multi-tab testing
        const urlSD = searchParams.get("sd");
        if (urlSD) {
          const id = Number(urlSD);
          if (res.data.some(sd => sd.id === id)) { setSelectedSD(id); sdLoaded.current = true; return; }
        }
        const saved = localStorage.getItem(SD_LS_KEY);
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
  }, []);

  useEffect(() => {
    if (selectedSD !== null) localStorage.setItem(SD_LS_KEY, String(selectedSD));
  }, [selectedSD]);

  // State
  const [bags, setBags] = useState<Bag[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(
    searchParams.get("filter") === "passage" ? "passage" : "actifs"
  );
  const [typeFilter, setTypeFilter] = useState<BagType | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Modals
  const [selectedBagId, setSelectedBagId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editBag, setEditBag] = useState<Bag | null>(null);
  const [deleteBagTarget, setDeleteBagTarget] = useState<Bag | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Smart scan (auto bag creation)
  const [smartScanInput, setSmartScanInput] = useState("");
  const [smartScanning, setSmartScanning] = useState(false);
  const [smartScanFlash, setSmartScanFlash] = useState<"" | "success" | "error">("");
  const [smartScanMsg, setSmartScanMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [smartBags, setSmartBags] = useState<{ bag: Bag; label: string; count: number; packages: string[] }[]>([]);
  const smartScanTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function handleSmartScan(tracking: string) {
    if (!tracking.trim() || !selectedSD || smartScanning) return;
    setSmartScanning(true);
    setSmartScanMsg(null);
    try {
      // Find the package to get its destination SD
      const pkgRes = await api<{ data: any[] }>(`/packages?search=${encodeURIComponent(tracking.trim())}&origin_stop_desk_id=${selectedSD}&status=accepte_operateur&per_page=1&include_external=1`);
      const pkg = pkgRes.data?.data?.[0];
      if (!pkg) {
        setSmartScanFlash("error");
        setSmartScanMsg({ type: "error", text: `Colis ${tracking} introuvable ou non éligible (doit être "Accepté opérateur" à ce SD)` });
        setTimeout(() => setSmartScanFlash(""), 1500);
        setSmartScanInput("");
        setSmartScanning(false);
        return;
      }

      const destWilayaId = pkg.recipient_wilaya_id;
      const destWilayaName = pkg.recipient_wilaya?.name ?? `Wilaya ${destWilayaId}`;
      const destSDId = pkg.destination_stop_desk_id as number | null;
      const destSDName = pkg.destination_stop_desk?.name as string | undefined;

      // Group by destination SD (precise routing), fallback to wilaya if no SD
      const groupKey = destSDId ?? `w_${destWilayaId}`;
      let existingBag = smartBags.find(sb =>
        destSDId
          ? sb.bag.destination_stop_desk_id === destSDId
          : (!sb.bag.destination_stop_desk_id && sb.bag.destination_wilaya_id === destWilayaId)
      );

      if (!existingBag) {
        const bagRes = await createBag({
          type: "aller",
          origin_stop_desk_id: selectedSD,
          destination_wilaya_id: destWilayaId,
          destination_stop_desk_id: destSDId ?? null,
        });
        if (!bagRes.success || !bagRes.data) {
          setSmartScanFlash("error");
          setSmartScanMsg({ type: "error", text: bagRes.message || "Erreur création sac" });
          setTimeout(() => setSmartScanFlash(""), 1500);
          setSmartScanInput("");
          setSmartScanning(false);
          return;
        }
        const label = destSDName ? `${destWilayaName} · ${destSDName}` : destWilayaName;
        existingBag = { bag: bagRes.data, label, count: 0, packages: [] };
        setSmartBags(prev => [...prev, existingBag!]);
      }

      // Add package to the bag
      const addRes = await addPackageToBag(existingBag.bag.id, tracking.trim());
      if (addRes.success) {
        setSmartScanFlash("success");
        setSmartScanMsg({ type: "success", text: `${tracking} → ${existingBag.label}` });
        setSmartBags(prev => prev.map(sb =>
          sb.bag.id === existingBag!.bag.id
            ? { ...sb, count: sb.count + 1, packages: [...sb.packages, tracking.trim()] }
            : sb
        ));
      } else {
        setSmartScanFlash("error");
        setSmartScanMsg({ type: "error", text: addRes.message || "Erreur ajout colis" });
      }
    } catch (e: any) {
      setSmartScanFlash("error");
      setSmartScanMsg({ type: "error", text: e?.message || "Erreur réseau" });
    }
    setSmartScanInput("");
    setTimeout(() => setSmartScanFlash(""), 1500);
    setSmartScanning(false);
  }

  // Scan-to-receive
  const [receiveScanInput, setReceiveScanInput] = useState("");
  const [receiveScanFlash, setReceiveScanFlash] = useState<"success" | "error" | null>(null);
  const [receiveScanError, setReceiveScanError] = useState("");
  const [receiveScanLoading, setReceiveScanLoading] = useState(false);
  const [lastReceivedBag, setLastReceivedBag] = useState<Bag | null>(null);
  const [autoUnpack, setAutoUnpack] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(AUTO_UNPACK_LS_KEY) === "1" : false
  );
  const receiveScanRef = useRef<HTMLInputElement>(null);
  const receiveFlashRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const receiveAutoScanRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Pipeline counts
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  const [pipelineLoading, setPipelineLoading] = useState(false);

  // Reset status filter when direction changes
  useEffect(() => {
    setStatusFilter(direction === "envoi" ? "actifs" : direction === "passage" ? "passage" : "a_traiter");
  }, [direction]);

  // Fetch pipeline counts
  const fetchPipelineCounts = useCallback(async () => {
    if (!selectedSD) return;
    setPipelineLoading(true);
    const stages = direction === "envoi" ? ENVOI_PIPELINE : direction === "passage" ? PASSAGE_PIPELINE : RECEPTION_PIPELINE;

    const results = await Promise.all(
      stages.map(async (stage) => {
        if (direction === "envoi") {
          // Envoi: own bags only (by origin)
          const res = await getBags({ origin_stop_desk_id: selectedSD, status: stage.status, per_page: 1 });
          return { key: stage.status, count: res.data?.total ?? 0 };
        } else if (direction === "passage") {
          // En passage: bags passing through (not origin, not dest, not forwarded)
          const res = await getBags({ passing_through_sd_id: selectedSD, per_page: 1 });
          return { key: stage.status, count: res.data?.total ?? 0 };
        } else {
          // Réception:
          // - en_transit: ALL bags arriving here (next pending step = this SD)
          // - reçu/déballé: only destination bags (passage bags go to En passage tab)
          if (stage.status === "en_transit") {
            const res = await getBags({ routed_through_sd_id: selectedSD, route_step_status: "pending", status: "en_transit", per_page: 1 });
            return { key: stage.status, count: res.data?.total ?? 0 };
          }
          const res = await getBags({ destination_sd_id: selectedSD, status: stage.status, per_page: 1 });
          return { key: stage.status, count: res.data?.total ?? 0 };
        }
      })
    );
    const counts: Record<string, number> = {};
    for (const r of results) counts[r.key] = r.count;

    setPipelineCounts(counts);
    setPipelineLoading(false);
  }, [selectedSD, direction, selectedWilayaId]);

  useEffect(() => { if (sdLoaded.current) fetchPipelineCounts(); }, [fetchPipelineCounts]);

  // Debounce search
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Resolve virtual status filter to API status param
  const resolveStatusParam = useCallback((filter: StatusFilterValue): string | undefined => {
    if (filter === "all") return undefined;
    const chips = direction === "envoi" ? ENVOI_STATUSES : direction === "passage" ? PASSAGE_STATUSES : RECEPTION_STATUSES;
    const chip = chips.find(c => c.value === filter);
    return chip?.apiStatuses;
  }, [direction]);

  // Fetch bags
  const fetchBags = useCallback(async (p = page) => {
    if (!selectedSD) { setLoading(false); setBags([]); return; }
    setLoading(true);
    const params: Record<string, string | number> = { page: p, per_page: PER_PAGE };

    if (typeFilter !== "all") params.type = typeFilter;
    if (debouncedSearch) params.search = debouncedSearch;

    if (direction === "envoi") {
      // Envoi: own bags only (by origin)
      params.origin_stop_desk_id = selectedSD;
      const apiStatus = resolveStatusParam(statusFilter);
      if (apiStatus) params.status = apiStatus;
    } else if (direction === "passage") {
      // En passage: bags passing through this SD
      params.passing_through_sd_id = selectedSD;
    } else {
      // Réception:
      // - en_transit/à_traiter: ALL incoming bags (pending step = this SD)
      // - reçu/déballé: only destination bags
      const apiStatus = resolveStatusParam(statusFilter);
      if (statusFilter === "en_transit" || statusFilter === "a_traiter") {
        params.routed_through_sd_id = selectedSD;
        params.route_step_status = "pending";
        if (apiStatus) params.status = apiStatus;
      } else {
        params.destination_sd_id = selectedSD;
        if (apiStatus) params.status = apiStatus;
      }
    }
    const res = await getBags(params);
    if (res.success && res.data) {
      setBags(res.data.data);
      setPage(res.data.current_page);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, debouncedSearch, selectedSD, direction, selectedWilayaId, resolveStatusParam]);

  // Manual refresh helper
  const refreshAll = useCallback(() => { fetchBags(page); fetchPipelineCounts(); }, [fetchBags, page, fetchPipelineCounts]);

  // Reset page and fetch when filters change
  const filtersRef = useRef({ statusFilter, typeFilter, debouncedSearch, selectedSD, direction });
  useEffect(() => {
    const prev = filtersRef.current;
    const changed = prev.statusFilter !== statusFilter || prev.typeFilter !== typeFilter
      || prev.debouncedSearch !== debouncedSearch || prev.selectedSD !== selectedSD || prev.direction !== direction;
    filtersRef.current = { statusFilter, typeFilter, debouncedSearch, selectedSD, direction };
    if (changed) {
      setPage(1);
      if (sdLoaded.current) { fetchBags(1); fetchPipelineCounts(); }
    } else if (sdLoaded.current) {
      fetchBags(page);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, typeFilter, debouncedSearch, selectedSD, direction]);

  // No auto-refresh — use the refresh button instead

  // Persist auto-unpack toggle
  useEffect(() => {
    localStorage.setItem(AUTO_UNPACK_LS_KEY, autoUnpack ? "1" : "0");
  }, [autoUnpack]);

  // Scan-to-receive handler (must be after fetchBags)
  const handleReceiveScan = useCallback(async () => {
    const tracking = receiveScanInput.trim();
    if (!tracking || receiveScanLoading) return;
    setReceiveScanLoading(true);
    setReceiveScanError("");
    setLastReceivedBag(null);

    // Search for the bag by tracking number
    const searchRes = await getBags({ search: tracking, per_page: 1 });
    const foundBag = searchRes.data?.data?.[0];

    if (!foundBag) {
      setReceiveScanFlash("error");
      setReceiveScanError("Sac introuvable avec ce tracking.");
      setReceiveScanLoading(false);
      if (receiveFlashRef.current) clearTimeout(receiveFlashRef.current);
      receiveFlashRef.current = setTimeout(() => setReceiveScanFlash(null), 1200);
      receiveScanRef.current?.focus();
      return;
    }

    if (foundBag.status !== "en_transit") {
      setReceiveScanFlash("error");
      setReceiveScanError(`Ce sac est au statut "${BAG_STATUS_LABELS[foundBag.status]}" — seuls les sacs "En transit" peuvent être réceptionnés.`);
      setReceiveScanLoading(false);
      if (receiveFlashRef.current) clearTimeout(receiveFlashRef.current);
      receiveFlashRef.current = setTimeout(() => setReceiveScanFlash(null), 1200);
      receiveScanRef.current?.focus();
      return;
    }

    // Receive the bag
    const res = await receiveBag(foundBag.id);
    if (res.success && res.data) {
      let finalBag = res.data;
      let actionLabel = "réceptionné";

      // Auto-unpack if toggle is on AND bag is destined for this SD (not passage)
      if (autoUnpack) {
        const isForThisSD = !foundBag.destination_stop_desk_id
          ? foundBag.destination_wilaya_id === selectedWilayaId
          : foundBag.destination_stop_desk_id === selectedSD;
        if (isForThisSD) {
          const unpackRes = await unpackBag(foundBag.id);
          if (unpackRes.success && unpackRes.data) {
            finalBag = unpackRes.data;
            actionLabel = "réceptionné + déballé";
          }
        } else {
          actionLabel = "réceptionné (en passage — à réexpédier)";
        }
      }

      setReceiveScanFlash("success");
      setLastReceivedBag(finalBag);
      setReceiveScanInput("");
      setToast({ message: `Sac ${foundBag.tracking_number} ${actionLabel} (${foundBag.packages_count} colis)`, type: "success" });
      refreshAll();
    } else {
      setReceiveScanFlash("error");
      setReceiveScanError(res.message || "Erreur lors de la réception.");
    }

    setReceiveScanLoading(false);
    if (receiveFlashRef.current) clearTimeout(receiveFlashRef.current);
    receiveFlashRef.current = setTimeout(() => setReceiveScanFlash(null), 1200);
    receiveScanRef.current?.focus();
  }, [receiveScanInput, receiveScanLoading, fetchBags, page, autoUnpack, selectedSD, selectedWilayaId]);

  // Auto-scan for receive: trigger when input matches bag tracking format
  useEffect(() => {
    if (!receiveScanInput.trim() || receiveScanLoading || direction !== "reception") return;
    if (receiveAutoScanRef.current) clearTimeout(receiveAutoScanRef.current);
    if (isValidBagTracking(receiveScanInput)) {
      receiveAutoScanRef.current = setTimeout(() => { handleReceiveScan(); }, AUTO_SCAN_DELAY);
    }
    return () => { if (receiveAutoScanRef.current) clearTimeout(receiveAutoScanRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiveScanInput, receiveScanLoading, direction]);

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
            <Archive size={20} style={{ color: "#f97316" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>Gestion des Sacs</h1>
            <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>
              {total} sac{total !== 1 ? "s" : ""}
              {selectedSDObj ? ` · ${selectedSDObj.name}` : ""}
              {selectedWilayaName ? ` (${selectedWilayaName})` : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {direction === "envoi" && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: "#f97316", color: "#fff", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
              }}
            >
              <Plus size={15} />
              Nouveau Sac
            </button>
          )}
          <button
            onClick={() => refreshAll()}
            style={{
              width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: t.iconBg, border: `1px solid ${t.border}`, cursor: "pointer", color: t.textMuted,
              transition: "all 0.15s",
            }}
            title="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* SD selector + Direction tabs */}
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

        <div key={`tabs-${selectedSD}-${hasPassageTab}`} style={{
          display: "flex", borderRadius: 10, overflow: "hidden",
          border: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          {([
            { key: "envoi" as Direction, label: "Envoi", icon: <ArrowUpRight size={14} />, desc: "Sacs sortants", color: "#ea580c" },
            ...(hasPassageTab
              ? [{ key: "passage" as Direction, label: "En passage", icon: <ArrowRight size={14} />, desc: "Sacs en transit", color: "#f97316" }]
              : []),
            { key: "reception" as Direction, label: "Réception", icon: <ArrowDownLeft size={14} />, desc: "Sacs entrants", color: "#2563eb" },
          ]).map(tab => {
            const active = direction === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setDirection(tab.key)}
                title={tab.desc}
                style={{
                  padding: "8px 16px", fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 6,
                  background: active ? `${tab.color}18` : "transparent",
                  color: active ? tab.color : t.textMuted,
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  borderRight: tab.key !== "reception" ? `1px solid ${t.border}` : "none",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* No SD warning */}
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
            Choisissez le stop desk depuis lequel vous travaillez pour voir les sacs correspondants.
          </div>
        </div>
      )}

      {/* ═══ Smart Scan — Auto bag creation (Envoi only) ═══ */}
      {selectedSD && direction === "envoi" && (
          <div style={{
            background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
            padding: 18, marginBottom: 14, boxShadow: t.shadow,
            borderLeft: "4px solid #f97316",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(249,115,22,0.1)",
              }}>
                <ScanLine size={16} style={{ color: "#f97316" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Scan & Attribution automatique</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  Scannez un colis — le sac est créé automatiquement par destination
                </div>
              </div>
            </div>
            <div style={{
              display: "flex", gap: 8,
              border: `2px solid ${smartScanFlash === "success" ? "rgba(34,197,94,0.5)" : smartScanFlash === "error" ? "rgba(239,68,68,0.5)" : "#f97316"}`,
              borderRadius: 10, padding: 6,
              background: smartScanFlash === "success" ? "rgba(34,197,94,0.06)" : smartScanFlash === "error" ? "rgba(239,68,68,0.06)" : "transparent",
              transition: "all 300ms",
            }}>
              <ScanLine size={16} style={{ color: "#f97316", margin: "auto 4px auto 6px" }} />
              <input
                placeholder="Scanner un tracking colis (DLV-...)..."
                value={smartScanInput}
                onChange={e => {
                  setSmartScanInput(e.target.value);
                  if (smartScanTimerRef.current) clearTimeout(smartScanTimerRef.current);
                  if (/^DLV-\d{8}-[A-Z0-9]{6}$/i.test(e.target.value.trim())) {
                    smartScanTimerRef.current = setTimeout(() => handleSmartScan(e.target.value.trim()), 600);
                  }
                }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (smartScanTimerRef.current) clearTimeout(smartScanTimerRef.current); handleSmartScan(smartScanInput); } }}
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  color: t.text, fontSize: 14, fontWeight: 600, padding: "8px 4px",
                  fontFamily: "monospace",
                }}
              />
              {smartScanning && <Loader2 size={16} className="animate-spin" style={{ color: "#f97316", margin: "auto 8px" }} />}
            </div>
            {smartScanMsg && (
              <div style={{
                marginTop: 8, fontSize: 12, fontWeight: 600,
                color: smartScanMsg.type === "success" ? "#16a34a" : "#ef4444",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {smartScanMsg.type === "success" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {smartScanMsg.text}
              </div>
            )}

            {/* Auto-created bags preview */}
            {smartBags.length > 0 && (
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {smartBags.map(sb => (
                  <div key={sb.bag.id} style={{
                    flex: "1 1 180px", minWidth: 170, padding: 14, borderRadius: 12,
                    background: t.iconBg, border: `1px solid ${t.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{sb.label}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                        background: "rgba(249,115,22,0.1)", color: "#f97316",
                      }}>{sb.count} colis</span>
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace", marginBottom: 8 }}>
                      {sb.bag.tracking_number}
                    </div>
                    {/* Package list */}
                    {sb.packages.map(tn => (
                      <div key={tn} style={{ fontSize: 10, color: t.textFaint, fontFamily: "monospace" }}>{tn}</div>
                    ))}
                    <button
                      onClick={async () => {
                        const res = await sealBag(sb.bag.id);
                        if (res.success) {
                          setSmartBags(prev => prev.filter(b => b.bag.id !== sb.bag.id));
                          setSmartScanMsg({ type: "success", text: `Sac ${sb.bag.tracking_number} scellé — ${sb.count} colis` });
                          refreshAll();
                        }
                      }}
                      disabled={sb.count === 0}
                      style={{
                        marginTop: 8, width: "100%", padding: "7px 0", borderRadius: 8,
                        border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: sb.count > 0 ? "rgba(99,102,241,0.12)" : t.iconBg,
                        color: sb.count > 0 ? "#6366f1" : t.textFaint,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      }}
                    >
                      <Lock size={12} /> Sceller
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
      )}

      {/* Scan-to-receive zone (Réception direction only) */}
      {selectedSD && direction === "reception" && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          padding: 18, marginBottom: 14, boxShadow: t.shadow,
          borderLeft: `4px solid #3b82f6`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(59,130,246,0.1)",
            }}>
              <ScanLine size={16} style={{ color: "#3b82f6" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Réception rapide</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>
                Scannez le tracking d&apos;un sac — détection automatique
              </div>
            </div>
            {/* Auto-unpack toggle */}
            <div
              onClick={() => setAutoUnpack(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "6px 12px", borderRadius: 8,
                background: autoUnpack ? "rgba(16,185,129,0.1)" : t.iconBg,
                border: `1px solid ${autoUnpack ? "rgba(16,185,129,0.3)" : t.border}`,
                transition: "all 0.15s",
              }}
            >
              {/* Switch track */}
              <div style={{
                width: 34, height: 18, borderRadius: 9, position: "relative",
                background: autoUnpack ? "#10b981" : t.textFaint,
                transition: "background 0.2s",
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 7,
                  background: "#fff", position: "absolute", top: 2,
                  left: autoUnpack ? 18 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                color: autoUnpack ? "#059669" : t.textMuted,
              }}>
                Auto-déballer
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={receiveScanRef}
              value={receiveScanInput}
              onChange={e => { setReceiveScanInput(e.target.value); setReceiveScanError(""); setLastReceivedBag(null); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (receiveAutoScanRef.current) clearTimeout(receiveAutoScanRef.current); handleReceiveScan(); } }}
              placeholder="SAC-XXXXXXXX-XXXX..."
              style={{
                flex: 1, background: t.inp.bg,
                border: `2px solid ${
                  receiveScanFlash === "success" ? "#22c55e"
                    : receiveScanFlash === "error" ? "#ef4444"
                    : t.inp.border
                }`,
                borderRadius: 8, padding: "10px 14px", fontSize: 14,
                color: t.inp.text, outline: "none", fontFamily: "monospace",
                fontWeight: 600, transition: "border-color 0.3s",
              }}
            />
            {receiveScanLoading && (
              <div style={{
                padding: "10px 16px", display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, color: "#3b82f6",
              }}>
                <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                Traitement...
              </div>
            )}
          </div>
          {receiveScanError && (
            <div style={{
              marginTop: 10, padding: "9px 14px", borderRadius: 8,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
              color: "#dc2626", fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              {receiveScanError}
            </div>
          )}
          {lastReceivedBag && (
            <div style={{
              marginTop: 10, padding: "9px 14px", borderRadius: 8,
              background: t.success.bg, border: `1px solid ${t.success.border}`,
              color: t.success.text, fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
              <span>
                <strong style={{ fontFamily: "monospace" }}>{lastReceivedBag.tracking_number}</strong>
                {" "}{lastReceivedBag.status === "deballe" ? "réceptionné + déballé" : "réceptionné"} — {lastReceivedBag.packages_count} colis
                {lastReceivedBag.origin_stop_desk?.name ? ` depuis ${lastReceivedBag.origin_stop_desk.name}` : ""}
              </span>
              <button
                onClick={() => { setSelectedBagId(lastReceivedBag.id); setLastReceivedBag(null); }}
                style={{
                  marginLeft: "auto", fontSize: 11, fontWeight: 700, color: t.success.text,
                  background: "transparent", border: "none", cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Voir
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hierarchy info */}
      {selectedSD && sdHierarchy && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap",
          padding: "10px 16px", borderRadius: 10,
          background: sdRole === "hub" ? "rgba(16,185,129,0.06)" : sdRole === "sub_sd" ? "rgba(59,130,246,0.06)" : sdRole === "commune_sd" ? "rgba(139,92,246,0.06)" : "rgba(107,114,128,0.06)",
          border: `1px solid ${sdRole === "hub" ? "rgba(16,185,129,0.15)" : sdRole === "sub_sd" ? "rgba(59,130,246,0.15)" : sdRole === "commune_sd" ? "rgba(139,92,246,0.15)" : "rgba(107,114,128,0.15)"}`,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99,
            background: sdRole === "hub" ? "#10b981" : sdRole === "sub_sd" ? "#3b82f6" : sdRole === "commune_sd" ? "#7c3aed" : "#6b7280",
            color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            {sdRole === "hub" ? "HUB" : sdRole === "sub_sd" ? "SUB-SD" : sdRole === "commune_sd" ? "COMMUNE" : "AUTONOME"}
          </span>
          {sdHierarchy.upward_chain?.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: isDark ? "#d1d5db" : "#374151" }}>
              {sdHierarchy.upward_chain.map((s: any, i: number) => (
                <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: i === 0 ? 700 : 500, color: i === 0 ? (isDark ? "#f0f0f5" : "#111827") : undefined }}>
                    {s.name}
                  </span>
                  {i < sdHierarchy.upward_chain.length - 1 && <span style={{ color: "#9ca3af" }}>→</span>}
                </span>
              ))}
            </div>
          )}
          {sdHierarchy.children?.length > 0 && (
            <span style={{ fontSize: 11, color: isDark ? "#6b7280" : "#9ca3af", marginLeft: "auto" }}>
              {sdHierarchy.children.length} sous-SD{sdHierarchy.children.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Pipeline stats */}
      {selectedSD && (
        <div style={{
          display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap",
        }}>
          {(direction === "envoi" ? ENVOI_PIPELINE : direction === "passage" ? PASSAGE_PIPELINE : RECEPTION_PIPELINE).map((stage, i, arr) => (
            <div key={stage.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => {
                  const chips = direction === "envoi" ? ENVOI_STATUSES : direction === "passage" ? PASSAGE_STATUSES : RECEPTION_STATUSES;
                  const match = chips.find(c => c.apiStatuses === stage.status);
                  if (match) setStatusFilter(match.value);
                  else if (stage.status === "passage") setStatusFilter("passage");
                }}
                style={{
                  background: t.card, borderRadius: 10, border: `1px solid ${t.border}`,
                  padding: "10px 16px", cursor: "pointer", transition: "all 0.15s",
                  boxShadow: t.shadow, display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 2, minWidth: 90,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = stage.color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; }}
              >
                <span style={{
                  fontSize: 22, fontWeight: 800, color: stage.color,
                  lineHeight: 1,
                }}>
                  {pipelineLoading ? "—" : (pipelineCounts[stage.status] ?? 0)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, whiteSpace: "nowrap" }}>
                  {stage.label}
                </span>
              </button>
              {i < arr.length - 1 && (
                <ArrowRight size={14} style={{ color: t.textFaint, flexShrink: 0 }} />
              )}
            </div>
          ))}

        </div>
      )}

      {/* Filters */}
      {selectedSD && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          padding: 18, marginBottom: 18, boxShadow: t.shadow,
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {(direction === "envoi" ? ENVOI_STATUSES : RECEPTION_STATUSES).map(s => (
              <Chip
                key={s.value}
                active={statusFilter === s.value}
                label={s.label}
                color={s.value !== "all" && (s.value as string) in BAG_STATUS_COLORS
                  ? BAG_STATUS_COLORS[s.value as BagStatus]
                  : undefined}
                onClick={() => setStatusFilter(s.value)}
                t={t}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {ALL_TYPES.map(s => (
              <Chip
                key={s.value}
                active={typeFilter === s.value}
                label={s.label}
                color={s.value !== "all" ? { ...BAG_TYPE_COLORS[s.value as BagType], dot: BAG_TYPE_COLORS[s.value as BagType].text } : undefined}
                onClick={() => setTypeFilter(s.value as BagType | "all")}
                t={t}
              />
            ))}
            <div style={{ flex: 1, minWidth: 200, marginLeft: 8, position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tracking sac..."
                style={{
                  width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                  borderRadius: 8, padding: "7px 11px 7px 32px", fontSize: 13,
                  color: t.inp.text, outline: "none",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 2,
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {selectedSD && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 420px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Tracking</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Statut</th>
                  {direction === "envoi" ? (
                    <th style={thStyle}>Destination</th>
                  ) : (
                    <th style={thStyle}>Origine SD</th>
                  )}
                  <th style={{ ...thStyle, textAlign: "center" }}>Nb Colis</th>
                  <th style={thStyle}>Chauffeur</th>
                  <th style={thStyle}>Date</th>
                  <th style={{ ...thStyle, width: 48, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: 48 }}>
                      <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: t.textMuted, margin: "0 auto" }} />
                    </td>
                  </tr>
                ) : bags.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: 48, color: t.textMuted }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Archive size={28} style={{ color: t.textFaint, opacity: 0.5 }} />
                        <div>
                          {direction === "envoi" && (statusFilter === "actifs")
                            ? "Aucun sac en préparation. Créez un nouveau sac pour commencer."
                            : direction === "reception" && (statusFilter === "a_traiter")
                              ? "Aucun sac en attente de réception."
                              : direction === "envoi"
                                ? "Aucun sac sortant pour ce filtre."
                                : "Aucun sac entrant pour ce filtre."}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bags.map(bag => (
                    <tr
                      key={bag.id}
                      style={{ cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td
                        onClick={() => setSelectedBagId(bag.id)}
                        style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {bag.tracking_number}
                          {/* "En passage" badge for bags passing through this SD */}
                          {sdHierarchy?.children?.length > 0
                            && bag.origin_stop_desk_id !== selectedSD
                            && bag.status === "recu" && (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 3,
                              padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: "rgba(249,115,22,0.12)", color: "#ea580c",
                              fontFamily: "inherit", whiteSpace: "nowrap",
                            }}>
                              <ArrowUpRight size={10} />
                              Passage
                            </span>
                          )}
                        </span>
                      </td>
                      <td onClick={() => setSelectedBagId(bag.id)} style={tdStyle}>
                        <BagTypeBadge type={bag.type} />
                      </td>
                      <td onClick={() => setSelectedBagId(bag.id)} style={tdStyle}>
                        <BagStatusBadge status={bag.status} />
                      </td>
                      {direction === "envoi" ? (
                        <td onClick={() => setSelectedBagId(bag.id)} style={{ ...tdStyle, color: t.textSub }}>
                          <DestLabel bag={bag} />
                        </td>
                      ) : (
                        <td onClick={() => setSelectedBagId(bag.id)} style={{ ...tdStyle, color: t.textSub }}>
                          {bag.origin_stop_desk?.name ?? "—"}
                        </td>
                      )}
                      <td onClick={() => setSelectedBagId(bag.id)} style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>
                        {bag.packages_count}
                      </td>
                      <td onClick={() => setSelectedBagId(bag.id)} style={{ ...tdStyle, color: t.textSub }}>
                        {bag.transit_driver
                          ? `${bag.transit_driver.first_name} ${bag.transit_driver.last_name}`
                          : "—"}
                      </td>
                      <td onClick={() => setSelectedBagId(bag.id)} style={{ ...tdStyle, fontSize: 12, color: t.textMuted }}>
                        {direction === "envoi"
                          ? formatDate(bag.sealed_at ?? bag.created_at)
                          : formatDate(bag.received_at ?? bag.transit_at ?? bag.created_at)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", padding: "10px 8px" }}>
                        {direction === "envoi" ? (
                          <RowActions
                            bag={bag}
                            t={t}
                            onView={() => setSelectedBagId(bag.id)}
                            onEdit={() => setEditBag(bag)}
                            onDelete={() => setDeleteBagTarget(bag)}
                          />
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedBagId(bag.id); }}
                            style={{
                              width: 30, height: 30, borderRadius: 6,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "transparent", border: "none",
                              cursor: "pointer", color: t.textMuted, transition: "all 0.15s",
                            }}
                            title="Voir détails"
                          >
                            <Eye size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
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
              <span style={{ fontSize: 13, color: t.textMuted }}>
                Page {page} sur {lastPage}
              </span>
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
      )}

      {/* Detail modal */}
      {selectedBagId !== null && (
        <DetailModal
          bagId={selectedBagId}
          t={t}
          onClose={() => setSelectedBagId(null)}
          onRefresh={() => refreshAll()}
          currentWilayaId={selectedWilayaId}
          currentSDId={selectedSD}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateBagModal
          t={t}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            fetchBags(1);
            setToast({ message: "Sac créé avec succès", type: "success" });
          }}
          prefillOriginSD={selectedSD ?? undefined}
        />
      )}

      {/* Edit modal */}
      {editBag && (
        <EditBagModal
          bag={editBag}
          t={t}
          onClose={() => setEditBag(null)}
          onUpdated={() => {
            refreshAll();
            setToast({ message: "Sac modifié avec succès", type: "success" });
          }}
        />
      )}

      {/* Delete confirm modal */}
      {deleteBagTarget && (
        <DeleteConfirmModal
          bag={deleteBagTarget}
          t={t}
          onClose={() => setDeleteBagTarget(null)}
          onDeleted={() => {
            refreshAll();
            setToast({ message: "Sac supprimé", type: "success" });
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
