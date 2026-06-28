"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Boxes, Search, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Loader2, Phone, MapPin, Truck, CreditCard, Package2,
  Home, Building2, Clock, RefreshCw, Filter, Printer, Trash2, PackageOpen, Pencil,
} from "lucide-react";
import { getExpPackages, updateExpPackage } from "@/lib/expediteur";
import { api } from "@/lib/api";
import PackageLabel from "@/components/PackageLabel";
import {
  type Package, type PackageStatus,
  STATUS_LABELS, STATUS_COLORS,
} from "@/lib/packages";
import { getWilayas, getCommunes, getStopDesks, type Wilaya, type Commune, type StopDesk } from "@/lib/geography";

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
    textFaint: "#4b5563", shadow: "none",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6",
    rowHover: "#f9fafb", text: "#111827", textSub: "#374151", textMuted: "#6b7280",
    textFaint: "#9ca3af", shadow: "0 1px 2px rgba(0,0,0,0.06)",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── helpers ──────────────────────────────────────────────── */
const PER_PAGE = 20;

function formatDA(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("fr-DZ") + " DA";
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDatetime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ── status filter config ─────────────────────────────────── */
const FILTER_STATUSES: PackageStatus[] = [
  "en_attente", "pret_a_expedier", "demande_ramassage", "en_ramassage", "en_transit", "arrive_destination",
  "pret_pour_retrait", "pret_pour_chauffeur", "en_cours_livraison", "livre", "echec_livraison",
];

/* ── status chip ──────────────────────────────────────────── */
function StatusChip({ status }: { status: PackageStatus }) {
  const c = STATUS_COLORS[status] || { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 9999,
      background: c.bg, color: c.text,
      fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/* ── timeline row ────────────────────────────────────────── */
function TimelineEntry({
  label, date, isLast, color, isCurrent,
}: { label: string; date: string | null | undefined; isLast: boolean; color: string; isCurrent?: boolean }) {
  const done = !!date;
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 18 }}>
        {isCurrent ? (
          <div style={{
            width: 14, height: 14, borderRadius: "50%",
            border: `3px solid ${color}`, background: color,
            boxShadow: `0 0 0 3px ${color}30`,
            flexShrink: 0, marginTop: 2,
          }} />
        ) : (
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: done ? color : "transparent",
            border: done ? "none" : `2px dashed #9ca3af`,
            flexShrink: 0, marginTop: 4,
          }} />
        )}
        {!isLast && <div style={{ width: 2, flex: 1, background: done ? color : "#d1d5db", opacity: done ? 0.5 : 0.2, marginTop: 2 }} />}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 10 }}>
        <div style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 600, color: isCurrent ? color : undefined, opacity: done || isCurrent ? 1 : 0.35 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.5 }}>{date ? fmtDatetime(date) : "—"}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  PAGE                                                      */
/* ═══════════════════════════════════════════════════════════ */
export default function ExpColis() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  /* ── state ──────────────────────────────────────────────── */
  const [packages, setPackages] = useState<Package[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<PackageStatus>>(new Set());
  const [wilayaId, setWilayaId] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pickupSubmitting, setPickupSubmitting] = useState(false);
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);

  /* ── debounce search ─────────────────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── load wilayas ───────────────────────────────────────── */
  useEffect(() => {
    getWilayas().then((r) => { if (r.success && r.data) setWilayas(r.data); });
  }, []);

  /* ── fetch packages ─────────────────────────────────────── */
  const fetchPackages = useCallback(async () => {
    setLoading(true);
    const statusParam = selectedStatuses.size > 0
      ? Array.from(selectedStatuses).join(",")
      : undefined;
    const res = await getExpPackages({
      status: statusParam,
      search: searchDebounced || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      destination_wilaya_id: wilayaId ? Number(wilayaId) : undefined,
      page,
      per_page: PER_PAGE,
    });
    if (res.success && res.data) {
      setPackages(res.data.data || []);
      setLastPage(res.data.last_page || 1);
      setTotal(res.data.total || 0);
    }
    setLoading(false);
  }, [page, searchDebounced, selectedStatuses, wilayaId, dateFrom, dateTo]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  /* reset page on filter change */
  useEffect(() => { setPage(1); }, [searchDebounced, selectedStatuses, wilayaId, dateFrom, dateTo]);

  /* ── status toggle ──────────────────────────────────────── */
  function toggleStatus(s: PackageStatus) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  /* ── selection ──────────────────────────────────────────── */
  const selectableIds = useMemo(
    () => packages.filter((p) => p.status === "en_attente").map((p) => p.id),
    [packages],
  );

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectableIds.every((id) => selectedIds.has(id)) && selectableIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  }

  async function submitPickupRequest() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Demander un ramassage pour ${selectedIds.size} colis ?`)) return;
    setPickupSubmitting(true);
    const res = await api("/expediteur/pickup-request", {
      method: "POST",
      body: JSON.stringify({ package_ids: Array.from(selectedIds) }),
    });
    setPickupSubmitting(false);
    if (res.success) {
      const d = (res.data ?? {}) as { requested?: number; skipped?: number };
      alert(`Ramassage demandé pour ${d.requested ?? 0} colis${d.skipped ? ` (${d.skipped} ignorés)` : ""}`);
      setSelectedIds(new Set());
      fetchPackages();
    } else {
      alert("Erreur lors de la demande de ramassage");
    }
  }

  /* ── quick date ─────────────────────────────────────────── */
  function setQuickDate(key: "today" | "7" | "30" | "all") {
    if (key === "all") { setDateFrom(""); setDateTo(""); }
    else if (key === "today") { setDateFrom(todayStr()); setDateTo(todayStr()); }
    else if (key === "7") { setDateFrom(daysAgo(7)); setDateTo(todayStr()); }
    else if (key === "30") { setDateFrom(daysAgo(30)); setDateTo(todayStr()); }
  }

  /* ── shared styles ──────────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
    background: t.inp.bg, color: t.inp.text, fontSize: 13, outline: "none",
    transition: "border-color 0.15s",
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${active ? "#3b82f6" : t.border}`,
    background: active ? "rgba(59,130,246,0.12)" : "transparent",
    color: active ? "#3b82f6" : t.textMuted,
    transition: "all 0.15s",
  });

  /* ── timeline steps ─────────────────────────────────────── */
  function getTimeline(p: Package) {
    const isPickup = p.service_type === "pickup";
    const isHomeDel = p.delivery_type === "home_delivery";

    // Build ordered status path for this package type
    const path: { label: string; color: string; status: string }[] = [];

    path.push({ label: "Créé", color: "#6b7280", status: "en_attente" });
    if (isPickup) {
      path.push({ label: "Demande ramassage", color: "#f59e0b", status: "demande_ramassage" });
      path.push({ label: "En ramassage", color: "#9333ea", status: "en_ramassage" });
    }
    path.push({ label: "Accepté au SD", color: "#10b981", status: "accepte_operateur" });
    path.push({ label: "En sac", color: "#6366f1", status: "en_sac" });
    path.push({ label: "En transit", color: "#f97316", status: "en_transit" });
    path.push({ label: "Arrivé destination", color: "#14b8a6", status: "arrive_destination" });
    if (isHomeDel) {
      path.push({ label: "Prêt pour chauffeur", color: "#7c3aed", status: "pret_pour_chauffeur" });
      path.push({ label: "En livraison", color: "#ea580c", status: "en_cours_livraison" });
    } else {
      path.push({ label: "Prêt pour retrait", color: "#8b5cf6", status: "pret_pour_retrait" });
    }

    // Terminal status
    const isFailed = ["echec_livraison", "retour_en_sac", "retour_en_transit", "retour_arrive", "retourne"].includes(p.status);
    if (isFailed) {
      path.push({ label: "Échec livraison", color: "#ef4444", status: "echec_livraison" });
      if (p.status === "retourne") {
        path.push({ label: "Retourné", color: "#a855f7", status: "retourne" });
      }
    } else {
      path.push({ label: "Livré", color: "#22c55e", status: "livre" });
    }

    // Find current status index in path
    const currentIdx = path.findIndex(s => s.status === p.status);

    // Mark each step: done (before current), current, or future (after current)
    return path.map((step, i) => ({
      ...step,
      // "date" is used by TimelineEntry to show solid vs dashed dot
      // Steps before current = done (pass a truthy date), current and after = null
      date: i < currentIdx ? p.created_at : (i === currentIdx ? p.created_at : null),
    }));
  }

  const activeFilterCount = selectedStatuses.size
    + (wilayaId ? 1 : 0)
    + (dateFrom ? 1 : 0)
    + (dateTo ? 1 : 0);

  /* ═════════════════════════════════════════════════════════ */
  /*  RENDER                                                   */
  /* ═════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      <div style={{
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* ── Header ────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(59,130,246,0.1)",
            }}>
              <Boxes size={18} color="#3b82f6" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>Mes Colis</h1>
              <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
                {total} colis au total
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedIds.size > 0 && (
              <button
                onClick={submitPickupRequest}
                disabled={pickupSubmitting}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                  borderRadius: 8, border: "1px solid #f97316", background: "#f97316",
                  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: pickupSubmitting ? 0.6 : 1,
                }}
              >
                {pickupSubmitting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <PackageOpen size={14} />}
                Demander ramassage ({selectedIds.size})
              </button>
            )}
            <button
              onClick={fetchPackages}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                borderRadius: 8, border: `1px solid ${t.border}`, background: t.card,
                color: t.textSub, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              <RefreshCw size={14} />
              Actualiser
            </button>
          </div>
        </div>

        {/* ── Search + filter toggle ────────────────────────── */}
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          <div style={{ position: "relative", flex: "1 1 280px", minWidth: 200 }}>
            <Search size={15} color={t.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tracking, nom ou tel du destinataire..."
              style={{ ...inputStyle, width: "100%", paddingLeft: 32, paddingRight: search ? 30 : 10 }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                  display: "flex", alignItems: "center",
                }}
              >
                <X size={14} color={t.textMuted} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((p) => !p)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 8, border: `1px solid ${activeFilterCount > 0 ? "#3b82f6" : t.border}`,
              background: activeFilterCount > 0 ? "rgba(59,130,246,0.08)" : t.card,
              color: activeFilterCount > 0 ? "#3b82f6" : t.textSub,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            <Filter size={14} />
            Filtres
            {activeFilterCount > 0 && (
              <span style={{
                width: 18, height: 18, borderRadius: "50%", background: "#3b82f6",
                color: "#fff", fontSize: 10, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* ── Expanded filters ──────────────────────────────── */}
        {showFilters && (
          <div style={{
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
            padding: 16, display: "flex", flexDirection: "column", gap: 14,
            boxShadow: t.shadow,
          }}>
            {/* Status chips */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Statut</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {FILTER_STATUSES.map((s) => {
                  const active = selectedStatuses.has(s);
                  const sc = STATUS_COLORS[s];
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      style={{
                        padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", transition: "all 0.15s",
                        border: `1px solid ${active ? sc.dot : t.border}`,
                        background: active ? sc.bg : "transparent",
                        color: active ? sc.text : t.textMuted,
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
                {selectedStatuses.size > 0 && (
                  <button
                    onClick={() => setSelectedStatuses(new Set())}
                    style={{
                      padding: "4px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 500,
                      cursor: "pointer", border: "none", background: "rgba(239,68,68,0.1)",
                      color: "#ef4444",
                    }}
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            {/* Wilaya + dates */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* Wilaya */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Wilaya destination</label>
                <select
                  value={wilayaId}
                  onChange={(e) => setWilayaId(e.target.value ? Number(e.target.value) : "")}
                  style={{ ...inputStyle, minWidth: 160, cursor: "pointer" }}
                >
                  <option value="">Toutes</option>
                  {wilayas.map((w) => (
                    <option key={w.id} value={w.id}>{w.code ? `${w.code} - ` : ""}{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Du</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ ...inputStyle, minWidth: 140 }}
                />
              </div>

              {/* Date to */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Au</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ ...inputStyle, minWidth: 140 }}
                />
              </div>

              {/* Quick dates */}
              <div style={{ display: "flex", gap: 6, paddingBottom: 1 }}>
                {[
                  { label: "Aujourd'hui", key: "today" as const },
                  { label: "7j", key: "7" as const },
                  { label: "30j", key: "30" as const },
                  { label: "Tout", key: "all" as const },
                ].map((q) => {
                  const isActive =
                    (q.key === "today" && dateFrom === todayStr() && dateTo === todayStr()) ||
                    (q.key === "7" && dateFrom === daysAgo(7) && dateTo === todayStr()) ||
                    (q.key === "30" && dateFrom === daysAgo(30) && dateTo === todayStr()) ||
                    (q.key === "all" && !dateFrom && !dateTo);
                  return (
                    <button
                      key={q.key}
                      onClick={() => setQuickDate(q.key)}
                      style={btnStyle(isActive)}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────── */}
        <div style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
          boxShadow: t.shadow, overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse", fontSize: 13,
            }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                  <th style={{
                    padding: "10px 8px 10px 12px", textAlign: "center", width: 32,
                    position: "sticky", top: 0, background: t.card,
                  }}>
                    <input
                      type="checkbox"
                      checked={selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))}
                      onChange={toggleSelectAll}
                      disabled={selectableIds.length === 0}
                      title="Tout sélectionner"
                      style={{ cursor: selectableIds.length === 0 ? "not-allowed" : "pointer" }}
                    />
                  </th>
                  {["Tracking", "Statut", "Destinataire", "Téléphone", "Wilaya / Commune", "COD", "Frais", "Type", "Date"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px", textAlign: "left", fontSize: 11,
                        fontWeight: 700, color: t.textMuted, textTransform: "uppercase",
                        letterSpacing: "0.04em", whiteSpace: "nowrap",
                        position: "sticky", top: 0, background: t.card,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 48, textAlign: "center" }}>
                      <Loader2 size={24} color={t.textMuted} style={{ animation: "spin 1s linear infinite" }} />
                      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </td>
                  </tr>
                ) : packages.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 48, textAlign: "center" }}>
                      <Package2 size={36} color={t.textFaint} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>Aucun colis trouvé</div>
                      <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
                        Essayez de modifier vos filtres de recherche
                      </div>
                    </td>
                  </tr>
                ) : packages.map((p) => (
                  <PackageRow
                    key={p.id}
                    pkg={p}
                    t={t}
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    getTimeline={getTimeline}
                    onDelete={(id) => setPackages(prev => prev.filter(pk => pk.id !== id))}
                    onEdit={(pkg) => setEditingPkg(pkg)}
                    selected={selectedIds.has(p.id)}
                    selectable={p.status === "en_attente"}
                    onToggleSelect={() => toggleSelect(p.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ────────────────────────────────────── */}
          {lastPage > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderTop: `1px solid ${t.divider}`,
              fontSize: 13, color: t.textMuted,
            }}>
              <span>Page {page} / {lastPage} — {total} colis</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                    borderRadius: 6, border: `1px solid ${t.border}`, background: t.card,
                    color: page <= 1 ? t.textFaint : t.textSub, fontSize: 12, fontWeight: 500,
                    cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={14} /> Préc.
                </button>
                <button
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                    borderRadius: 6, border: `1px solid ${t.border}`, background: t.card,
                    color: page >= lastPage ? t.textFaint : t.textSub, fontSize: 12, fontWeight: 500,
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

      {/* ── Edit Modal ──────────────────────────────────────── */}
      {editingPkg && (
        <EditPackageModal
          pkg={editingPkg}
          t={t}
          isDark={isDark}
          wilayas={wilayas}
          onClose={() => setEditingPkg(null)}
          onSaved={() => { setEditingPkg(null); fetchPackages(); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  PACKAGE ROW (with expandable detail)                      */
/* ═══════════════════════════════════════════════════════════ */
function PackageRow({
  pkg: p, t, expanded, onToggle, getTimeline, onDelete, onEdit,
  selected, selectable, onToggleSelect,
}: {
  pkg: Package; t: Tokens; expanded: boolean;
  onToggle: () => void;
  getTimeline: (p: Package) => { label: string; date: string | null | undefined; color: string; status?: string }[];
  onDelete?: (id: number) => void;
  onEdit?: (pkg: Package) => void;
  selected: boolean;
  selectable: boolean;
  onToggleSelect: () => void;
}) {
  const wilayaName = p.recipient_wilaya?.name || `W${p.recipient_wilaya_id}`;
  const communeName = p.recipient_commune?.name || "";
  const timeline = useMemo(() => getTimeline(p), [p, getTimeline]);

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: `1px solid ${t.divider}`,
          cursor: "pointer",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <td
          onClick={(e) => e.stopPropagation()}
          style={{ padding: "10px 8px 10px 12px", textAlign: "center", width: 32 }}
        >
          <input
            type="checkbox"
            checked={selected}
            disabled={!selectable}
            onChange={onToggleSelect}
            title={selectable ? "Sélectionner pour ramassage" : "Disponible uniquement pour les colis en attente"}
            style={{ cursor: selectable ? "pointer" : "not-allowed" }}
          />
        </td>
        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12, fontWeight: 600, color: t.text, whiteSpace: "nowrap" }}>
          <div>
            {p.external_shipment?.external_tracking ?? p.tracking_number}
            {p.tracking_number.startsWith("ECH-") && (
              <div style={{ marginTop: 2 }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: "#7c3aed", background: "rgba(139,92,246,0.1)", padding: "1px 5px", borderRadius: 4, fontFamily: "sans-serif" }}>RETOUR</span>
                {p.content_description?.match(/réf: (DLV-[\w-]+)/)?.[1] && (
                  <span style={{ fontSize: 9, color: "#9ca3af", fontFamily: "sans-serif", marginLeft: 4 }}>
                    ← {p.content_description.match(/réf: (DLV-[\w-]+)/)?.[1]}
                  </span>
                )}
              </div>
            )}
            {p.service_type === "echange" && !p.tracking_number.startsWith("ECH-") && (
              <div style={{ marginTop: 2 }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: "#7c3aed", background: "rgba(139,92,246,0.1)", padding: "1px 5px", borderRadius: 4, fontFamily: "sans-serif" }}>ÉCHANGE</span>
              </div>
            )}
          </div>
        </td>
        <td style={{ padding: "10px 12px" }}>
          <StatusChip status={p.status} />
        </td>
        <td style={{ padding: "10px 12px", color: t.textSub, fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.recipient_name}
        </td>
        <td style={{ padding: "10px 12px", color: t.textMuted, fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>
          {p.recipient_phone}
        </td>
        <td style={{ padding: "10px 12px", color: t.textSub, fontSize: 12, whiteSpace: "nowrap" }}>
          {wilayaName}{communeName ? ` / ${communeName}` : ""}
        </td>
        <td style={{ padding: "10px 12px", fontWeight: 600, color: t.text, whiteSpace: "nowrap", fontSize: 12 }}>
          {formatDA(p.cod_amount)}
        </td>
        <td style={{ padding: "10px 12px", color: t.textMuted, whiteSpace: "nowrap", fontSize: 12 }}>
          {formatDA(p.shipping_cost)}
        </td>
        <td style={{ padding: "10px 12px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: p.delivery_type === "home_delivery" ? "rgba(249,115,22,0.1)" : "rgba(99,102,241,0.1)",
            color: p.delivery_type === "home_delivery" ? "#ea580c" : "#4f46e5",
          }}>
            {p.delivery_type === "home_delivery" ? <Home size={11} /> : <Building2 size={11} />}
            {p.delivery_type === "home_delivery" ? "Domicile" : "Bureau"}
          </span>
        </td>
        <td style={{ padding: "10px 12px", color: t.textMuted, whiteSpace: "nowrap", fontSize: 12 }}>
          {fmtDate(p.created_at)}
        </td>
        <td style={{ padding: "10px 6px", textAlign: "center", width: 60 }}>
          <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
            <PrintLabelButton pkg={p} iconOnly />
            {p.status === "en_attente" && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit?.(p); }}
                  title="Modifier"
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "#3b82f6", padding: 4, display: "flex", alignItems: "center",
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Supprimer ${p.tracking_number} ?`)) return;
                    const res = await api(`/packages/${p.id}`, { method: "DELETE" });
                    if (res.success) onDelete?.(p.id);
                  }}
                  title="Supprimer"
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "#ef4444", padding: 4, display: "flex", alignItems: "center",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* ── Expanded detail ───────────────────────────────── */}
      {expanded && (
        <tr>
          <td colSpan={10} style={{ padding: 0 }}>
            <div style={{
              background: isDarkBg(t) ? "#0d1018" : "#f8f9fb",
              borderBottom: `1px solid ${t.divider}`,
              padding: "16px 20px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
            }}>
              {/* Info column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                  Informations
                </div>
                <DetailRow icon={<MapPin size={13} />} label="Adresse" value={p.recipient_address || "—"} t={t} />
                <DetailRow icon={<Phone size={13} />} label="Téléphone" value={p.recipient_phone} t={t} />
                <DetailRow icon={<Package2 size={13} />} label="Contenu" value={p.content_description || "—"} t={t} />
                {p.weight && <DetailRow icon={<Package2 size={13} />} label="Poids" value={`${p.weight} kg`} t={t} />}
                {p.special_instructions && <DetailRow icon={<Package2 size={13} />} label="Instructions" value={p.special_instructions} t={t} />}
                {p.fragile && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#ef4444", fontSize: 12, fontWeight: 600 }}>
                    ⚠ Fragile
                  </span>
                )}
              </div>

              {/* Financial column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                  Financier
                </div>
                <DetailRow icon={<CreditCard size={13} />} label="COD" value={formatDA(p.cod_amount)} t={t} />
                <DetailRow icon={<CreditCard size={13} />} label="Frais livraison" value={formatDA(p.shipping_cost)} t={t} />
                <DetailRow icon={<CreditCard size={13} />} label="Valeur déclarée" value={formatDA(p.declared_value)} t={t} />
                {p.return_cost != null && Number(p.return_cost) > 0 && (
                  <DetailRow icon={<CreditCard size={13} />} label="Coût retour" value={formatDA(p.return_cost)} t={t} />
                )}
                <DetailRow icon={<Truck size={13} />} label="Paiement" value={p.payment_type === "sender" ? "Expéditeur" : "Destinataire"} t={t} />
              </div>

              {/* Timeline column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                  Chronologie
                </div>
                {timeline.map((step, i) => (
                  <TimelineEntry
                    key={step.label}
                    label={step.label}
                    date={step.date}
                    color={step.color}
                    isLast={i === timeline.length - 1}
                    isCurrent={step.status === p.status}
                  />
                ))}
              </div>

              {/* Driver info if assigned */}
              {p.driver && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                    Chauffeur
                  </div>
                  <DetailRow icon={<Truck size={13} />} label="Nom" value={`${p.driver.first_name} ${p.driver.last_name}`} t={t} />
                  {p.driver.phone && <DetailRow icon={<Phone size={13} />} label="Tel" value={p.driver.phone} t={t} />}
                  {p.driver_assigned_at && <DetailRow icon={<Clock size={13} />} label="Assigné le" value={fmtDatetime(p.driver_assigned_at)} t={t} />}
                </div>
              )}

              {/* Print label */}
              <PrintLabelButton pkg={p} />

              {/* Échange info */}
              {p.service_type === "echange" && (
                <div style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <Package2 size={13} /> Échange
                  </div>
                  {(p as any).exchange_product && (
                    <div style={{ fontSize: 12, color: t.textSub }}>Produit à récupérer: <b>{(p as any).exchange_product}</b></div>
                  )}
                  {p.content_description?.includes("réf:") && (
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      Colis retour lié à l'original
                    </div>
                  )}
                  {p.tracking_number.startsWith("ECH-") && (
                    <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, marginTop: 4 }}>
                      ↩ Colis retour échange — en route vers votre SD
                    </div>
                  )}
                </div>
              )}
              {p.tracking_number.startsWith("ECH-") && p.service_type !== "echange" && (
                <div style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", display: "flex", alignItems: "center", gap: 6 }}>
                    <Package2 size={13} /> Retour Échange
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                    Ce colis contient le produit d'échange en retour vers votre SD
                  </div>
                </div>
              )}

              {/* Echec reason */}
              {p.echec_reason && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 2 }}>
                    Raison d'échec
                  </div>
                  <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>{p.echec_reason}</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── detail row ──────────────────────────────────────────── */
function DetailRow({ icon, label, value, t }: {
  icon: React.ReactNode; label: string; value: string; t: Tokens;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
      <span style={{ color: t.textMuted, marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <span style={{ color: t.textMuted }}>{label}: </span>
        <span style={{ color: t.textSub, fontWeight: 500 }}>{value}</span>
      </div>
    </div>
  );
}

function PrintLabelButton({ pkg, iconOnly }: { pkg: Package; iconOnly?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <>
      {iconOnly ? (
        <button onClick={e => { e.stopPropagation(); setShow(true); }} title="Imprimer l'étiquette" style={{
          width: 26, height: 26, borderRadius: 6, display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          background: "transparent", border: "none", cursor: "pointer", color: "#9ca3af",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
          onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
        >
          <Printer size={14} />
        </button>
      ) : (
        <button onClick={() => setShow(true)} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb",
          background: "transparent", color: "#6b7280",
          fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4,
        }}>
          <Printer size={13} /> Imprimer l&apos;étiquette
        </button>
      )}
      {show && <PackageLabel pkg={pkg} onClose={() => setShow(false)} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  EDIT PACKAGE MODAL                                        */
/* ═══════════════════════════════════════════════════════════ */
function EditPackageModal({
  pkg, t, isDark, wilayas, onClose, onSaved,
}: {
  pkg: Package; t: Tokens; isDark: boolean; wilayas: Wilaya[];
  onClose: () => void; onSaved: () => void;
}) {
  const [recipientName, setRecipientName] = useState(pkg.recipient_name);
  const [recipientPhone, setRecipientPhone] = useState(pkg.recipient_phone);
  const [recipientWilayaId, setRecipientWilayaId] = useState<number | "">(pkg.recipient_wilaya_id);
  const [recipientCommuneId, setRecipientCommuneId] = useState<number | "">(pkg.recipient_commune_id || "");
  const [recipientAddress, setRecipientAddress] = useState(pkg.recipient_address || "");
  const [deliveryType, setDeliveryType] = useState<"home_delivery" | "stop_desk">(pkg.delivery_type);
  const [destStopDeskId, setDestStopDeskId] = useState<number | "">(pkg.destination_stop_desk_id || "");
  const [contentDesc, setContentDesc] = useState(pkg.content_description || "");
  const [codAmount, setCodAmount] = useState(String(pkg.cod_amount ?? ""));
  const [weight, setWeight] = useState(pkg.weight ? String(pkg.weight) : "");
  const [paymentType, setPaymentType] = useState<"sender" | "recipient">(pkg.payment_type);
  const [fragile, setFragile] = useState(pkg.fragile);
  const [specialInstructions, setSpecialInstructions] = useState(pkg.special_instructions || "");

  const [communes, setCommunes] = useState<Commune[]>([]);
  const [communesLoading, setCommunesLoading] = useState(false);
  const [destSDs, setDestSDs] = useState<StopDesk[]>([]);
  const [destSDsLoading, setDestSDsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Fetch communes when wilaya changes ── */
  useEffect(() => {
    if (!recipientWilayaId) { setCommunes([]); setRecipientCommuneId(""); return; }
    let cancelled = false;
    setCommunesLoading(true);
    getCommunes(recipientWilayaId as number).then((res) => {
      if (!cancelled && res.success && res.data) setCommunes(res.data);
      setCommunesLoading(false);
    });
    return () => { cancelled = true; };
  }, [recipientWilayaId]);

  /* ── Keep commune selected if it matches initial data ── */
  useEffect(() => {
    if (communes.length > 0 && pkg.recipient_commune_id && recipientWilayaId === pkg.recipient_wilaya_id) {
      setRecipientCommuneId(pkg.recipient_commune_id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communes]);

  /* ── Fetch destination SDs when commune changes (for stop_desk) ── */
  useEffect(() => {
    if (!recipientCommuneId || deliveryType !== "stop_desk") { setDestSDs([]); setDestStopDeskId(""); return; }
    let cancelled = false;
    setDestSDsLoading(true);
    getStopDesks(recipientCommuneId as number).then((res) => {
      if (!cancelled && res.success && res.data) {
        setDestSDs(res.data);
        if (res.data.length === 1) setDestStopDeskId(res.data[0].id);
        else if (pkg.destination_stop_desk_id && res.data.some(sd => sd.id === pkg.destination_stop_desk_id)) {
          setDestStopDeskId(pkg.destination_stop_desk_id);
        }
      }
      setDestSDsLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientCommuneId, deliveryType]);

  /* ── Submit ── */
  async function handleSave() {
    if (!recipientName.trim()) { setError("Le nom du destinataire est requis."); return; }
    if (!recipientPhone.trim()) { setError("Le téléphone est requis."); return; }
    if (!recipientWilayaId) { setError("La wilaya est requise."); return; }
    if (!contentDesc.trim()) { setError("La description du contenu est requise."); return; }
    if (deliveryType === "stop_desk" && !destStopDeskId && destSDs.length > 0 && pkg.routing_type !== "external") {
      setError("Veuillez sélectionner un point de retrait."); return;
    }

    setError(null);
    setSubmitting(true);
    const data: Record<string, any> = {
      recipient_name: recipientName.trim(),
      recipient_phone: recipientPhone.trim(),
      recipient_wilaya_id: Number(recipientWilayaId),
      recipient_commune_id: recipientCommuneId ? Number(recipientCommuneId) : null,
      recipient_address: recipientAddress.trim() || null,
      delivery_type: deliveryType,
      destination_stop_desk_id: deliveryType === "stop_desk" && destStopDeskId ? Number(destStopDeskId) : null,
      content_description: contentDesc.trim(),
      cod_amount: codAmount ? Number(codAmount) : 0,
      weight: weight ? Number(weight) : null,
      payment_type: paymentType,
      fragile,
      special_instructions: specialInstructions.trim() || null,
    };

    const res = await updateExpPackage(pkg.id, data);
    setSubmitting(false);
    if (res.success) {
      onSaved();
    } else {
      setError((res as any).message || "Erreur lors de la mise à jour.");
    }
  }

  /* ── Styles ── */
  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16,
  };

  const modalStyle: React.CSSProperties = {
    background: t.card, border: `1px solid ${t.border}`, borderRadius: 16,
    width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto",
    boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: `1px solid ${t.inp.border}`, background: t.inp.bg,
    color: t.inp.text, fontSize: 13, outline: "none",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: t.textMuted, marginBottom: 4,
  };

  const saveBtnStyle: React.CSSProperties = {
    padding: "9px 24px", borderRadius: 8, border: "none",
    background: "#3b82f6", color: "#fff",
    fontSize: 13, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
    opacity: submitting ? 0.6 : 1,
    display: "flex", alignItems: "center", gap: 6,
  };

  const cancelBtnStyle: React.CSSProperties = {
    padding: "9px 16px", borderRadius: 8,
    border: `1px solid ${t.border}`, background: "transparent",
    color: t.textSub, fontSize: 13, fontWeight: 500, cursor: "pointer",
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${t.divider}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: "rgba(59,130,246,0.1)",
            }}>
              <Pencil size={16} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Modifier le colis</div>
              <div style={{ fontSize: 11, color: t.textMuted }}>{pkg.tracking_number}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: t.textMuted, padding: 4, display: "flex",
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444", fontSize: 12, fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* ── Destinataire ── */}
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Destinataire</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Nom *</label>
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone *</label>
              <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Wilaya *</label>
              <select
                value={recipientWilayaId}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : "";
                  setRecipientWilayaId(v);
                  setRecipientCommuneId("");
                  setDestSDs([]);
                  setDestStopDeskId("");
                }}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">-- Sélectionner --</option>
                {wilayas.map((w) => (
                  <option key={w.id} value={w.id}>{w.code ? `${w.code} - ` : ""}{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Commune</label>
              <select
                value={recipientCommuneId}
                onChange={(e) => {
                  setRecipientCommuneId(e.target.value ? Number(e.target.value) : "");
                  setDestSDs([]);
                  setDestStopDeskId("");
                }}
                disabled={communesLoading || communes.length === 0}
                style={{ ...inputStyle, cursor: communes.length > 0 ? "pointer" : "not-allowed" }}
              >
                <option value="">{communesLoading ? "Chargement..." : "-- Sélectionner --"}</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Adresse</label>
            <input value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} style={inputStyle} placeholder="Adresse de livraison" />
          </div>

          {/* ── Mode de livraison ── */}
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 4 }}>Mode de livraison</div>
          <div>
            <div style={{
              display: "inline-flex", borderRadius: 8, padding: 2,
              background: isDark ? "#1a1f2e" : "#f1f5f9",
            }}>
              {([
                { key: "home_delivery" as const, label: "À domicile" },
                { key: "stop_desk" as const, label: "Stop Desk" },
              ]).map(opt => {
                const active = deliveryType === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => { setDeliveryType(opt.key); setDestStopDeskId(""); }}
                    style={{
                      padding: "7px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", border: "none", transition: "all 0.15s",
                      background: active ? (isDark ? "#0e1017" : "#fff") : "transparent",
                      color: active ? (isDark ? "#f5f5f5" : "#111827") : (isDark ? "#52525b" : "#94a3b8"),
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stop desk picker */}
          {deliveryType === "stop_desk" && (
            <div>
              {!recipientCommuneId ? (
                <p style={{ fontSize: 11, color: t.textMuted, margin: 0 }}>Sélectionnez la commune d&apos;abord</p>
              ) : destSDsLoading ? (
                <p style={{ fontSize: 11, color: t.textMuted, margin: 0 }}>Chargement des points de retrait...</p>
              ) : destSDs.length === 0 ? (
                pkg.routing_type === "external" ? null : (
                <p style={{ fontSize: 11, color: t.textMuted, margin: 0 }}>
                  Aucun point de retrait disponible
                </p>
                )
              ) : destSDs.length === 1 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={14} style={{ color: "#10b981" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                    {destSDs[0].name}{destSDs[0].code ? ` (${destSDs[0].code})` : ""}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#10b981" }}>Auto-sélectionné</span>
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Point de retrait *</label>
                  <select
                    value={destStopDeskId}
                    onChange={(e) => setDestStopDeskId(e.target.value ? Number(e.target.value) : "")}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="">-- Sélectionner --</option>
                    {destSDs.map((sd) => (
                      <option key={sd.id} value={sd.id}>{sd.name}{sd.code ? ` (${sd.code})` : ""}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── Détails du colis ── */}
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 4 }}>Détails du colis</div>
          <div>
            <label style={labelStyle}>Description du contenu *</label>
            <input value={contentDesc} onChange={(e) => setContentDesc(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Montant COD (DA)</label>
              <input
                type="number" min="0" value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                style={inputStyle} placeholder="0"
              />
            </div>
            <div>
              <label style={labelStyle}>Poids (kg)</label>
              <input
                type="number" min="0" step="0.1" value={weight}
                onChange={(e) => setWeight(e.target.value)}
                style={inputStyle} placeholder="0"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Paiement livraison</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as "sender" | "recipient")}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="sender">Expéditeur</option>
                <option value="recipient">Destinataire</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
              <label style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 500, color: t.textSub,
              }}>
                <input
                  type="checkbox" checked={fragile}
                  onChange={(e) => setFragile(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Fragile
              </label>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Instructions spéciales</label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="Instructions pour le livreur..."
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
          padding: "12px 20px", borderTop: `1px solid ${t.divider}`,
        }}>
          <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
          <button onClick={handleSave} disabled={submitting} style={saveBtnStyle}>
            {submitting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── helper to detect dark bg ──────────────────────────── */
function isDarkBg(t: Tokens): boolean {
  return t.bg === "#0e1017";
}
