"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RotateCcw, RefreshCw, Search, X, Loader2, Package2,
  MapPin, Truck, User, Clock, Plus, Send, PackageOpen, Lock,
  ScanLine, ArrowRight, ArrowLeft, Building2, ArrowUpRight,
  ArrowDownLeft, Check, CheckCircle2, Phone, AlertTriangle,
  Banknote, Eye, XCircle,
} from "lucide-react";
import {
  getBags, getBag, createBag, addPackageToBag, sealBag, startBagTransit,
  receiveBag, unpackBag, cancelBag,
  type Bag, type BagStatus, BAG_STATUS_LABELS, BAG_STATUS_COLORS,
} from "@/lib/bags";
import {
  getPackages, type Package as Pkg, STATUS_LABELS, STATUS_COLORS,
  type PackageStatus, getPackageStats, type PackageStats,
  searchForReturnPickup, returnPickupPackage, bulkReturnPickup, declareEchec,
} from "@/lib/packages";
import { api, getStoredUser, isSDLocked, getLockedSDId } from "@/lib/api";
import { getWalletByPhone, type WalletWithUser } from "@/lib/wallet";
import SDSelector from "@/components/SDSelector";

/* ── theme (same as sacs page) ────────────────────────────── */
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
    danger: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", text: "#ef4444" },
    success: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", text: "#22c55e" },
    warning: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", text: "#f59e0b" },
    purple: { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.2)", text: "#a855f7" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6",
    rowHover: "#f9fafb", text: "#111827", textSub: "#374151", textMuted: "#6b7280",
    textFaint: "#9ca3af", shadow: "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    modalBg: "#ffffff", overlay: "rgba(0,0,0,0.35)",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    chipActive: { bg: "rgba(249,115,22,0.1)", text: "#ea580c", border: "#f97316" },
    chipDefault: { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" },
    iconBg: "#f3f4f6",
    danger: { bg: "rgba(239,68,68,0.05)", border: "rgba(239,68,68,0.15)", text: "#dc2626" },
    success: { bg: "rgba(34,197,94,0.05)", border: "rgba(34,197,94,0.15)", text: "#16a34a" },
    warning: { bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.15)", text: "#d97706" },
    purple: { bg: "rgba(168,85,247,0.05)", border: "rgba(168,85,247,0.15)", text: "#9333ea" },
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── types ─────────────────────────────────────────────────── */
interface SDOption {
  id: number; name: string; code: string | null; type: string; commune_id: number;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

type Direction = "expedition" | "retrait";

const SD_LS_KEY = "retour_selected_sd";
const AUTO_SCAN_DELAY = 600;

/* ── helper components ────────────────────────────────────── */
function Chip({ label, active, count, onClick, t }: {
  label: string; active: boolean; count?: number; onClick: () => void; t: Tokens;
}) {
  const s = active ? t.chipActive : t.chipDefault;
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
      transition: "all 150ms",
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? "rgba(249,115,22,0.2)" : "rgba(107,114,128,0.15)",
          padding: "1px 7px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
        }}>{count}</span>
      )}
    </button>
  );
}

function PkgStatusBadge({ status, t }: { status: PackageStatus; t: Tokens }) {
  const c = STATUS_COLORS[status] ?? { bg: t.chipDefault.bg, text: t.textMuted, dot: t.textMuted };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, color: c.text, padding: "3px 10px", borderRadius: 9999,
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function BagStatusBadge({ status, t }: { status: BagStatus; t: Tokens }) {
  const c = BAG_STATUS_COLORS[status] ?? { bg: t.chipDefault.bg, text: t.textMuted, dot: t.textMuted };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, color: c.text, padding: "3px 10px", borderRadius: 9999,
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />
      {BAG_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "success" ? "#16a34a" : "#dc2626";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: bg, color: "#fff", padding: "12px 20px", borderRadius: 12,
      fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", gap: 8, maxWidth: 400,
    }}>
      {type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {message}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}>
        <X size={14} />
      </button>
    </div>
  );
}

/* ── Return Pickup Modal (single + bulk) ──────────────────── */
function ReturnPickupModal({ pkg, t, onClose, onConfirm, onBulkConfirm }: {
  pkg: Pkg & { _bulkIds?: number[]; _bulkCount?: number; _bulkCost?: number };
  t: Tokens; onClose: () => void;
  onConfirm: (pkgId: number, phone: string) => Promise<void>;
  onBulkConfirm: (ids: number[], phone: string) => Promise<void>;
}) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isBulk = !!(pkg as any)._bulkIds;
  const bulkIds: number[] = (pkg as any)._bulkIds ?? [pkg.id];
  const bulkCount = (pkg as any)._bulkCount ?? 1;
  const bulkCost = (pkg as any)._bulkCost ?? (pkg.return_cost ?? 0);

  async function handleConfirm() {
    if (!phone.trim()) { setError("Veuillez saisir le numéro de téléphone de l'expéditeur."); return; }
    setLoading(true); setError("");
    try {
      if (isBulk) {
        await onBulkConfirm(bulkIds, phone.trim());
      } else {
        await onConfirm(pkg.id, phone.trim());
      }
      onClose();
    } catch (e: any) {
      setError(e?.message || "Erreur lors du retrait.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      background: t.overlay,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, borderRadius: 16, width: "100%", maxWidth: 480,
        border: `1px solid ${t.border}`, boxShadow: t.shadow, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${t.divider}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            background: t.purple.bg,
          }}>
            <RotateCcw size={18} style={{ color: t.purple.text }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Retrait Expéditeur</h3>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
              {isBulk ? `${bulkCount} colis` : pkg.tracking_number}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", color: t.textMuted,
            padding: 4, borderRadius: 8,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Package info */}
          <div style={{
            background: t.iconBg, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Expéditeur</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{pkg.sender_name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Téléphone</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{pkg.sender_phone}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Contenu</span>
              <span style={{ fontSize: 13, color: t.textSub }}>{pkg.content_description}</span>
            </div>
            {bulkCost > 0 && (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                paddingTop: 8, borderTop: `1px solid ${t.divider}`, marginTop: 4,
              }}>
                <span style={{ fontSize: 12, color: t.warning.text, fontWeight: 600 }}>
                  Frais de retour à collecter {isBulk ? `(${bulkCount} colis)` : ""}
                </span>
                <span style={{
                  fontSize: 15, fontWeight: 700, color: t.warning.text,
                  background: t.warning.bg, padding: "2px 10px", borderRadius: 8,
                }}>{bulkCost} DA</span>
              </div>
            )}
          </div>

          {/* Phone verification */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>
              Vérification — Numéro de téléphone de l'expéditeur
            </label>
            <div style={{ position: "relative" }}>
              <Phone size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ex: 0555123456"
                autoFocus
                style={{
                  width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10,
                  border: `1px solid ${error ? t.danger.border : t.inp.border}`,
                  background: t.inp.bg, color: t.inp.text, fontSize: 14,
                  outline: "none", boxSizing: "border-box",
                }}
                onKeyDown={e => { if (e.key === "Enter") handleConfirm(); }}
              />
            </div>
            {error && <p style={{ margin: "6px 0 0", fontSize: 12, color: t.danger.text }}>{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${t.divider}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 10, border: `1px solid ${t.border}`,
            background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Annuler</button>
          <button onClick={handleConfirm} disabled={loading} style={{
            padding: "9px 18px", borderRadius: 10, border: "none",
            background: "#9333ea", color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirmer le retrait
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Transit Driver Select Modal ──────────────────────────── */
function TransitDriverModal({ bag, t, onClose, onConfirm }: {
  bag: Bag; t: Tokens; onClose: () => void;
  onConfirm: (bagId: number, driverId: number) => Promise<void>;
}) {
  const [drivers, setDrivers] = useState<{ id: number; first_name: string; last_name: string }[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ id: number; first_name: string; last_name: string }[]>("/users?user_type=transit_chauffeur").then(res => {
      if (res.success && res.data) setDrivers(res.data);
    });
  }, []);

  async function handleConfirm() {
    if (!selectedDriver) return;
    setLoading(true);
    try {
      await onConfirm(bag.id, selectedDriver);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      background: t.overlay,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, borderRadius: 16, width: "100%", maxWidth: 420,
        border: `1px solid ${t.border}`, boxShadow: t.shadow, overflow: "hidden",
      }}>
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${t.divider}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Truck size={18} style={{ color: t.chipActive.text }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Choisir un livreur transit</h3>
        </div>
        <div style={{ padding: 24 }}>
          <select value={selectedDriver ?? ""} onChange={e => setSelectedDriver(Number(e.target.value))} style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 14,
          }}>
            <option value="">Sélectionner...</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
          </select>
        </div>
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${t.divider}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 10, border: `1px solid ${t.border}`,
            background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Annuler</button>
          <button onClick={handleConfirm} disabled={loading || !selectedDriver} style={{
            padding: "9px 18px", borderRadius: 10, border: "none",
            background: "#f97316", color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: (loading || !selectedDriver) ? "not-allowed" : "pointer", opacity: (loading || !selectedDriver) ? 0.6 : 1,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Create Return Bag Modal ──────────────────────────────── */
function CreateReturnBagModal({ originSD, t, onClose, onCreate }: {
  originSD: number; t: Tokens; onClose: () => void;
  onCreate: (bag: Bag) => void;
}) {
  const [wilayas, setWilayas] = useState<{ id: number; name: string }[]>([]);
  const [destWilaya, setDestWilaya] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ id: number; name: string }[]>("/wilayas").then(res => {
      if (res.success && res.data) setWilayas(res.data);
    });
  }, []);

  async function handleCreate() {
    if (!destWilaya) return;
    setLoading(true);
    try {
      const res = await createBag({
        type: "retour",
        origin_stop_desk_id: originSD,
        destination_wilaya_id: destWilaya,
      });
      if (res.success && res.data) {
        onCreate(res.data);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      background: t.overlay,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, borderRadius: 16, width: "100%", maxWidth: 420,
        border: `1px solid ${t.border}`, boxShadow: t.shadow, overflow: "hidden",
      }}>
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${t.divider}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Plus size={18} style={{ color: t.purple.text }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Nouveau Sac Retour</h3>
        </div>
        <div style={{ padding: 24 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>
            Wilaya de destination (origine du colis)
          </label>
          <select value={destWilaya ?? ""} onChange={e => setDestWilaya(Number(e.target.value))} style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 14,
          }}>
            <option value="">Sélectionner une wilaya...</option>
            {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${t.divider}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 10, border: `1px solid ${t.border}`,
            background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Annuler</button>
          <button onClick={handleCreate} disabled={loading || !destWilaya} style={{
            padding: "9px 18px", borderRadius: 10, border: "none",
            background: "#9333ea", color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: (loading || !destWilaya) ? "not-allowed" : "pointer", opacity: (loading || !destWilaya) ? 0.6 : 1,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*                    MAIN PAGE                              */
/* ═══════════════════════════════════════════════════════════ */
export default function RetourPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // SD context
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const sdLoaded = useRef(false);
  const [direction, setDirection] = useState<Direction>("expedition");

  const selectedSDObj = stopDesks.find(sd => sd.id === selectedSD);
  const selectedWilayaId = selectedSDObj?.commune?.wilaya_id ?? null;

  // Data
  const [echecPackages, setEchecPackages] = useState<Pkg[]>([]);
  const [returnBags, setReturnBags] = useState<Bag[]>([]);
  const [retourArrivePackages, setRetourArrivePackages] = useState<Pkg[]>([]);
  const [stats, setStats] = useState<PackageStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Bag details (with packages list)
  const [bagDetails, setBagDetails] = useState<Record<number, Bag>>({});

  // Transit driver selection for sending bags
  const [transitDrivers, setTransitDrivers] = useState<{ id: number; first_name: string; last_name: string; phone: string | null }[]>([]);
  const [transitBagId, setTransitBagId] = useState<number | null>(null);
  const [transitDriverId, setTransitDriverId] = useState<number | null>(null);
  const [transitSending, setTransitSending] = useState(false);

  async function loadBagDetail(bagId: number) {
    const res = await getBag(bagId);
    if (res.success && res.data) {
      setBagDetails(prev => ({ ...prev, [bagId]: res.data! }));
    }
  }

  // Modals
  const [showCreateBag, setShowCreateBag] = useState(false);
  const [transitBag, setTransitBag] = useState<Bag | null>(null);
  const [pickupPkg, setPickupPkg] = useState<Pkg | null>(null);

  // Scan
  const [scanInput, setScanInput] = useState("");
  const [scanBagId, setScanBagId] = useState<number | null>(null);
  const [scanFlash, setScanFlash] = useState<"" | "success" | "error">("");
  const scanRef = useRef<HTMLInputElement>(null);
  const scanTimerRef = useRef<NodeJS.Timeout>(undefined);

  // Search (retrait)
  const [searchQuery, setSearchQuery] = useState("");
  const [echecSearch, setEchecSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Pkg[]>([]);
  const [searching, setSearching] = useState(false);

  // Wallet balances by phone
  const [walletCache, setWalletCache] = useState<Record<string, WalletWithUser | null>>({});

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load stop desks
  useEffect(() => {
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); sdLoaded.current = true; return; }
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
    // Load transit drivers
    api<{ id: number; first_name: string; last_name: string; phone: string | null }[]>("/users?type=transit_chauffeur").then(res => {
      if (res.success && res.data) setTransitDrivers(res.data);
    });
  }, []);

  useEffect(() => {
    if (selectedSD !== null) localStorage.setItem(SD_LS_KEY, String(selectedSD));
  }, [selectedSD]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!selectedSD) return;
    const res = await getPackageStats(
      direction === "expedition"
        ? { destination_stop_desk_id: selectedSD }
        : { origin_stop_desk_id: selectedSD }
    );
    if (res.success && res.data) setStats(res.data);
  }, [selectedSD, direction]);

  // Fetch data based on direction
  const fetchData = useCallback(async () => {
    if (!selectedSD) { setLoading(false); return; }
    setLoading(true);
    try {
      if (direction === "expedition") {
        // Fetch échec_livraison packages at this destination SD
        const [pkgRes, bagRes] = await Promise.all([
          // échec at destination + échange retour at origin (where it was created)
          Promise.all([
            getPackages({ status: "echec_livraison", destination_stop_desk_id: selectedSD, per_page: 100 }),
            getPackages({ status: "echange_retour", origin_stop_desk_id: selectedSD, per_page: 100 }),
            getPackages({ status: "externe_retour", include_external: true, per_page: 100 } as any),
          ]).then(([a, b, c]) => ({
            success: true,
            data: { data: [...(a.data?.data ?? []), ...(b.data?.data ?? []), ...(c.data?.data ?? [])] },
          })),
          getBags({ type: "retour", origin_stop_desk_id: selectedSD, status: "cree,scelle,en_transit", per_page: 100 }),
        ]);
        if (pkgRes.success && pkgRes.data) setEchecPackages(pkgRes.data.data);
        if (bagRes.success && bagRes.data) {
          setReturnBags(bagRes.data.data);
          bagRes.data.data.forEach(b => loadBagDetail(b.id));
        }
      } else {
        // Retrait: fetch incoming return bags + retour_arrive packages at origin SD
        // Exclude bags originating from this SD (those are outgoing, not incoming)
        const [bagRes, pkgRes] = await Promise.all([
          getBags({
            type: "retour",
            destination_wilaya_id: selectedWilayaId ?? undefined,
            status: "en_transit,recu",
            per_page: 100,
          }),
          getPackages({ status: "retour_arrive,externe_retour", destination_stop_desk_id: selectedSD, per_page: 100 }),
        ]);
        if (bagRes.success && bagRes.data) {
          // Filter: exclude own outgoing bags, and only show bags targeted to this SD
          // If bag has destination_stop_desk_id set → must match selected SD
          // If bag has no destination_stop_desk_id → only show at hub-type SDs (wilaya-level routing)
          const currentSD = stopDesks.find(sd => sd.id === selectedSD);
          const isHub = currentSD?.type === "hub";
          const incomingOnly = bagRes.data.data.filter(b => {
            if (b.origin_stop_desk_id === selectedSD) return false; // exclude own bags
            if (b.destination_stop_desk_id) return b.destination_stop_desk_id === selectedSD;
            return isHub; // wilaya-level bags only visible at hubs
          });
          setReturnBags(incomingOnly);
        }
        if (pkgRes.success && pkgRes.data) {
          setRetourArrivePackages(pkgRes.data.data);
          // Fetch wallet balances for unique sender phones
          const phones = [...new Set(pkgRes.data.data.map(p => p.sender_phone))];
          phones.forEach(phone => {
            if (!walletCache[phone]) {
              getWalletByPhone(phone).then(r => {
                if (r.success) setWalletCache(prev => ({ ...prev, [phone]: r.data ?? null }));
              });
            }
          });
        }
      }
    } finally {
      setLoading(false);
    }
    fetchStats();
  }, [selectedSD, direction, selectedWilayaId, fetchStats]);

  useEffect(() => { if (sdLoaded.current) fetchData(); }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // ── Smart return scan — auto-create bags by destination SD ─
  const [smartReturnInput, setSmartReturnInput] = useState("");
  const [smartReturnScanning, setSmartReturnScanning] = useState(false);
  const [smartReturnFlash, setSmartReturnFlash] = useState<"" | "success" | "error">("");
  const [smartReturnMsg, setSmartReturnMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const smartReturnTimerRef = useRef<NodeJS.Timeout>(undefined);

  // Track auto-created return bags: keyed by destination SD id
  const [autoReturnBags, setAutoReturnBags] = useState<Record<number, {
    bag: Bag; sdName: string; wilayaName: string; count: number; packages: string[];
  }>>({});

  async function handleSmartReturnScan(tracking: string) {
    if (!tracking.trim() || !selectedSD || smartReturnScanning) return;
    setSmartReturnScanning(true);
    setSmartReturnMsg(null);
    try {
      // Find the package — must be at échec_livraison
      const pkgRes = await api<{ data: Pkg[] }>(`/packages?search=${encodeURIComponent(tracking.trim())}&status=echec_livraison,echange_retour,externe_retour&per_page=1&include_external=1`);
      const pkg = (pkgRes as any).data?.data?.[0];
      if (!pkg) {
        // Also try by DHD external tracking
        const extRes = await api<any>(`/packages?search=${encodeURIComponent(tracking.trim())}&status=externe_retour&include_external=1&per_page=1`);
        const extPkg = (extRes as any).data?.data?.[0];
        if (extPkg) {
          // Found via search — use it
          Object.assign(pkg ?? {}, extPkg);
        }
      }
      if (!pkg) {
        setSmartReturnFlash("error");
        setSmartReturnMsg({ type: "error", text: `Colis introuvable ou pas en retour` });
        setTimeout(() => setSmartReturnFlash(""), 1500);
        setSmartReturnInput("");
        setSmartReturnScanning(false);
        return;
      }

      // For échec: return to origin SD (where expéditeur is)
      // For échange_retour: return to destination SD (already set correctly in ECH package)
      const isEchangeRetour = pkg.status === "echange_retour";
      const destSDId = isEchangeRetour ? pkg.destination_stop_desk_id : pkg.origin_stop_desk_id;
      const destSD = isEchangeRetour ? pkg.destination_stop_desk : pkg.origin_stop_desk;
      const destSDName = destSD?.name ?? `SD-${destSDId}`;
      const destWilayaId = destSD?.commune?.wilaya_id ?? destSD?.commune?.wilaya?.id ?? pkg.recipient_wilaya_id ?? 0;
      const destWilayaName = destSD?.commune?.wilaya?.name ?? "?";

      // Check if we have a bag for this destination SD
      let entry = autoReturnBags[destSDId];

      if (!entry) {
        // Create a new return bag destined to that SD
        const bagRes = await createBag({
          type: "retour",
          origin_stop_desk_id: selectedSD,
          destination_wilaya_id: destWilayaId,
          destination_stop_desk_id: destSDId,
        });
        if (!bagRes.success || !bagRes.data) {
          setSmartReturnFlash("error");
          setSmartReturnMsg({ type: "error", text: bagRes.message || "Erreur création sac retour" });
          setTimeout(() => setSmartReturnFlash(""), 1500);
          setSmartReturnInput("");
          setSmartReturnScanning(false);
          return;
        }
        entry = { bag: bagRes.data, sdName: destSDName, wilayaName: destWilayaName, count: 0, packages: [] };
        setAutoReturnBags(prev => ({ ...prev, [destSDId]: entry! }));
      }

      // Add package to that bag
      const addRes = await addPackageToBag(entry.bag.id, tracking.trim());
      if (addRes.success) {
        setSmartReturnFlash("success");
        setSmartReturnMsg({ type: "success", text: `${tracking} → ${destSDName} (${destWilayaName})` });
        setAutoReturnBags(prev => ({
          ...prev,
          [destSDId]: { ...prev[destSDId], count: prev[destSDId].count + 1, packages: [...prev[destSDId].packages, tracking.trim()] },
        }));
        fetchData();
      } else {
        setSmartReturnFlash("error");
        setSmartReturnMsg({ type: "error", text: addRes.message || "Erreur ajout colis" });
      }
    } catch (e: any) {
      setSmartReturnFlash("error");
      setSmartReturnMsg({ type: "error", text: e?.message || "Erreur réseau" });
    }
    setSmartReturnInput("");
    setTimeout(() => setSmartReturnFlash(""), 1500);
    setSmartReturnScanning(false);
  }

  // ── Bag actions ────────────────────────────────────────────
  async function handleSeal(bagId: number) {
    const res = await sealBag(bagId);
    if (res.success) {
      setToast({ message: "Sac scellé avec succès", type: "success" });
      // Remove from autoReturnBags since it's now scellé
      setAutoReturnBags(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[Number(key)]?.bag?.id === bagId) {
            delete next[Number(key)];
          }
        }
        return next;
      });
      fetchData();
    } else {
      setToast({ message: (res as any).message || "Erreur lors du scellement", type: "error" });
    }
  }

  async function handleStartTransit(bagId: number, driverId: number) {
    const res = await startBagTransit(bagId, driverId);
    if (res.success) { setToast({ message: "Sac en transit", type: "success" }); fetchData(); }
    else setToast({ message: res.message || "Erreur", type: "error" });
  }

  async function handleReceive(bagId: number) {
    const res = await receiveBag(bagId);
    if (res.success) { setToast({ message: "Sac reçu", type: "success" }); fetchData(); }
    else setToast({ message: res.message || "Erreur", type: "error" });
  }

  async function handleUnpack(bagId: number) {
    const res = await unpackBag(bagId);
    if (res.success) { setToast({ message: "Sac déballé — colis au statut 'Retour arrivé'", type: "success" }); fetchData(); }
    else setToast({ message: res.message || "Erreur", type: "error" });
  }

  async function handleCancel(bagId: number) {
    const res = await cancelBag(bagId);
    if (res.success) { setToast({ message: "Sac annulé", type: "success" }); fetchData(); }
    else setToast({ message: res.message || "Erreur", type: "error" });
  }

  // ── Return pickup ──────────────────────────────────────────
  async function handleReturnPickup(pkgId: number, phone: string) {
    const res = await returnPickupPackage(pkgId, phone);
    if (res.success) {
      setToast({ message: "Retrait confirmé — colis retourné à l'expéditeur", type: "success" });
      fetchData();
      setSearchResults(prev => prev.filter(p => p.id !== pkgId));
    } else {
      throw new Error(res.message || "Erreur");
    }
  }

  // ── Search for sender pickup ───────────────────────────────
  async function handleSearch() {
    if (!searchQuery.trim() || searchQuery.length < 3) return;
    setSearching(true);
    try {
      const res = await searchForReturnPickup(searchQuery.trim(), selectedSD ?? undefined);
      if (res.success && res.data) setSearchResults(res.data);
      else setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  // ── Pipeline counts ────────────────────────────────────────
  const pipelineExpedition = [
    { label: "Échec livraison", key: "echec_livraison" as const, color: STATUS_COLORS.echec_livraison },
    { label: "En sac retour", key: "retour_en_sac" as const, color: STATUS_COLORS.retour_en_sac },
    { label: "En transit retour", key: "retour_en_transit" as const, color: STATUS_COLORS.retour_en_transit },
  ];
  const pipelineRetrait = [
    { label: "En transit retour", key: "retour_en_transit" as const, color: STATUS_COLORS.retour_en_transit },
    { label: "Retour arrivé", key: "retour_arrive" as const, color: STATUS_COLORS.retour_arrive },
    { label: "Retourné", key: "retourne" as const, color: STATUS_COLORS.retourne },
  ];
  const pipeline = direction === "expedition" ? pipelineExpedition : pipelineRetrait;

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
            background: t.purple.bg, border: `1px solid ${t.purple.border}`,
          }}>
            <RotateCcw size={20} style={{ color: t.purple.text }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>
              Retours
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
              Gestion des colis en retour
            </p>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} style={{
          padding: "8px 16px", borderRadius: 10, border: `1px solid ${t.border}`,
          background: t.card, color: t.textSub, fontSize: 13, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Rafraîchir
        </button>
      </div>

      {/* ── Controls: SD selector + Direction toggle ──────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20, alignItems: "center",
      }}>
        {/* SD Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 200 }}>
          <SDSelector
            stopDesks={stopDesks}
            value={selectedSD}
            onChange={setSelectedSD}
            disabled={isSDLocked(getStoredUser())}
          />
        </div>

        {/* Direction toggle */}
        <div style={{
          display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${t.border}`,
        }}>
          {(["expedition", "retrait"] as const).map(d => (
            <button key={d} onClick={() => setDirection(d)} style={{
              padding: "8px 18px", border: "none", fontSize: 12, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              background: direction === d ? t.purple.bg : "transparent",
              color: direction === d ? t.purple.text : t.textMuted,
              transition: "all 150ms",
            }}>
              {d === "expedition" ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
              {d === "expedition" ? "Expédition retour" : "Retrait Expéditeur"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pipeline stats ────────────────────────────────── */}
      {selectedSD && stats && (
        <div style={{
          display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap",
        }}>
          {pipeline.map(p => {
            const count = stats[p.key] ?? 0;
            return (
              <div key={p.key} style={{
                flex: 1, minWidth: 140, padding: "14px 18px", borderRadius: 14,
                background: t.card, border: `1px solid ${t.border}`, boxShadow: t.shadow,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color.dot }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>{p.label}</span>
                </div>
                <span style={{ fontSize: 24, fontWeight: 800, color: p.color.text }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {!selectedSD && (
        <div style={{
          textAlign: "center", padding: "60px 0", color: t.textMuted, fontSize: 14,
        }}>
          <Building2 size={40} style={{ color: t.textFaint, marginBottom: 12 }} />
          <p>Sélectionnez un Stop Desk pour commencer</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           DIRECTION: Expédition retour — Smart Scan
         ══════════════════════════════════════════════════════ */}
      {selectedSD && direction === "expedition" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Smart Return Scan Zone */}
          <div style={{
            background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
            boxShadow: t.shadow, overflow: "hidden", borderLeft: `4px solid ${t.purple.text}`,
          }}>
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: t.purple.bg,
              }}>
                <ScanLine size={18} style={{ color: t.purple.text }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Scan & Attribution retour automatique</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>
                  Scannez un colis en échec — le sac retour est créé automatiquement par SD de destination
                </div>
              </div>
            </div>
            <div style={{ padding: "0 20px 16px" }}>
              <div style={{
                display: "flex", gap: 8,
                border: `2px solid ${smartReturnFlash === "success" ? t.success.border : smartReturnFlash === "error" ? t.danger.border : t.purple.border}`,
                borderRadius: 10, padding: 6,
                background: smartReturnFlash === "success" ? t.success.bg : smartReturnFlash === "error" ? t.danger.bg : "transparent",
                transition: "all 300ms",
              }}>
                <ScanLine size={14} style={{ color: t.purple.text, margin: "auto 4px auto 6px" }} />
                <input
                  placeholder="Scanner un tracking colis en échec (DLV-...)..."
                  value={smartReturnInput}
                  onChange={e => {
                    setSmartReturnInput(e.target.value);
                    if (smartReturnTimerRef.current) clearTimeout(smartReturnTimerRef.current);
                    if (/^DLV-\d{8}-[A-Z0-9]{6}$/i.test(e.target.value.trim())) {
                      smartReturnTimerRef.current = setTimeout(() => handleSmartReturnScan(e.target.value.trim()), AUTO_SCAN_DELAY);
                    }
                  }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (smartReturnTimerRef.current) clearTimeout(smartReturnTimerRef.current); handleSmartReturnScan(smartReturnInput); } }}
                  autoFocus
                  style={{
                    flex: 1, border: "none", outline: "none", background: "transparent",
                    color: t.text, fontSize: 14, fontWeight: 600, padding: "8px 4px",
                    fontFamily: "monospace",
                  }}
                />
                {smartReturnScanning && <Loader2 size={16} className="animate-spin" style={{ color: t.purple.text, margin: "auto 8px" }} />}
              </div>
              {smartReturnMsg && (
                <div style={{
                  marginTop: 8, fontSize: 12, fontWeight: 600,
                  color: smartReturnMsg.type === "success" ? t.success.text : t.danger.text,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {smartReturnMsg.type === "success" ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {smartReturnMsg.text}
                </div>
              )}
            </div>
          </div>

          {/* Auto-created return bags by destination SD */}
          {Object.keys(autoReturnBags).length > 0 && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {Object.values(autoReturnBags).map(entry => (
                <div key={entry.bag.id} style={{
                  flex: "1 1 260px", minWidth: 240, background: t.card, borderRadius: 14,
                  border: `1px solid ${t.border}`, boxShadow: t.shadow, overflow: "hidden",
                }}>
                  <div style={{
                    padding: "14px 16px", borderBottom: `1px solid ${t.divider}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{entry.sdName}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{entry.wilayaName} · {entry.bag.tracking_number}</div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                      background: t.purple.bg, color: t.purple.text,
                    }}>{entry.count} colis</span>
                  </div>
                  <div style={{ padding: "10px 16px", maxHeight: 150, overflowY: "auto" }}>
                    {entry.packages.map(tn => (
                      <div key={tn} style={{ fontSize: 11, color: t.textSub, fontFamily: "monospace", padding: "2px 0" }}>
                        {tn}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "10px 16px", borderTop: `1px solid ${t.divider}`, display: "flex", gap: 8 }}>
                    <button onClick={() => handleSeal(entry.bag.id)} disabled={entry.count === 0} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
                      background: entry.count > 0 ? "rgba(99,102,241,0.12)" : t.iconBg,
                      color: entry.count > 0 ? "#6366f1" : t.textFaint,
                      cursor: entry.count > 0 ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}>
                      <Check size={13} /> Sceller
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Existing return bags (scellé, en_transit, etc.) */}
          {returnBags.length > 0 && (
            <div style={{
              background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
              boxShadow: t.shadow, overflow: "hidden",
            }}>
              <div style={{
                padding: "16px 20px", borderBottom: `1px solid ${t.divider}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <Truck size={16} style={{ color: t.chipActive.text }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  Sacs retour sortants ({returnBags.length})
                </span>
              </div>
              <div style={{ maxHeight: 350, overflowY: "auto" }}>
                {returnBags.map(bag => (
                  <div key={bag.id} style={{
                    padding: "14px 20px", borderBottom: `1px solid ${t.divider}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>
                          {bag.tracking_number}
                        </span>
                        <BagStatusBadge status={bag.status} t={t} />
                        <span style={{ fontSize: 12, color: t.textMuted }}>{bag.packages_count} colis</span>
                      </div>
                      <div style={{ fontSize: 12, color: t.textMuted }}>
                        → {bag.destination_stop_desk?.name ?? bag.destination_wilaya?.name ?? "?"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {bag.status === "scelle" && (
                        <button onClick={() => { setTransitBagId(bag.id); setTransitDriverId(null); }} style={{
                          padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                          background: "rgba(249,115,22,0.1)", color: "#f97316", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 5,
                        }}>
                          <Send size={13} /> Envoyer
                        </button>
                      )}
                      {bag.status === "en_transit" && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#f97316", padding: "4px 10px", borderRadius: 8, background: "rgba(249,115,22,0.08)" }}>
                          En route...
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing échec packages not yet in bags */}
          <div style={{
            background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
            boxShadow: t.shadow, overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 20px", borderBottom: `1px solid ${t.divider}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle size={16} style={{ color: STATUS_COLORS.echec_livraison.text }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  Colis en échec en attente ({echecPackages.length})
                </span>
              </div>
              {/* Search */}
              <div style={{ position: "relative", width: 240 }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
                <input
                  value={echecSearch}
                  onChange={e => setEchecSearch(e.target.value)}
                  placeholder="Tracking, expéditeur, destinataire..."
                  style={{
                    width: "100%", padding: "7px 10px 7px 30px", borderRadius: 8,
                    border: `1px solid ${t.border}`, background: isDark ? "#1e2130" : "#fff",
                    color: t.text, fontSize: 12, outline: "none", boxSizing: "border-box" as const,
                  }}
                />
              </div>
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {(() => {
                const q = echecSearch.toLowerCase();
                const filtered = echecPackages.filter(pkg => {
                  if (!q) return true;
                  return pkg.tracking_number.toLowerCase().includes(q)
                    || (pkg.sender_name ?? "").toLowerCase().includes(q)
                    || (pkg.sender_phone ?? "").includes(q)
                    || (pkg.recipient_name ?? "").toLowerCase().includes(q)
                    || (pkg.recipient_phone ?? "").includes(q)
                    || (pkg.origin_stop_desk?.name ?? "").toLowerCase().includes(q)
                    || ((pkg as any).echec_reason ?? "").toLowerCase().includes(q);
                });
                return filtered.length === 0 ? (
                  <div style={{ padding: "30px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                    {echecPackages.length === 0 ? "Aucun colis en échec de livraison" : "Aucun résultat pour cette recherche"}
                  </div>
                ) : (
                  filtered.map(pkg => (
                    <div key={pkg.id} style={{
                      padding: "10px 20px", borderBottom: `1px solid ${t.divider}`,
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>
                            {pkg.tracking_number}
                          </span>
                          <PkgStatusBadge status={pkg.status} t={t} />
                          {(pkg as any).echec_reason && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#ef4444", background: "rgba(239,68,68,0.08)", padding: "1px 7px", borderRadius: 99 }}>
                              {(pkg as any).echec_reason}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: t.textMuted, display: "flex", gap: 12 }}>
                          <span>Exp: {pkg.sender_name} ({pkg.sender_phone})</span>
                          <span>Dest: {pkg.recipient_name}</span>
                          <span>Origine: {pkg.origin_stop_desk?.name ?? "?"}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {(pkg as any).return_cost > 0 && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>
                            Retour: {Number((pkg as any).return_cost).toLocaleString("fr-DZ")} DA
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: t.textFaint }}>
                          COD: {Number(pkg.cod_amount ?? 0).toLocaleString("fr-DZ")} DA
                        </div>
                      </div>
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           DIRECTION: Retrait Expéditeur
         ══════════════════════════════════════════════════════ */}
      {selectedSD && direction === "retrait" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Incoming return bags */}
          <div style={{
            background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
            boxShadow: t.shadow, overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: `1px solid ${t.divider}`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Truck size={16} style={{ color: t.chipActive.text }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                Sacs retour entrants ({returnBags.length})
              </span>
            </div>
            <div style={{ maxHeight: 350, overflowY: "auto" }}>
              {returnBags.length === 0 && (
                <div style={{ padding: "30px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                  Aucun sac retour en cours de réception
                </div>
              )}
              {returnBags.map(bag => (
                <div key={bag.id} style={{
                  padding: "14px 20px", borderBottom: `1px solid ${t.divider}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>
                        {bag.tracking_number}
                      </span>
                      <BagStatusBadge status={bag.status} t={t} />
                      <span style={{ fontSize: 12, color: t.textMuted }}>{bag.packages_count} colis</span>
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>
                      {bag.origin_stop_desk?.name ?? "?"} → {bag.destination_stop_desk?.name ?? bag.destination_wilaya?.name ?? "?"}
                      {bag.transit_driver && ` · Chauffeur: ${bag.transit_driver.first_name} ${bag.transit_driver.last_name}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {bag.status === "cree" && bag.packages_count > 0 && (
                      <button onClick={() => handleSeal(bag.id)} style={{
                        padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                        background: "rgba(99,102,241,0.1)", color: "#6366f1", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <Lock size={13} /> Sceller
                      </button>
                    )}
                    {bag.status === "scelle" && (
                      <button onClick={() => { setTransitBagId(bag.id); setTransitDriverId(null); }} style={{
                        padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                        background: "rgba(249,115,22,0.1)", color: "#f97316", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <Send size={13} /> Envoyer
                      </button>
                    )}
                    {bag.status === "en_transit" && (
                      <button onClick={() => handleReceive(bag.id)} style={{
                        padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                        background: "rgba(59,130,246,0.1)", color: "#3b82f6", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <Check size={13} /> Recevoir
                      </button>
                    )}
                    {bag.status === "recu" && (
                      <button onClick={() => handleUnpack(bag.id)} style={{
                        padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                        background: t.success.bg, color: t.success.text, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <PackageOpen size={13} /> Déballer
                      </button>
                    )}
                    {bag.status === "cree" && (
                      <button onClick={() => handleCancel(bag.id)} style={{
                        padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                        background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <XCircle size={13} /> Annuler
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retrait Expéditeur — grouped by sender */}
          <div style={{
            background: t.card, borderRadius: 16, border: `1px solid ${t.border}`,
            boxShadow: t.shadow, overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: `1px solid ${t.divider}`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <User size={16} style={{ color: t.purple.text }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                Retrait Expéditeur
              </span>
              <span style={{ fontSize: 12, color: t.textMuted }}>
                {retourArrivePackages.length} colis en attente
              </span>
            </div>

            {/* Search */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.divider}` }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
                  <input
                    placeholder="Téléphone ou nom expéditeur..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                    style={{
                      width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10,
                      border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
                      fontSize: 13, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <button onClick={handleSearch} disabled={searching} style={{
                  padding: "0 18px", borderRadius: 10, border: "none",
                  background: "#9333ea", color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: searching ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Rechercher
                </button>
              </div>
            </div>

            {/* Grouped by sender phone */}
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {(() => {
                const pkgs = searchResults.length > 0 ? searchResults : retourArrivePackages;
                if (pkgs.length === 0) return (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                    {searchQuery ? "Aucun résultat" : "Aucun colis en attente de retrait"}
                  </div>
                );

                // Group by sender_phone
                const groups: Record<string, { name: string; phone: string; packages: typeof pkgs }> = {};
                pkgs.forEach(p => {
                  if (!groups[p.sender_phone]) groups[p.sender_phone] = { name: p.sender_name, phone: p.sender_phone, packages: [] };
                  groups[p.sender_phone].packages.push(p);
                });

                return Object.values(groups).map(group => {
                  const totalReturnCost = group.packages.reduce((sum, p) => sum + (p.return_cost ?? 0), 0);
                  const walletData = walletCache[group.phone];
                  const walletBalance = walletData?.wallet?.balance ?? null;
                  return (
                    <div key={group.phone} style={{ borderBottom: `2px solid ${t.divider}` }}>
                      {/* Sender header */}
                      <div style={{
                        padding: "14px 20px", background: t.purple.bg,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 9,
                            background: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <User size={16} color="#fff" />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                              {group.name}
                              {walletData?.user?.company_name && (
                                <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400, marginLeft: 6 }}>
                                  ({walletData.user.company_name})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: t.textMuted }}>
                              <Phone size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                              {group.phone} · {group.packages.length} colis
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          {walletBalance !== null && (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: walletBalance >= 0 ? t.success.text : t.danger.text }}>
                                {walletBalance.toLocaleString()} DA
                              </div>
                              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>solde expéditeur</div>
                            </div>
                          )}
                          {totalReturnCost > 0 && (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: t.warning.text }}>
                                -{totalReturnCost} DA
                              </div>
                              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>frais retour</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Package list */}
                      {group.packages.map(pkg => (
                        <div key={pkg.id} style={{
                          padding: "10px 20px 10px 64px", borderBottom: `1px solid ${t.divider}`,
                          display: "flex", alignItems: "center", gap: 10,
                        }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: "monospace" }}>
                              {pkg.tracking_number}
                            </span>
                            <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 8 }}>
                              {pkg.content_description}
                            </span>
                            {pkg.return_cost !== null && pkg.return_cost > 0 && (
                              <span style={{
                                marginLeft: 8, fontSize: 10, fontWeight: 600, color: t.warning.text,
                                background: t.warning.bg, padding: "1px 6px", borderRadius: 4,
                              }}>
                                {pkg.return_cost} DA
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Bulk retrait button */}
                      <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => {
                            // Use the first package to open the bulk pickup modal
                            setPickupPkg({ ...group.packages[0], _bulkIds: group.packages.map(p => p.id), _bulkCount: group.packages.length, _bulkCost: totalReturnCost } as any);
                          }}
                          style={{
                            padding: "9px 20px", borderRadius: 10, border: "none",
                            background: "#9333ea", color: "#fff", fontSize: 13, fontWeight: 700,
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                          }}
                        >
                          <RotateCcw size={14} />
                          Retrait {group.packages.length > 1 ? `(${group.packages.length} colis)` : ""}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {showCreateBag && selectedSD && (
        <CreateReturnBagModal
          originSD={selectedSD}
          t={t}
          onClose={() => setShowCreateBag(false)}
          onCreate={() => fetchData()}
        />
      )}

      {transitBag && (
        <TransitDriverModal
          bag={transitBag}
          t={t}
          onClose={() => setTransitBag(null)}
          onConfirm={handleStartTransit}
        />
      )}

      {pickupPkg && (
        <ReturnPickupModal
          pkg={pickupPkg}
          t={t}
          onClose={() => setPickupPkg(null)}
          onConfirm={handleReturnPickup}
          onBulkConfirm={async (ids, phone) => {
            const res = await bulkReturnPickup(ids, phone);
            if (res.success) {
              setToast({ message: `${res.data?.processed} colis retournés · ${res.data?.total_return_cost} DA collectés`, type: "success" });
              fetchData();
            } else {
              throw new Error(res.message || "Erreur");
            }
          }}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Transit driver selection modal */}
      {transitBagId !== null && (
        <div onClick={() => { if (!transitSending) setTransitBagId(null); }} style={{
          position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: isDark ? "#111827" : "#fff", borderRadius: 16, width: "100%", maxWidth: 400,
            border: `1px solid ${t.border}`, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
          }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${t.divider}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>Envoyer en transit</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: t.textMuted }}>Sélectionnez le livreur transit</p>
            </div>
            <div style={{ padding: 20 }}>
              {transitDrivers.length === 0 ? (
                <p style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "16px 0" }}>
                  Aucun livreur transit disponible
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {transitDrivers.map(d => {
                    const selected = transitDriverId === d.id;
                    return (
                      <button key={d.id} onClick={() => setTransitDriverId(d.id)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        borderRadius: 10, border: `1.5px solid ${selected ? "#f97316" : t.border}`,
                        background: selected ? "rgba(249,115,22,0.06)" : "transparent",
                        cursor: "pointer", textAlign: "left", width: "100%",
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: selected ? "rgba(249,115,22,0.12)" : (isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6"),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: selected ? "#f97316" : t.textMuted,
                        }}>
                          {d.first_name[0]}{d.last_name[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{d.first_name} {d.last_name}</div>
                          {d.phone && <div style={{ fontSize: 11, color: t.textMuted }}>{d.phone}</div>}
                        </div>
                        {selected && <CheckCircle2 size={16} style={{ color: "#f97316" }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${t.divider}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setTransitBagId(null)} disabled={transitSending} style={{
                padding: "9px 18px", borderRadius: 10, border: `1px solid ${t.border}`,
                background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Annuler</button>
              <button onClick={async () => {
                if (!transitDriverId || !transitBagId) return;
                setTransitSending(true);
                await handleStartTransit(transitBagId, transitDriverId);
                setTransitSending(false);
                setTransitBagId(null);
                setTransitDriverId(null);
              }} disabled={!transitDriverId || transitSending} style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: !transitDriverId || transitSending ? t.textFaint : "#f97316",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: !transitDriverId || transitSending ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {transitSending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
