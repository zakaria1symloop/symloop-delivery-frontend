"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  UserCheck, Search, X, Loader2, Package2, Phone, CreditCard,
  Truck, AlertTriangle, Clock, CheckCircle2, PackageOpen,
  Hash, MapPin, User, FileText, Weight, Building2,
  ArrowRightLeft, ShieldAlert,
} from "lucide-react";
import {
  searchForRetrait, searchByPhone, deliverPackage,
  type Package, type ServiceType,
  STATUS_LABELS, STATUS_COLORS, SERVICE_LABELS,
} from "@/lib/packages";
import { api, getStoredUser, isSDLocked, getLockedSDId } from "@/lib/api";
import SDSelector from "@/components/SDSelector";

/* ── SD option type ──────────────────────────────────────── */
interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  commune_id: number;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

const RETRAIT_SD_KEY = "retrait_selected_sd";

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
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── helpers ──────────────────────────────────────────────── */
function formatDA(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-DZ") + " DA";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function daysWaiting(pkg: Package): number | null {
  if (!pkg.arrived_at && !pkg.in_transit_at) return null;
  const ref = pkg.arrived_at || pkg.in_transit_at;
  if (!ref) return null;
  const ms = Date.now() - new Date(ref).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isTrackingNumber(s: string): boolean {
  return /^[A-Z]{2,4}-/i.test(s);
}

const SERVICE_COLORS: Record<ServiceType, { bg: string; text: string }> = {
  livraison: { bg: "rgba(59,130,246,0.1)", text: "#2563eb" },
  pickup: { bg: "rgba(16,185,129,0.1)", text: "#059669" },
  echange: { bg: "rgba(245,158,11,0.1)", text: "#d97706" },
  recouvrement: { bg: "rgba(168,85,247,0.1)", text: "#7c3aed" },
};

/* ── delivered item type ─────────────────────────────────── */
interface DeliveredItem {
  id: number;
  tracking_number: string;
  recipient_name: string;
  recipient_phone: string;
  cod_amount: number;
  shipping_cost: number;
  delivered_at: string;
}

/* ── toast component ─────────────────────────────────────── */
function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 99999,
      display: "flex", alignItems: "center", gap: 10,
      padding: "14px 22px", borderRadius: 12,
      background: type === "success" ? "#059669" : "#dc2626",
      color: "#fff", fontSize: 14, fontWeight: 600,
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      animation: "slideIn 0.3s ease-out",
    }}>
      {type === "success"
        ? <CheckCircle2 size={18} />
        : <AlertTriangle size={18} />
      }
      {message}
    </div>
  );
}

/* ── comprehensive confirm modal ─────────────────────────── */
function ConfirmModal({
  pkg, t, onClose, onConfirm, confirming,
}: {
  pkg: Package; t: Tokens; onClose: () => void;
  onConfirm: () => void; confirming: boolean;
}) {
  const totalToCollect = (pkg.cod_amount || 0) + (pkg.payment_type === "recipient" ? (pkg.shipping_cost || 0) : 0);
  const sc = SERVICE_COLORS[pkg.service_type] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };

  const sectionStyle: React.CSSProperties = {
    padding: "14px 16px", borderRadius: 10,
    border: `1px solid ${t.border}`, marginBottom: 12,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8,
    display: "flex", alignItems: "center", gap: 6,
  };
  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0",
    fontSize: 13,
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
          width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(34,197,94,0.1)",
            }}>
              <CheckCircle2 size={22} style={{ color: "#16a34a" }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>Confirmer la livraison</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Retrait client au stop desk</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: "pointer", color: t.textMuted,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Tracking (centered, prominent) */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", color: t.text, letterSpacing: "1px" }}>
            {pkg.tracking_number}
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: sc.bg, color: sc.text,
            }}>
              {SERVICE_LABELS[pkg.service_type] ?? pkg.service_type}
            </span>
            {pkg.delivery_type === "stop_desk" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: "rgba(99,102,241,0.1)", color: "#4f46e5",
              }}>
                <Building2 size={11} /> Stop Desk
              </span>
            )}
          </div>
        </div>

        {/* Section 2: Expéditeur */}
        <div style={sectionStyle}>
          <div style={labelStyle}><User size={12} /> Expéditeur</div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Nom</span>
            <span style={{ fontWeight: 600, color: t.text }}>{pkg.sender_name}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Téléphone</span>
            <span style={{ color: t.text }}>{pkg.sender_phone}</span>
          </div>
        </div>

        {/* Section 3: Destinataire */}
        <div style={sectionStyle}>
          <div style={labelStyle}><MapPin size={12} /> Destinataire</div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Nom</span>
            <span style={{ fontWeight: 600, color: t.text }}>{pkg.recipient_name}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Téléphone</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: t.text }}>
              {pkg.recipient_phone}
              <CheckCircle2 size={14} style={{ color: "#16a34a" }} />
            </span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Wilaya</span>
            <span style={{ color: t.text }}>{pkg.recipient_wilaya?.name ?? "—"}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Commune</span>
            <span style={{ color: t.text }}>{pkg.recipient_commune?.name ?? "—"}</span>
          </div>
        </div>

        {/* Section 4: Détails du colis */}
        <div style={sectionStyle}>
          <div style={labelStyle}><Package2 size={12} /> Détails du colis</div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Contenu</span>
            <span style={{ color: t.text }}>{pkg.content_description || "—"}</span>
          </div>
          {pkg.weight != null && pkg.weight > 0 && (
            <div style={rowStyle}>
              <span style={{ color: t.textMuted }}>Poids</span>
              <span style={{ color: t.text }}>{pkg.weight} kg</span>
            </div>
          )}
          {pkg.fragile && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 6,
              padding: "6px 10px", borderRadius: 8,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            }}>
              <ShieldAlert size={14} style={{ color: "#dc2626" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>FRAGILE — Manipuler avec précaution</span>
            </div>
          )}
          {pkg.special_instructions && (
            <div style={{
              marginTop: 8, padding: "8px 12px", borderRadius: 8,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", marginBottom: 4 }}>
                Instructions spéciales
              </div>
              <div style={{ fontSize: 12, color: t.text }}>{pkg.special_instructions}</div>
            </div>
          )}
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Type livraison</span>
            <span style={{ color: t.text }}>
              {pkg.delivery_type === "home_delivery" ? "Domicile" : "Stop Desk"}
            </span>
          </div>
          {pkg.service_type === "echange" && pkg.exchange_product && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 6,
              padding: "6px 10px", borderRadius: 8,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
            }}>
              <ArrowRightLeft size={14} style={{ color: "#d97706" }} />
              <span style={{ fontSize: 12, color: t.text }}>
                <strong>Produit à échanger:</strong> {pkg.exchange_product}
              </span>
            </div>
          )}
        </div>

        {/* Section 5: Paiement (green-bordered) */}
        <div style={{
          ...sectionStyle,
          borderColor: "rgba(34,197,94,0.3)",
          background: "rgba(34,197,94,0.03)",
          marginBottom: 20,
        }}>
          <div style={labelStyle}><CreditCard size={12} style={{ color: "#16a34a" }} /> Paiement</div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Type paiement</span>
            <span style={{ fontWeight: 600, color: t.text }}>
              {pkg.payment_type === "sender" ? "Expéditeur" : "Destinataire"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Montant COD</span>
            <span style={{ fontWeight: 700, color: t.text }}>{formatDA(pkg.cod_amount)}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Frais livraison</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: t.text }}>
              {formatDA(pkg.shipping_cost)}
              {pkg.payment_type === "recipient" && pkg.shipping_cost > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999,
                  background: "rgba(34,197,94,0.1)", color: "#16a34a",
                }}>
                  à encaisser
                </span>
              )}
            </span>
          </div>
          <div style={{
            borderTop: `1px solid rgba(34,197,94,0.2)`,
            paddingTop: 12, marginTop: 8,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: t.textMuted }}>TOTAL À ENCAISSER</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: "#16a34a" }}>
              {formatDA(totalToCollect)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            disabled={confirming}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: t.iconBg, color: t.textSub,
              border: `1px solid ${t.border}`, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            style={{
              flex: 2, padding: "12px 0", borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: confirming ? "#86efac" : "#16a34a",
              color: "#fff", border: "none", cursor: confirming ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s",
            }}
          >
            {confirming
              ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              : <CheckCircle2 size={16} />
            }
            {confirming ? "Livraison en cours..." : "Confirmer Livraison"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── package card ────────────────────────────────────────── */
function PackageCard({
  pkg, t, onDeliver, removing,
}: {
  pkg: Package; t: Tokens; onDeliver: (pkg: Package) => void; removing: number | null;
}) {
  const days = daysWaiting(pkg);
  const isRemoving = removing === pkg.id;

  const statusColor = STATUS_COLORS[pkg.status] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#6b7280" };

  return (
    <div style={{
      background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
      boxShadow: t.shadow, padding: 20, transition: "all 0.4s ease",
      opacity: isRemoving ? 0 : 1,
      transform: isRemoving ? "translateX(60px) scale(0.95)" : "translateX(0) scale(1)",
    }}>
      {/* Top row: tracking + status + days warning */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: "monospace", fontSize: 15, fontWeight: 800, color: t.text,
            letterSpacing: "0.5px",
          }}>
            {pkg.tracking_number}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: statusColor.bg, color: statusColor.text, whiteSpace: "nowrap",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor.dot, flexShrink: 0 }} />
            {STATUS_LABELS[pkg.status] ?? pkg.status}
          </span>
          {pkg.fragile && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
              background: "rgba(239,68,68,0.1)", color: "#dc2626",
            }}>
              <ShieldAlert size={11} /> Fragile
            </span>
          )}
        </div>
        {days !== null && days > 7 && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: "rgba(245,158,11,0.12)", color: "#d97706",
            border: "1px solid rgba(245,158,11,0.25)",
          }}>
            <AlertTriangle size={12} />
            {days} jours
          </span>
        )}
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 16 }}>
        {/* Sender */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
            Expéditeur
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{pkg.sender_name}</div>
          <div style={{ fontSize: 11, color: t.textMuted }}>{pkg.sender_phone}</div>
        </div>

        {/* Destination */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
            Destination
          </div>
          <div style={{ fontSize: 13, color: t.textSub }}>{pkg.recipient_wilaya?.name ?? "—"}</div>
          <div style={{ fontSize: 11, color: t.textMuted }}>{pkg.recipient_commune?.name ?? ""}</div>
        </div>

        {/* Content */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
            Contenu
          </div>
          <div style={{ fontSize: 13, color: t.textSub }}>{pkg.content_description || "—"}</div>
        </div>

        {/* Delivery type */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
            Type livraison
          </div>
          <div style={{ fontSize: 13, color: t.textSub, display: "flex", alignItems: "center", gap: 5 }}>
            <Truck size={13} style={{ color: t.textFaint }} />
            {pkg.delivery_type === "home_delivery" ? "Domicile" : "Stop Desk"}
          </div>
        </div>
      </div>

      {/* Bottom: COD amount + LIVRER button */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: `1px solid ${t.divider}`, paddingTop: 14,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
            Montant COD
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a" }}>
            {formatDA(pkg.cod_amount)}
          </div>
          {pkg.payment_type === "recipient" && pkg.shipping_cost > 0 && (
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
              + {formatDA(pkg.shipping_cost)} frais livraison
            </div>
          )}
        </div>
        <button
          onClick={() => onDeliver(pkg)}
          style={{
            padding: "12px 32px", borderRadius: 10, fontSize: 15, fontWeight: 800,
            background: "#16a34a", color: "#fff", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            transition: "all 0.15s",
            boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#15803d"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#16a34a"; }}
        >
          <CheckCircle2 size={18} />
          LIVRER
        </button>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function RetraitClientPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // SD context
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const sdLoaded = useRef(false);

  // State
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [confirmPkg, setConfirmPkg] = useState<Package | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [delivered, setDelivered] = useState<DeliveredItem[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load stop desks
  useEffect(() => {
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); sdLoaded.current = true; return; }
        const saved = localStorage.getItem(RETRAIT_SD_KEY);
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

  // Persist SD selection
  useEffect(() => {
    if (selectedSD !== null) localStorage.setItem(RETRAIT_SD_KEY, String(selectedSD));
  }, [selectedSD]);

  // Detect input type for icon
  const inputIsTracking = isTrackingNumber(query.trim());

  // Search
  const doSearch = useCallback(async (value: string) => {
    const cleaned = value.trim();
    if (cleaned.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    const res = await searchForRetrait(cleaned, selectedSD ?? undefined);
    if (res.success && res.data) {
      setResults(res.data);
    } else {
      setResults([]);
    }
    setLoading(false);
  }, [selectedSD]);

  // Debounce input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  };

  // Clear
  const handleClear = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  // Deliver flow
  const handleDeliverClick = (pkg: Package) => {
    setConfirmPkg(pkg);
  };

  const handleConfirmDeliver = async () => {
    if (!confirmPkg) return;
    setConfirming(true);
    const res = await deliverPackage(confirmPkg.id, confirmPkg.recipient_phone);
    if (res.success) {
      setConfirmPkg(null);
      setConfirming(false);

      // Add to delivered list
      const item: DeliveredItem = {
        id: confirmPkg.id,
        tracking_number: confirmPkg.tracking_number,
        recipient_name: confirmPkg.recipient_name,
        recipient_phone: confirmPkg.recipient_phone,
        cod_amount: confirmPkg.cod_amount,
        shipping_cost: confirmPkg.shipping_cost,
        delivered_at: new Date().toISOString(),
      };
      setDelivered(prev => [item, ...prev].slice(0, 10));

      // Animate removal
      setRemovingId(confirmPkg.id);
      setTimeout(() => {
        setResults(prev => prev.filter(p => p.id !== confirmPkg.id));
        setRemovingId(null);
      }, 450);

      setToast({ message: `Colis ${confirmPkg.tracking_number} livré avec succès`, type: "success" });
    } else {
      setConfirming(false);
      const errorMsg = (res as any).error || (res as any).message || "Erreur lors de la livraison";
      setToast({ message: errorMsg, type: "error" });
    }
  };

  // Ready packages only
  const readyPackages = results.filter(
    p => p.status === "pret_pour_retrait" || p.status === "arrive_destination" || p.status === "pret_pour_chauffeur"
  );

  return (
    <div style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(34,197,94,0.1)",
        }}>
          <UserCheck size={22} style={{ color: "#16a34a" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text, margin: 0 }}>Retrait Client</h1>
          <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>Recherche et livraison des colis</p>
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
            Choisissez le stop desk de destination pour rechercher les colis à livrer.
          </div>
        </div>
      )}

      {selectedSD && (
        <>
          {/* Smart search input (phone + tracking) */}
          <div style={{
            background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
            boxShadow: t.shadow, padding: 24, marginBottom: 24,
          }}>
            <div style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
              {inputIsTracking ? (
                <Hash size={22} style={{
                  position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                  color: "#f97316",
                }} />
              ) : (
                <Phone size={22} style={{
                  position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                  color: query ? "#16a34a" : t.textFaint,
                }} />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Numéro de téléphone ou tracking..."
                style={{
                  width: "100%", background: t.inp.bg,
                  border: `2px solid ${query ? "#16a34a" : t.inp.border}`,
                  borderRadius: 14, padding: "16px 52px 16px 50px",
                  fontSize: 24, fontFamily: "monospace", fontWeight: 600,
                  color: t.inp.text, outline: "none",
                  transition: "border-color 0.2s",
                  textAlign: "center",
                }}
              />
              {query && (
                <button
                  onClick={handleClear}
                  style={{
                    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                    width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: t.iconBg, border: "none", cursor: "pointer", color: t.textMuted,
                    transition: "all 0.15s",
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {/* Input type indicator */}
            {query.length >= 2 && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: t.textFaint,
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                  {inputIsTracking ? (
                    <><Hash size={12} /> Recherche par tracking</>
                  ) : (
                    <><Phone size={12} /> Recherche par téléphone</>
                  )}
                </span>
              </div>
            )}
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: t.textMuted }} />
              </div>
            )}
          </div>

          {/* Results */}
          {!loading && searched && readyPackages.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
              }}>
                <Package2 size={16} style={{ color: t.textMuted }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  {readyPackages.length} colis prêt{readyPackages.length > 1 ? "s" : ""} pour retrait
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {readyPackages.map(pkg => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    t={t}
                    onDeliver={handleDeliverClick}
                    removing={removingId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state: no query entered */}
          {!loading && !searched && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "60px 20px",
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center",
                background: t.iconBg, marginBottom: 18,
              }}>
                <Search size={32} style={{ color: t.textFaint }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>
                Rechercher un client
              </div>
              <div style={{ fontSize: 13, color: t.textFaint, textAlign: "center", maxWidth: 340 }}>
                Saisissez le numéro de téléphone du destinataire ou un numéro de tracking pour afficher les colis disponibles au retrait.
              </div>
            </div>
          )}

          {/* Empty state: searched but no results */}
          {!loading && searched && readyPackages.length === 0 && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "60px 20px",
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(239,68,68,0.08)", marginBottom: 18,
              }}>
                <PackageOpen size={32} style={{ color: "#ef4444" }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>
                Aucun colis disponible
              </div>
              <div style={{ fontSize: 13, color: t.textFaint, textAlign: "center", maxWidth: 340 }}>
                Aucun colis prêt pour retrait n'a été trouvé pour cette recherche.
              </div>
            </div>
          )}

          {/* Recently delivered section */}
          {delivered.length > 0 && (
            <div style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              boxShadow: t.shadow, overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "14px 20px", borderBottom: `1px solid ${t.divider}`,
              }}>
                <Clock size={15} style={{ color: t.textMuted }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  Livrés aujourd'hui
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: "rgba(34,197,94,0.1)", color: "#16a34a",
                }}>
                  {delivered.length}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{
                        padding: "8px 16px", fontSize: 10, fontWeight: 700, color: t.textMuted,
                        textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "left",
                        borderBottom: `1px solid ${t.divider}`,
                      }}>
                        Tracking
                      </th>
                      <th style={{
                        padding: "8px 16px", fontSize: 10, fontWeight: 700, color: t.textMuted,
                        textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "left",
                        borderBottom: `1px solid ${t.divider}`,
                      }}>
                        Destinataire
                      </th>
                      <th style={{
                        padding: "8px 16px", fontSize: 10, fontWeight: 700, color: t.textMuted,
                        textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "left",
                        borderBottom: `1px solid ${t.divider}`,
                      }}>
                        Heure
                      </th>
                      <th style={{
                        padding: "8px 16px", fontSize: 10, fontWeight: 700, color: t.textMuted,
                        textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right",
                        borderBottom: `1px solid ${t.divider}`,
                      }}>
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {delivered.map(item => (
                      <tr key={item.id}>
                        <td style={{
                          padding: "10px 16px", fontSize: 12, fontFamily: "monospace", fontWeight: 700,
                          color: t.text, borderBottom: `1px solid ${t.divider}`,
                        }}>
                          {item.tracking_number}
                        </td>
                        <td style={{
                          padding: "10px 16px", borderBottom: `1px solid ${t.divider}`,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{item.recipient_name}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{item.recipient_phone}</div>
                        </td>
                        <td style={{
                          padding: "10px 16px", fontSize: 12, color: t.textMuted,
                          borderBottom: `1px solid ${t.divider}`,
                        }}>
                          {formatTime(item.delivered_at)}
                        </td>
                        <td style={{
                          padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#16a34a",
                          textAlign: "right", borderBottom: `1px solid ${t.divider}`,
                        }}>
                          {formatDA(item.cod_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirm modal */}
      {confirmPkg && (
        <ConfirmModal
          pkg={confirmPkg}
          t={t}
          onClose={() => { if (!confirming) setConfirmPkg(null); }}
          onConfirm={handleConfirmDeliver}
          confirming={confirming}
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

      {/* Keyframe animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
