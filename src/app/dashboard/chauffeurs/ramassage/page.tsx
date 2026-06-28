"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  PackagePlus, Loader2, Truck, MapPin, Phone, User,
  CheckCircle2, XCircle, Package2, RefreshCw, AlertTriangle,
  ChevronDown, Search, X, CheckSquare, Square, Gift, DollarSign,
} from "lucide-react";
import { api, getStoredUser, isSDLocked, getLockedSDId } from "@/lib/api";
import {
  getLocalDrivers, getRamassage, ramassageAssign,
  ramassageUnassign, ramassageCollected, ramassageAutoAssign,
  ramassageToggleFree,
  type DriverKPIs,
} from "@/lib/drivers";
import SDSelector from "@/components/SDSelector";
import DriverSelector from "@/components/DriverSelector";
import { STATUS_LABELS, STATUS_COLORS, type PackageStatus } from "@/lib/packages";

/* ── SD option type ──────────────────────────────────────── */
interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

/* ── Pickup package shape ────────────────────────────────── */
interface PickupPackage {
  id: number;
  tracking_number: string;
  status: string;
  sender_name: string;
  sender_phone: string;
  recipient_name: string;
  recipient_phone: string;
  cod_amount: number;
  shipping_cost: number;
  created_at: string;
  driver_collected_at: string | null;
  pickup_free: boolean;
  driver: { id: number; first_name: string; last_name: string; phone: string | null } | null;
  recipient_commune: { name: string; wilaya: { name: string } } | null;
}

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
    inp:       { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
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
    shadow:    "0 1px 2px rgba(0,0,0,0.06)",
    inp:       { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── helpers ─────────────────────────────────────────────── */
function formatDA(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return Number(n).toLocaleString("fr-DZ") + " DA";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-DZ", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ── Toast ───────────────────────────────────────────────── */
function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const ms = type === "success" ? 3000 : 4000;
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [onDone, type]);

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
        : <AlertTriangle size={18} />}
      {message}
    </div>
  );
}

/* ── Inline driver assign dropdown ───────────────────────── */
function InlineDriverPicker({
  drivers,
  onSelect,
  t,
  isDark,
}: {
  drivers: DriverKPIs[];
  onSelect: (driverId: number) => void;
  t: Tokens;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = drivers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${d.first_name} ${d.last_name}`.toLowerCase().includes(q) ||
      (d.phone ?? "").includes(q)
    );
  });

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
          background: "rgba(14,165,233,0.08)", color: "#0ea5e9",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          whiteSpace: "nowrap", transition: "all 150ms",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(14,165,233,0.15)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(14,165,233,0.08)"; }}
      >
        <Truck size={13} />
        Assigner
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 100,
          width: 280, background: t.card, border: `1.5px solid ${t.border}`,
          borderRadius: 12, boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${t.border}` }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                style={{
                  width: "100%", padding: "7px 8px 7px 28px", borderRadius: 7,
                  border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
                  fontSize: 12, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "16px 12px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
                Aucun chauffeur
              </div>
            ) : (
              filtered.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onSelect(d.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", border: "none", cursor: "pointer",
                    background: "transparent", textAlign: "left",
                    borderBottom: `1px solid ${t.divider}`,
                    transition: "background 100ms",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = t.rowHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: t.textSub,
                  }}>
                    {d.first_name[0]}{d.last_name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.first_name} {d.last_name}
                    </div>
                    {d.phone && (
                      <div style={{ fontSize: 10, color: t.textMuted }}>{d.phone}</div>
                    )}
                  </div>
                  {d.current_packages > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "#f97316",
                      background: "rgba(249,115,22,0.1)", padding: "2px 6px", borderRadius: 99,
                    }}>
                      {d.current_packages}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── localStorage key ────────────────────────────────────── */
const RAMASSAGE_SD_KEY = "ramassage_selected_sd";

/* ── filter type ─────────────────────────────────────────── */
type FilterType = "all" | "unassigned" | "assigned";

/* ── main page ───────────────────────────────────────────── */
export default function RamassagePage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // SD context
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const sdLoaded = useRef(false);

  // Data
  const [packages, setPackages] = useState<PickupPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<DriverKPIs[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);

  // Main tab: assignation vs récupération
  const [mainTab, setMainTab] = useState<"assignation" | "recuperation">("assignation");

  // Récupération filters
  const [recupDriverFilter, setRecupDriverFilter] = useState<number | null>(null);
  const [recupFreeFilter, setRecupFreeFilter] = useState<"all" | "free" | "paid">("all");

  // Grouping
  const [groupByExp, setGroupByExp] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filter (within assignation tab)
  const [filter, setFilter] = useState<FilterType>("all");

  // Assignation tab search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [senderFilter, setSenderFilter] = useState<string>("__all__");
  const [freeFilter, setFreeFilter] = useState<"all" | "free" | "paid">("all");
  const [togglingFreeIds, setTogglingFreeIds] = useState<Set<number>>(new Set());

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Action loading states
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [unassigningId, setUnassigningId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ── Load stop desks ──────────────────────────────────────
  useEffect(() => {
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); sdLoaded.current = true; return; }
        const saved = localStorage.getItem(RAMASSAGE_SD_KEY);
        if (saved) {
          const id = Number(saved);
          if (res.data.some(sd => sd.id === id)) { setSelectedSD(id); sdLoaded.current = true; return; }
        }
        sdLoaded.current = true;
      }
    });
  }, []);

  // ── Persist SD selection ─────────────────────────────────
  useEffect(() => {
    if (selectedSD !== null && !isSDLocked(getStoredUser())) {
      localStorage.setItem(RAMASSAGE_SD_KEY, String(selectedSD));
    }
  }, [selectedSD]);

  // ── Load data when SD changes ────────────────────────────
  const loadPackages = useCallback(async () => {
    if (selectedSD === null) { setPackages([]); return; }
    setLoading(true);
    try {
      const assignedParam = filter === "assigned" ? "yes" : filter === "unassigned" ? "no" : undefined;
      const res = await getRamassage({ stop_desk_id: selectedSD, assigned: assignedParam });
      if (res.success && res.data) {
        setPackages(res.data as PickupPackage[]);
      } else {
        setPackages([]);
      }
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSD, filter]);

  useEffect(() => {
    loadPackages();
    setSelected(new Set());
  }, [loadPackages]);

  // ── Load drivers when SD changes ─────────────────────────
  useEffect(() => {
    if (selectedSD === null) { setDrivers([]); return; }
    setDriversLoading(true);
    getLocalDrivers({ stop_desk_id: selectedSD }).then(res => {
      if (res.success && res.data) {
        setDrivers(res.data);
      } else {
        setDrivers([]);
      }
    }).finally(() => setDriversLoading(false));
  }, [selectedSD]);

  // ── Assign driver ────────────────────────────────────────
  const handleAssign = useCallback(async (packageId: number, driverId: number) => {
    setAssigningId(packageId);
    try {
      const res = await ramassageAssign(packageId, driverId);
      if (res.success) {
        setToast({ message: "Chauffeur assigne avec succes", type: "success" });
        await loadPackages();
      } else {
        setToast({ message: res.message || "Erreur lors de l'assignation", type: "error" });
      }
    } catch {
      setToast({ message: "Erreur de connexion", type: "error" });
    } finally {
      setAssigningId(null);
    }
  }, [loadPackages]);

  // ── Unassign driver ──────────────────────────────────────
  const handleUnassign = useCallback(async (packageId: number) => {
    setUnassigningId(packageId);
    try {
      const res = await ramassageUnassign(packageId);
      if (res.success) {
        setToast({ message: "Chauffeur retire", type: "success" });
        await loadPackages();
      } else {
        setToast({ message: res.message || "Erreur lors du retrait", type: "error" });
      }
    } catch {
      setToast({ message: "Erreur de connexion", type: "error" });
    } finally {
      setUnassigningId(null);
    }
  }, [loadPackages]);

  // ── Mark as collected ────────────────────────────────────
  const handleBulkCollected = useCallback(async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await ramassageCollected(Array.from(selected));
      if (res.success) {
        setToast({ message: `${selected.size} colis marque(s) comme ramasse(s)`, type: "success" });
        setSelected(new Set());
        await loadPackages();
      } else {
        setToast({ message: res.message || "Erreur lors du marquage", type: "error" });
      }
    } catch {
      setToast({ message: "Erreur de connexion", type: "error" });
    } finally {
      setBulkLoading(false);
    }
  }, [selected, loadPackages]);

  // ── Auto-assign all ─────────────────────────────────────
  const handleAutoAssign = useCallback(async () => {
    if (!selectedSD) return;
    setAutoAssignLoading(true);
    try {
      const res = await ramassageAutoAssign(selectedSD);
      if (res.success && res.data) {
        const { assigned, no_driver } = res.data;
        setToast({
          message: `${assigned} colis assigné(s) automatiquement${no_driver > 0 ? ` · ${no_driver} sans chauffeur disponible` : ""}`,
          type: assigned > 0 ? "success" : "error",
        });
        await loadPackages();
      } else {
        setToast({ message: (res as any).message || "Erreur", type: "error" });
      }
    } catch {
      setToast({ message: "Erreur de connexion", type: "error" });
    } finally {
      setAutoAssignLoading(false);
    }
  }, [selectedSD, loadPackages]);

  // ── Toggle selection ─────────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size === packages.length && packages.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(packages.map(p => p.id)));
    }
  }, [selected, packages]);

  // ── Stats ────────────────────────────────────────────────
  const totalCount = packages.length;
  const assignedCount = packages.filter(p => p.driver !== null).length;
  const unassignedCount = packages.filter(p => p.driver === null).length;
  const collectedByDriver = packages.filter(p => p.driver_collected_at !== null).length;
  const waitingForReturn = packages.filter(p => p.driver !== null && p.driver_collected_at !== null).length;

  // ── Filter chips ─────────────────────────────────────────
  const filterChips: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "Tous", count: totalCount },
    { key: "unassigned", label: "Non assignes", count: unassignedCount },
    { key: "assigned", label: "Assignes", count: assignedCount },
  ];

  // ── Filtered packages (search + sender + free/paid + assigned) ──
  const getFilteredPackages = useCallback((): PickupPackage[] => {
    let result = packages;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.tracking_number.toLowerCase().includes(q) ||
        p.sender_name.toLowerCase().includes(q) ||
        p.sender_phone.includes(q)
      );
    }

    // Sender filter
    if (senderFilter !== "__all__") {
      result = result.filter(p => p.sender_phone === senderFilter);
    }

    // Free/paid filter
    if (freeFilter === "free") {
      result = result.filter(p => !!p.pickup_free);
    } else if (freeFilter === "paid") {
      result = result.filter(p => !p.pickup_free);
    }

    return result;
  }, [packages, searchQuery, senderFilter, freeFilter]);

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, marginBottom: 20,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(249,115,22,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <PackagePlus size={22} style={{ color: "#f97316" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text, margin: 0, lineHeight: 1.2 }}>
            Ramassage (Pickup)
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, margin: 0, marginTop: 2 }}>
            Colis a recuperer chez les expediteurs
          </p>
        </div>
      </div>

      {/* SD Selector bar */}
      <div style={{
        background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
        padding: 16, marginBottom: 16, boxShadow: t.shadow,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 260px", minWidth: 200 }}>
          <SDSelector
            stopDesks={stopDesks}
            value={selectedSD}
            onChange={id => { setSelectedSD(id); }}
            disabled={isSDLocked(getStoredUser())}
          />
        </div>
        {isSDLocked(getStoredUser()) && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#f97316",
            background: "rgba(249,115,22,0.1)", padding: "4px 10px", borderRadius: 99,
          }}>
            Verrouille sur votre SD
          </span>
        )}
      </div>

      {/* Content when SD selected */}
      {selectedSD !== null && (
        <>
          {/* Main tabs: Assignation / Récupération */}
          <div style={{
            display: "flex", gap: 0, marginBottom: 16,
            background: isDark ? "#1e2130" : "#f3f4f6", borderRadius: 12, padding: 4,
          }}>
            {([
              { key: "assignation" as const, label: "Assignation", count: unassignedCount + assignedCount - waitingForReturn, icon: "📋" },
              { key: "recuperation" as const, label: "Récupération", count: waitingForReturn, icon: "📦" },
            ]).map(tab => {
              const active = mainTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setMainTab(tab.key)} style={{
                  flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
                  background: active ? (isDark ? "#111827" : "#fff") : "transparent",
                  color: active ? t.text : t.textMuted,
                  fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
                  boxShadow: active ? t.shadow : "none", transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  {tab.label}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                    background: active ? "#f97316" : (isDark ? "#2a3145" : "#e5e7eb"),
                    color: active ? "#fff" : t.textMuted,
                  }}>{tab.count}</span>
                </button>
              );
            })}
          </div>


          {/* ══ RÉCUPÉRATION TAB ══ */}
          {mainTab === "recuperation" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Filters */}
              <div style={{
                background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
                padding: "12px 16px", boxShadow: t.shadow,
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              }}>
                {/* Driver filter */}
                <div style={{ flex: "1 1 200px", minWidth: 160 }}>
                  <DriverSelector
                    drivers={drivers}
                    value={recupDriverFilter}
                    onChange={setRecupDriverFilter}
                    placeholder="Filtrer par chauffeur..."
                  />
                </div>
                {/* Type chips */}
                {[
                  { key: "all" as const, label: "Tous", count: packages.filter(p => p.driver_collected_at !== null).length },
                  { key: "free" as const, label: "Gratuit", count: packages.filter(p => p.driver_collected_at !== null && p.pickup_free).length },
                  { key: "paid" as const, label: "Payant", count: packages.filter(p => p.driver_collected_at !== null && !p.pickup_free).length },
                ].map(chip => {
                  const active = recupFreeFilter === chip.key;
                  return (
                    <button key={chip.key} onClick={() => setRecupFreeFilter(chip.key)} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "7px 14px", borderRadius: 99, border: "none",
                      background: active ? "#f97316" : (isDark ? "#1e2130" : "#f3f4f6"),
                      color: active ? "#fff" : t.textSub,
                      fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                    }}>
                      {chip.label}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                        background: active ? "rgba(255,255,255,0.2)" : (isDark ? "#2a3145" : "#e5e7eb"),
                        color: active ? "#fff" : t.textMuted,
                      }}>{chip.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Financial summary per driver */}
              {(() => {
                const collected = packages.filter(p => p.driver_collected_at !== null)
                  .filter(p => recupDriverFilter ? p.driver?.id === recupDriverFilter : true)
                  .filter(p => recupFreeFilter === "all" ? true : recupFreeFilter === "free" ? p.pickup_free : !p.pickup_free);
                // Group by driver
                const byDriver = new Map<number, { driver: typeof collected[0]["driver"]; gratuit: typeof collected; payant: typeof collected }>();
                collected.forEach(p => {
                  if (!p.driver) return;
                  if (!byDriver.has(p.driver.id)) byDriver.set(p.driver.id, { driver: p.driver, gratuit: [], payant: [] });
                  const entry = byDriver.get(p.driver.id)!;
                  if (p.pickup_free) entry.gratuit.push(p); else entry.payant.push(p);
                });

                // Get driver commune prices from drivers list
                const getDriverFee = (driverId: number, pkg: typeof collected[0]) => {
                  const d = drivers.find(dr => dr.id === driverId);
                  // For pickup, the fee is based on origin SD commune — approximate with first commune price
                  return d?.communes?.[0]?.price ?? 0;
                };

                return byDriver.size > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
                    {Array.from(byDriver.entries()).map(([driverId, { driver, gratuit, payant }]) => {
                      const sdOwesDriver = gratuit.reduce((s, p) => s + getDriverFee(driverId, p), 0);
                      return (
                        <div key={driverId} style={{
                          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
                          padding: 16, boxShadow: t.shadow,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                              background: "rgba(14,165,233,0.1)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700, color: "#0ea5e9",
                            }}>{driver?.first_name?.[0]}{driver?.last_name?.[0]}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{driver?.first_name} {driver?.last_name}</div>
                              <div style={{ fontSize: 11, color: t.textMuted }}>{driver?.phone}</div>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                            <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(249,115,22,0.06)", textAlign: "center" }}>
                              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>Payant</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "#f97316" }}>{payant.length}</div>
                              <div style={{ fontSize: 10, color: t.textFaint }}>Déjà payé par expéd.</div>
                            </div>
                            <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(16,185,129,0.06)", textAlign: "center" }}>
                              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>Gratuit</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>{gratuit.length}</div>
                              <div style={{ fontSize: 10, color: t.textFaint }}>SD doit payer</div>
                            </div>
                          </div>
                          {sdOwesDriver > 0 && (
                            <div style={{
                              padding: "10px 14px", borderRadius: 10,
                              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>SD doit au chauffeur</span>
                              <span style={{ fontSize: 16, fontWeight: 800, color: "#ef4444" }}>{formatDA(sdOwesDriver)}</span>
                            </div>
                          )}
                          {sdOwesDriver === 0 && (
                            <div style={{
                              padding: "10px 14px", borderRadius: 10,
                              background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)",
                              textAlign: "center",
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>Rien à payer — tout payant</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              })()}

              {/* Package list */}
              <div style={{
                background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
                boxShadow: t.shadow, overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 20px", borderBottom: `1px solid ${t.divider}`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <Package2 size={16} style={{ color: "#f97316" }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                    Colis ramassés — en attente de réception ({waitingForReturn})
                  </span>
                </div>
                {waitingForReturn === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                    Aucun colis ramassé en attente. Le chauffeur n'a pas encore confirmé le ramassage.
                  </div>
                ) : (
                  <div>
                    {packages.filter(p => p.driver_collected_at !== null)
                      .filter(p => recupDriverFilter ? p.driver?.id === recupDriverFilter : true)
                      .filter(p => recupFreeFilter === "all" ? true : recupFreeFilter === "free" ? p.pickup_free : !p.pickup_free)
                      .map(pkg => (
                      <div key={pkg.id} style={{
                        padding: "14px 20px", borderBottom: `1px solid ${t.divider}`,
                        display: "flex", alignItems: "center", gap: 12,
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: pkg.pickup_free ? "rgba(16,185,129,0.08)" : "rgba(249,115,22,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Package2 size={16} style={{ color: pkg.pickup_free ? "#10b981" : "#f97316" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{pkg.tracking_number}</div>
                          <div style={{ fontSize: 12, color: t.textMuted }}>
                            Expéditeur: {pkg.sender_name} · {pkg.sender_phone}
                          </div>
                          {pkg.driver && (
                            <div style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 500, marginTop: 2 }}>
                              Chauffeur: {pkg.driver.first_name} {pkg.driver.last_name}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: pkg.pickup_free ? "#10b981" : "#f97316",
                            background: pkg.pickup_free ? "rgba(16,185,129,0.08)" : "rgba(249,115,22,0.08)",
                            padding: "3px 10px", borderRadius: 99,
                          }}>
                            {pkg.pickup_free ? "Gratuit — SD paie" : "Payant — déjà payé"}
                          </span>
                          <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4 }}>
                            Scanner au Scan Réception
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ ASSIGNATION TAB ══ */}
          {mainTab === "assignation" && (<>

          {/* ── Filter card ────────────────────────────────────── */}
          <div style={{
            background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
            padding: 16, marginBottom: 16, boxShadow: t.shadow,
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            {/* Row 1: Search + Sender dropdown + Refresh */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: "1 1 260px", minWidth: 200 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par tracking, nom ou tel..."
                  style={{
                    width: "100%", padding: "9px 10px 9px 32px", borderRadius: 10,
                    border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
                    fontSize: 13, outline: "none", boxSizing: "border-box",
                    transition: "border-color 150ms",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#f97316"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = t.inp.border; }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: 2,
                      color: t.textFaint, display: "flex",
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Group toggle */}
              <button
                onClick={() => setGroupByExp(v => !v)}
                style={{
                  padding: "9px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                  background: groupByExp ? "rgba(249,115,22,0.1)" : t.inp.bg,
                  color: groupByExp ? "#ea580c" : t.textMuted,
                  border: `1px solid ${groupByExp ? "#f97316" : t.inp.border}`,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {groupByExp ? "Groupé" : "Liste"}
              </button>

              {/* Sender dropdown */}
              <div style={{ position: "relative", flex: "0 1 220px", minWidth: 160 }}>
                <User size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint, zIndex: 1 }} />
                <select
                  value={senderFilter}
                  onChange={e => setSenderFilter(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 10px 9px 30px", borderRadius: 10,
                    border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
                    fontSize: 13, outline: "none", cursor: "pointer",
                    appearance: "none", WebkitAppearance: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="__all__">Tous les expediteurs</option>
                  {(() => {
                    const senderMap = new Map<string, string>();
                    packages.forEach(p => {
                      if (!senderMap.has(p.sender_phone)) senderMap.set(p.sender_phone, p.sender_name);
                    });
                    return Array.from(senderMap.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([phone, name]) => (
                      <option key={phone} value={phone}>{name} ({phone})</option>
                    ));
                  })()}
                </select>
                <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint, pointerEvents: "none" }} />
              </div>

              {/* Refresh */}
              <button
                onClick={loadPackages}
                disabled={loading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 14px", borderRadius: 10, border: `1px solid ${t.border}`,
                  background: "transparent", color: t.textSub,
                  fontSize: 12, fontWeight: 600, cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.5 : 1, transition: "all 150ms", whiteSpace: "nowrap",
                }}
              >
                <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                Rafraichir
              </button>
            </div>

            {/* Row 2: Type chips + Status chips */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              {/* Type filter */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginRight: 2 }}>
                  Type
                </span>
                {([
                  { key: "all" as const, label: "Tous" },
                  { key: "paid" as const, label: "Payant" },
                  { key: "free" as const, label: "Gratuit" },
                ] as const).map(chip => {
                  const active = freeFilter === chip.key;
                  const chipColor = chip.key === "free" ? "#10b981" : chip.key === "paid" ? "#f97316" : undefined;
                  return (
                    <button
                      key={chip.key}
                      onClick={() => setFreeFilter(chip.key)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 12px", borderRadius: 99, border: "none",
                        background: active
                          ? (chipColor ?? "#f97316")
                          : (isDark ? "#1e2130" : "#f3f4f6"),
                        color: active ? "#fff" : t.textSub,
                        fontSize: 12, fontWeight: active ? 700 : 500,
                        cursor: "pointer", transition: "all 150ms", whiteSpace: "nowrap",
                      }}
                    >
                      {chip.key === "free" && <Gift size={11} />}
                      {chip.key === "paid" && <DollarSign size={11} />}
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 22, background: t.divider }} />

              {/* Status filter */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginRight: 2 }}>
                  Statut
                </span>
                {filterChips.map(chip => {
                  const active = filter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      onClick={() => setFilter(chip.key)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 12px", borderRadius: 99, border: "none",
                        background: active ? "#f97316" : (isDark ? "#1e2130" : "#f3f4f6"),
                        color: active ? "#fff" : t.textSub,
                        fontSize: 12, fontWeight: active ? 700 : 500,
                        cursor: "pointer", transition: "all 150ms", whiteSpace: "nowrap",
                      }}
                    >
                      {chip.label}
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        padding: "1px 6px", borderRadius: 99,
                        background: active ? "rgba(255,255,255,0.2)" : (isDark ? "#2a3145" : "#e5e7eb"),
                        color: active ? "#fff" : t.textMuted,
                      }}>
                        {chip.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Stats row (3 cards) ────────────────────────────── */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12, marginBottom: 16,
          }}>
            <div style={{
              background: t.card, borderRadius: 12, border: `1px solid ${t.border}`,
              padding: "16px 18px", boxShadow: t.shadow,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(249,115,22,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Package2 size={16} style={{ color: "#f97316" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Total pickup
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.text }}>{totalCount}</div>
            </div>

            <div style={{
              background: t.card, borderRadius: 12, border: `1px solid ${t.border}`,
              padding: "16px 18px", boxShadow: t.shadow,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(16,185,129,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <CheckCircle2 size={16} style={{ color: "#10b981" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Assignes
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981" }}>{assignedCount}</div>
            </div>

            <div style={{
              background: t.card, borderRadius: 12, border: `1px solid ${t.border}`,
              padding: "16px 18px", boxShadow: t.shadow,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(239,68,68,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <XCircle size={16} style={{ color: "#ef4444" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Non assignes
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>{unassignedCount}</div>
            </div>
          </div>

          {/* ── Auto-assign button ─────────────────────────────── */}
          {unassignedCount > 0 && (
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleAutoAssign}
                disabled={autoAssignLoading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  background: autoAssignLoading ? (isDark ? "#2a3145" : "#e5e7eb") : "#0ea5e9",
                  color: autoAssignLoading ? t.textMuted : "#fff",
                  fontSize: 13, fontWeight: 700, cursor: autoAssignLoading ? "default" : "pointer",
                  transition: "all 150ms", whiteSpace: "nowrap",
                  boxShadow: autoAssignLoading ? "none" : "0 2px 8px rgba(14,165,233,0.25)",
                }}
              >
                {autoAssignLoading
                  ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  : <Truck size={15} />}
                Auto-assigner ({unassignedCount})
              </button>
            </div>
          )}

          {/* ── Bulk actions bar ───────────────────────────────── */}
          {selected.size > 0 && (
            <div style={{
              background: isDark ? "#1a2332" : "#eff6ff",
              borderRadius: 12, border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.2)"}`,
              padding: "12px 18px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>
                {selected.size} colis selectionne(s)
              </span>

              {/* Bulk driver assign */}
              <div style={{ flex: "0 1 240px", minWidth: 180 }}>
                <DriverSelector
                  drivers={drivers}
                  value={null}
                  onChange={async (driverId) => {
                    if (!driverId) return;
                    setBulkLoading(true);
                    let ok = 0;
                    for (const pkgId of Array.from(selected)) {
                      const res = await ramassageAssign(pkgId, driverId);
                      if (res.success) ok++;
                    }
                    setBulkLoading(false);
                    setToast({ message: `${ok} colis assigne(s) au chauffeur`, type: "success" });
                    setSelected(new Set());
                    loadPackages();
                  }}
                  placeholder="Assigner au chauffeur..."
                  disabled={bulkLoading}
                />
              </div>

              {/* Gratuit button */}
              <button
                onClick={async () => {
                  setBulkLoading(true);
                  try {
                    const res = await ramassageToggleFree(Array.from(selected), true);
                    if (res.success) {
                      setToast({ message: `${selected.size} colis marque(s) gratuit`, type: "success" });
                      setSelected(new Set());
                      await loadPackages();
                    } else {
                      setToast({ message: (res as any).message || "Erreur", type: "error" });
                    }
                  } catch { setToast({ message: "Erreur de connexion", type: "error" }); }
                  finally { setBulkLoading(false); }
                }}
                disabled={bulkLoading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", borderRadius: 8, border: "none",
                  background: "rgba(16,185,129,0.12)", color: "#10b981",
                  fontSize: 12, fontWeight: 700, cursor: bulkLoading ? "default" : "pointer",
                  transition: "all 150ms", whiteSpace: "nowrap",
                }}
              >
                <Gift size={12} />
                Gratuit
              </button>

              {/* Payant button */}
              <button
                onClick={async () => {
                  setBulkLoading(true);
                  try {
                    const res = await ramassageToggleFree(Array.from(selected), false);
                    if (res.success) {
                      setToast({ message: `${selected.size} colis marque(s) payant`, type: "success" });
                      setSelected(new Set());
                      await loadPackages();
                    } else {
                      setToast({ message: (res as any).message || "Erreur", type: "error" });
                    }
                  } catch { setToast({ message: "Erreur de connexion", type: "error" }); }
                  finally { setBulkLoading(false); }
                }}
                disabled={bulkLoading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", borderRadius: 8, border: "none",
                  background: "rgba(249,115,22,0.12)", color: "#f97316",
                  fontSize: 12, fontWeight: 700, cursor: bulkLoading ? "default" : "pointer",
                  transition: "all 150ms", whiteSpace: "nowrap",
                }}
              >
                <DollarSign size={12} />
                Payant
              </button>

              {/* Divider */}
              <div style={{ width: 1, height: 22, background: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.15)" }} />

              {/* Cocher tous */}
              <button
                onClick={() => {
                  const filtered = getFilteredPackages();
                  setSelected(new Set(filtered.map(p => p.id)));
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 12px", borderRadius: 8,
                  border: `1px solid ${t.border}`, background: "transparent",
                  color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <CheckSquare size={12} />
                Cocher tous
              </button>

              {/* Decocher tout */}
              <button
                onClick={() => setSelected(new Set())}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 12px", borderRadius: 8,
                  border: `1px solid ${t.border}`, background: "transparent",
                  color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <Square size={12} />
                Decocher tout
              </button>

              {/* Deselectionner */}
              <button
                onClick={() => setSelected(new Set())}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "7px 12px", borderRadius: 8,
                  border: `1px solid ${isDark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)"}`,
                  background: "rgba(239,68,68,0.06)", color: "#ef4444",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                <X size={12} />
                Deselectionner
              </button>
            </div>
          )}

          {/* ── Loading state ──────────────────────────────────── */}
          {loading && (
            <div style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              padding: "48px 24px", textAlign: "center", boxShadow: t.shadow,
            }}>
              <Loader2 size={28} style={{ color: "#f97316", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>Chargement des colis pickup...</div>
            </div>
          )}

          {/* ── Empty state ────────────────────────────────────── */}
          {!loading && getFilteredPackages().length === 0 && (
            <div style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              padding: "48px 24px", textAlign: "center", boxShadow: t.shadow,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
                background: "rgba(249,115,22,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <PackagePlus size={28} style={{ color: "#f97316" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                Aucun colis pickup en attente
              </div>
              <div style={{ fontSize: 13, color: t.textMuted }}>
                {(searchQuery || senderFilter !== "__all__" || freeFilter !== "all" || filter !== "all")
                  ? "Aucun resultat pour ces filtres. Essayez de modifier vos criteres."
                  : "Il n'y a actuellement aucun colis pickup a recuperer pour ce Stop Desk."}
              </div>
            </div>
          )}

          {/* ── Package table ──────────────────────────────────── */}
          {!loading && getFilteredPackages().length > 0 && (
            <div style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              boxShadow: t.shadow, overflowX: "auto",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{
                      padding: "12px 12px 12px 16px", width: 40,
                      borderBottom: `2px solid ${t.border}`,
                      position: "sticky", top: 0, background: t.card, zIndex: 2,
                    }}>
                      <input
                        type="checkbox"
                        checked={selected.size === getFilteredPackages().length && getFilteredPackages().length > 0}
                        onChange={() => {
                          const filtered = getFilteredPackages();
                          if (selected.size === filtered.length && filtered.length > 0) {
                            setSelected(new Set());
                          } else {
                            setSelected(new Set(filtered.map(p => p.id)));
                          }
                        }}
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#f97316" }}
                      />
                    </th>
                    {[
                      { label: "Tracking", align: "left" },
                      { label: "Expediteur", align: "left" },
                      { label: "Destinataire", align: "left" },
                      { label: "COD", align: "right" },
                      { label: "Type", align: "center" },
                      { label: "Statut", align: "center" },
                      { label: "Date", align: "left" },
                      { label: "Chauffeur", align: "left" },
                    ].map((h, i) => (
                      <th key={i} style={{
                        padding: "12px 12px",
                        textAlign: h.align as any,
                        fontSize: 11, fontWeight: 700, color: t.textMuted,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                        borderBottom: `2px solid ${t.border}`,
                        whiteSpace: "nowrap",
                        position: "sticky", top: 0, background: t.card, zIndex: 2,
                      }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getFilteredPackages()
                    .sort((a, b) => groupByExp ? a.sender_phone.localeCompare(b.sender_phone) : 0)
                    .reduce<{ rows: React.ReactNode[]; lastSender: string }>((acc, pkg) => {
                      // Insert group header when sender changes
                      if (groupByExp && pkg.sender_phone !== acc.lastSender) {
                        const senderPkgs = getFilteredPackages().filter(p => p.sender_phone === pkg.sender_phone);
                        const totalCod = senderPkgs.reduce((s, p) => s + Number(p.cod_amount || 0), 0);
                        const allSel = senderPkgs.every(p => selected.has(p.id));
                        const someSel = senderPkgs.some(p => selected.has(p.id));
                        const isCollapsed = collapsedGroups.has(pkg.sender_phone);
                        acc.rows.push(
                          <tr key={`g-${pkg.sender_phone}`} style={{
                            background: isDark ? "rgba(249,115,22,0.06)" : "rgba(249,115,22,0.03)",
                            cursor: "pointer",
                          }} onClick={() => setCollapsedGroups(prev => {
                            const n = new Set(prev); n.has(pkg.sender_phone) ? n.delete(pkg.sender_phone) : n.add(pkg.sender_phone); return n;
                          })}>
                            <td style={{ padding: "8px 12px 8px 16px", borderBottom: `1px solid ${t.border}` }}
                              onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={allSel}
                                ref={el => { if (el) el.indeterminate = someSel && !allSel; }}
                                onChange={() => setSelected(prev => {
                                  const n = new Set(prev);
                                  if (allSel) senderPkgs.forEach(p => n.delete(p.id)); else senderPkgs.forEach(p => n.add(p.id));
                                  return n;
                                })}
                                style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#f97316" }}
                              />
                            </td>
                            <td colSpan={8} style={{ padding: "8px 12px", borderBottom: `1px solid ${t.border}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, color: t.textFaint }}>{isCollapsed ? "▸" : "▾"}</span>
                                <span style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{pkg.sender_name}</span>
                                <span style={{ fontSize: 12, color: t.textMuted }}>{pkg.sender_phone}</span>
                                <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "rgba(249,115,22,0.1)", color: "#ea580c" }}>{senderPkgs.length} colis</span>
                                {/* Free/Paid toggle per expéditeur */}
                                {(() => {
                                  const allFree = senderPkgs.every(p => !!p.pickup_free);
                                  return (
                                    <button onClick={async (e) => {
                                      e.stopPropagation();
                                      for (const sp of senderPkgs) {
                                        if (!!sp.pickup_free !== !allFree) {
                                          await ramassageToggleFree([sp.id], !allFree);
                                        }
                                      }
                                    }} style={{
                                      padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                      background: allFree ? "rgba(16,185,129,0.1)" : "rgba(249,115,22,0.1)",
                                      color: allFree ? "#059669" : "#ea580c",
                                      border: "none", cursor: "pointer",
                                    }}>
                                      {allFree ? "Gratuit" : "Payant"}
                                    </button>
                                  );
                                })()}
                                <span style={{ fontSize: 12, fontWeight: 600, color: t.text, marginLeft: "auto" }}>{totalCod.toLocaleString()} DA</span>
                              </div>
                            </td>
                          </tr>
                        );
                        acc.lastSender = pkg.sender_phone;
                      }
                      // Skip row if group is collapsed
                      if (groupByExp && collapsedGroups.has(pkg.sender_phone)) return acc;
                      // Normal row rendering below
                      acc.rows.push((() => {
                    const isSelected = selected.has(pkg.id);
                    const statusKey = pkg.status as PackageStatus;
                    const statusColor = STATUS_COLORS[statusKey];
                    const statusLabel = STATUS_LABELS[statusKey] ?? pkg.status;
                    const isAssigning = assigningId === pkg.id;
                    const isUnassigning = unassigningId === pkg.id;
                    const isTogglingFree = togglingFreeIds.has(pkg.id);
                    const isFree = !!pkg.pickup_free;

                    return (
                      <tr
                        key={pkg.id}
                        style={{
                          background: isSelected ? (isDark ? "rgba(249,115,22,0.06)" : "rgba(249,115,22,0.03)") : "transparent",
                          transition: "background 100ms",
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = t.rowHover; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: "10px 12px 10px 16px", borderBottom: `1px solid ${t.divider}` }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(pkg.id)}
                            style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#f97316" }}
                          />
                        </td>

                        {/* Tracking */}
                        <td style={{
                          padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                          fontFamily: "monospace", fontWeight: 700, color: t.text,
                          letterSpacing: "0.03em", fontSize: 13, whiteSpace: "nowrap",
                        }}>
                          {pkg.tracking_number}
                        </td>

                        {/* Expediteur */}
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${t.divider}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 5 }}>
                              <User size={12} style={{ color: t.textFaint, flexShrink: 0 }} />
                              {pkg.sender_name}
                            </span>
                            <span style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
                              <Phone size={10} style={{ color: t.textFaint, flexShrink: 0 }} />
                              {pkg.sender_phone}
                            </span>
                          </div>
                        </td>

                        {/* Destinataire */}
                        <td style={{ padding: "10px 12px", borderBottom: `1px solid ${t.divider}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>
                              {pkg.recipient_name}
                            </span>
                            {pkg.recipient_commune && (
                              <span style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                                <MapPin size={10} style={{ color: t.textFaint, flexShrink: 0 }} />
                                {pkg.recipient_commune.name}
                                {pkg.recipient_commune.wilaya && (
                                  <span style={{ color: t.textFaint }}> ({pkg.recipient_commune.wilaya.name})</span>
                                )}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* COD */}
                        <td style={{
                          padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                          textAlign: "right", fontWeight: 700, color: t.text,
                          fontFamily: "monospace", whiteSpace: "nowrap",
                        }}>
                          {formatDA(pkg.cod_amount)}
                        </td>

                        {/* Type badge (clickable to toggle) */}
                        <td style={{
                          padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                          textAlign: "center",
                        }}>
                          <button
                            disabled={isTogglingFree}
                            onClick={async () => {
                              setTogglingFreeIds(prev => new Set(prev).add(pkg.id));
                              try {
                                const res = await ramassageToggleFree([pkg.id], !isFree);
                                if (res.success) {
                                  setToast({ message: `Colis marque ${!isFree ? "gratuit" : "payant"}`, type: "success" });
                                  await loadPackages();
                                } else {
                                  setToast({ message: (res as any).message || "Erreur", type: "error" });
                                }
                              } catch {
                                setToast({ message: "Erreur de connexion", type: "error" });
                              } finally {
                                setTogglingFreeIds(prev => {
                                  const next = new Set(prev);
                                  next.delete(pkg.id);
                                  return next;
                                });
                              }
                            }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "4px 10px", borderRadius: 99, border: "none",
                              fontSize: 11, fontWeight: 700, cursor: isTogglingFree ? "default" : "pointer",
                              opacity: isTogglingFree ? 0.5 : 1,
                              background: isFree ? "rgba(16,185,129,0.12)" : "rgba(249,115,22,0.12)",
                              color: isFree ? "#10b981" : "#f97316",
                              transition: "all 150ms", whiteSpace: "nowrap",
                            }}
                            title={`Cliquer pour basculer en ${isFree ? "payant" : "gratuit"}`}
                          >
                            {isTogglingFree
                              ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
                              : isFree ? <Gift size={10} /> : <DollarSign size={10} />}
                            {isFree ? "Gratuit" : "Payant"}
                          </button>
                        </td>

                        {/* Status */}
                        <td style={{
                          padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                          textAlign: "center",
                        }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "4px 10px", borderRadius: 99,
                            fontSize: 11, fontWeight: 600,
                            background: statusColor?.bg ?? "rgba(107,114,128,0.1)",
                            color: statusColor?.text ?? "#6b7280",
                            whiteSpace: "nowrap",
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: "50%",
                              background: statusColor?.dot ?? "#6b7280",
                              flexShrink: 0,
                            }} />
                            {statusLabel}
                          </span>
                        </td>

                        {/* Date */}
                        <td style={{
                          padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                          fontSize: 12, color: t.textSub, whiteSpace: "nowrap",
                        }}>
                          {formatDate(pkg.created_at)}
                        </td>

                        {/* Driver column */}
                        <td style={{
                          padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                          whiteSpace: "nowrap",
                        }}>
                          {pkg.driver ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "5px 10px", borderRadius: 8,
                                background: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.05)",
                                border: `1px solid ${isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)"}`,
                              }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                  background: "rgba(16,185,129,0.15)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 9, fontWeight: 700, color: "#10b981",
                                }}>
                                  {pkg.driver.first_name[0]}{pkg.driver.last_name[0]}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                                  {pkg.driver.first_name} {pkg.driver.last_name}
                                </span>
                              </div>
                              <button
                                onClick={() => handleUnassign(pkg.id)}
                                disabled={isUnassigning}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "5px 10px", borderRadius: 7,
                                  border: `1px solid ${isDark ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.2)"}`,
                                  background: "rgba(239,68,68,0.08)",
                                  color: "#ef4444", fontSize: 11, fontWeight: 600,
                                  cursor: isUnassigning ? "default" : "pointer",
                                  opacity: isUnassigning ? 0.5 : 1,
                                  transition: "all 150ms", whiteSpace: "nowrap",
                                }}
                                onMouseEnter={e => { if (!isUnassigning) e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                              >
                                {isUnassigning
                                  ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                                  : <XCircle size={12} />}
                                Retirer
                              </button>
                            </div>
                          ) : (
                            <div>
                              {isAssigning ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, color: t.textMuted, fontSize: 12 }}>
                                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "#0ea5e9" }} />
                                  Assignation...
                                </div>
                              ) : driversLoading ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, color: t.textMuted, fontSize: 12 }}>
                                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                                  Chargement...
                                </div>
                              ) : drivers.length === 0 ? (
                                <span style={{ fontSize: 11, color: t.textFaint }}>Aucun chauffeur</span>
                              ) : (
                                <InlineDriverPicker
                                  drivers={drivers}
                                  onSelect={(driverId) => handleAssign(pkg.id, driverId)}
                                  t={t}
                                  isDark={isDark}
                                />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                      })()); return acc;
                    }, { rows: [] as React.ReactNode[], lastSender: "" }).rows}
                </tbody>
              </table>
            </div>
          )}
        </>)}
        </>
      )}

      {/* Empty state when no SD selected */}
      {selectedSD === null && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          padding: "48px 24px", textAlign: "center", boxShadow: t.shadow,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
            background: "rgba(249,115,22,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <PackagePlus size={28} style={{ color: "#f97316" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>
            Selectionnez un Stop Desk
          </div>
          <div style={{ fontSize: 13, color: t.textMuted }}>
            Choisissez un Stop Desk ci-dessus pour voir les colis pickup a recuperer
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
