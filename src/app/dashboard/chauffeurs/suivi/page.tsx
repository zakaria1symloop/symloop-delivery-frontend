"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Package2, Search, Loader2, Filter, ChevronLeft, ChevronRight,
  Truck, MapPin, Phone, Clock, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { api, getStoredUser, isSDLocked, getLockedSDId } from "@/lib/api";
import SDSelector from "@/components/SDSelector";
import DriverSelector from "@/components/DriverSelector";
import {
  getLocalDrivers, getDriverPackages,
  type DriverKPIs, ECHEC_REASON_LABELS, type EchecReason,
} from "@/lib/drivers";

/* ── SD option type ──────────────────────────────────────── */
interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

/* ── Package shape (from driver packages endpoint) ──────── */
interface DriverPackage {
  id: number;
  tracking_number: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_commune: { id: number; name: string } | null;
  cod_amount: number | string;
  shipping_cost: number | string;
  status: string;
  echec_reason: string | null;
  driver_assigned_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
}

interface PaginatedDriverPackages {
  data: DriverPackage[];
  current_page: number;
  last_page: number;
  total: number;
}

const SUIVI_SD_KEY = "suivi_chauffeurs_selected_sd";
const PER_PAGE = 20;

/* ── Status config ───────────────────────────────────────── */
type SuiviStatus = "demande_ramassage" | "en_ramassage" | "accepte_operateur" | "pret_pour_chauffeur" | "en_cours_livraison" | "livre" | "echec_livraison" | "echange_retour";

const STATUS_CFG: Record<SuiviStatus, { label: string; bg: string; text: string; dot: string }> = {
  demande_ramassage:  { label: "Demande ram.", bg: "rgba(245,158,11,0.12)", text: "#d97706", dot: "#f59e0b" },
  en_ramassage:       { label: "En ramassage", bg: "rgba(168,85,247,0.12)", text: "#7c3aed", dot: "#a855f7" },
  accepte_operateur:  { label: "Reçu au SD",   bg: "rgba(20,184,166,0.12)", text: "#0d9488", dot: "#14b8a6" },
  pret_pour_chauffeur:{ label: "Prêt",         bg: "rgba(59,130,246,0.12)", text: "#2563eb", dot: "#3b82f6" },
  en_cours_livraison: { label: "En cours",     bg: "rgba(245,158,11,0.12)", text: "#d97706", dot: "#f59e0b" },
  livre:              { label: "Livré",        bg: "rgba(16,185,129,0.12)", text: "#059669", dot: "#10b981" },
  echec_livraison:    { label: "Échec",        bg: "rgba(239,68,68,0.12)",  text: "#dc2626", dot: "#ef4444" },
  echange_retour:     { label: "Éch. retour",  bg: "rgba(168,85,247,0.12)", text: "#7c3aed", dot: "#a855f7" },
};

const ALL_STATUSES: SuiviStatus[] = ["demande_ramassage", "en_ramassage", "accepte_operateur", "pret_pour_chauffeur", "en_cours_livraison", "livre", "echec_livraison", "echange_retour"];

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

/* ── helpers ─────────────────────────────────────────────── */
function formatDA(n: number | string) {
  return Number(n).toLocaleString("fr-DZ") + " DA";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/* ── main page ───────────────────────────────────────────── */
export default function SuiviChauffeursPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  /* SD context */
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const sdLoaded = useRef(false);

  /* Drivers */
  const [drivers, setDrivers] = useState<DriverKPIs[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);

  /* Tabs */
  const [suiviTab, setSuiviTab] = useState<"livraisons" | "attributions" | "recuperations">("livraisons");

  /* Filters */
  const [activeStatuses, setActiveStatuses] = useState<Set<SuiviStatus>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* Packages + pagination */
  const [packages, setPackages] = useState<DriverPackage[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  /* Auto-refresh tick (15s) for real-time sync */
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRefreshTick(x => x + 1), 15000);
    return () => clearInterval(id);
  }, []);

  /* ── Load stop desks ───────────────────────────────────── */
  useEffect(() => {
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); sdLoaded.current = true; return; }
        const saved = localStorage.getItem(SUIVI_SD_KEY);
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

  /* Persist SD selection */
  useEffect(() => {
    if (selectedSD !== null) localStorage.setItem(SUIVI_SD_KEY, String(selectedSD));
  }, [selectedSD]);

  /* ── Load drivers when SD changes ──────────────────────── */
  useEffect(() => {
    if (selectedSD === null) { setDrivers([]); setSelectedDriverId(null); return; }
    setLoadingDrivers(true);
    setSelectedDriverId(null);
    getLocalDrivers({ stop_desk_id: selectedSD }).then(res => {
      if (res.success && res.data) setDrivers(res.data);
      else setDrivers([]);
    }).finally(() => setLoadingDrivers(false));
  }, [selectedSD]);

  /* ── Load packages when filters change ─────────────────── */
  const fetchPackages = useCallback(async (p: number) => {
    if (!selectedDriverId) { setPackages([]); setTotal(0); setLastPage(1); return; }
    setLoading(true);
    try {
      const statusParam = activeStatuses.size > 0
        ? Array.from(activeStatuses).join(",")
        : undefined;
      const res = await getDriverPackages(selectedDriverId, {
        status: statusParam,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: p,
        per_page: PER_PAGE,
      });
      if (res.success && res.data) {
        const paginated = res.data as PaginatedDriverPackages;
        setPackages(paginated.data);
        setPage(paginated.current_page);
        setLastPage(paginated.last_page);
        setTotal(paginated.total);
      } else {
        setPackages([]);
        setTotal(0);
        setLastPage(1);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDriverId, activeStatuses, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
    fetchPackages(1);
  }, [fetchPackages]);

  // Re-fetch packages on auto-refresh tick (preserve current page)
  useEffect(() => {
    if (refreshTick > 0 && suiviTab === "livraisons" && selectedDriverId) {
      fetchPackages(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  /* ── Toggle status chip ────────────────────────────────── */
  function toggleStatus(s: SuiviStatus) {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  /* ── Quick date presets ────────────────────────────────── */
  function setQuickDate(preset: "today" | "7days" | "month" | "all") {
    switch (preset) {
      case "today": setDateFrom(todayStr()); setDateTo(todayStr()); break;
      case "7days": setDateFrom(daysAgoStr(7)); setDateTo(todayStr()); break;
      case "month": setDateFrom(monthStartStr()); setDateTo(todayStr()); break;
      case "all":   setDateFrom(""); setDateTo(""); break;
    }
  }

  /* ── Computed KPIs ─────────────────────────────────────── */
  const selectedDriver = drivers.find(d => d.id === selectedDriverId) ?? null;

  /* Count from current filtered result total + per-status if we have all data,
     but since we paginate, use the driver's KPI data when no date/status filter is set,
     otherwise show what we can from the paginated total. For accurate KPIs we rely on
     the driver object's pre-computed fields. */
  const kpiTotal = total;
  const kpiLivres = packages.filter(p => p.status === "livre").length;
  const kpiEchecs = packages.filter(p => p.status === "echec_livraison").length;

  /* When we have a driver selected and no specific filters, use their global KPIs */
  const useGlobalKPIs = selectedDriver && activeStatuses.size === 0 && !dateFrom && !dateTo;
  const displayTotal = useGlobalKPIs ? selectedDriver.total_assigned : kpiTotal;
  const displayLivres = useGlobalKPIs ? selectedDriver.total_delivered : kpiLivres;
  const displayEchecs = useGlobalKPIs ? selectedDriver.total_failed : kpiEchecs;
  const displayRate = displayTotal > 0
    ? ((displayLivres / displayTotal) * 100).toFixed(1)
    : "0.0";

  /* ── Styles ────────────────────────────────────────────── */
  const cardStyle: React.CSSProperties = {
    background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
    boxShadow: t.shadow, padding: 20,
  };

  const inpStyle: React.CSSProperties = {
    background: t.inp.bg, border: `1px solid ${t.inp.border}`, borderRadius: 7,
    padding: "8px 11px", fontSize: 13, color: t.inp.text, outline: "none",
    transition: "border-color 0.15s", boxSizing: "border-box",
  };

  const selStyle: React.CSSProperties = {
    ...inpStyle, cursor: "pointer", appearance: "auto" as React.CSSProperties["appearance"],
  };

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: "rgba(249,115,22,0.1)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <Package2 size={20} color="#f97316" strokeWidth={2} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text, margin: 0, lineHeight: 1.2 }}>
            Suivi Chauffeurs
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>
            Historique et suivi des livraisons par chauffeur
          </p>
        </div>
      </div>

      {/* ── SD Selector ────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <SDSelector
          stopDesks={stopDesks}
          value={selectedSD}
          onChange={setSelectedSD}
          disabled={isSDLocked(getStoredUser())}
        />
      </div>

      {/* ── Global filters (above tabs) ────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ minWidth: 220, flex: "1 1 220px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>Chauffeur</label>
            {loadingDrivers ? <div style={{ padding: "8px 0", color: t.textMuted, fontSize: 12 }}>Chargement...</div> : (
              <DriverSelector drivers={drivers} value={selectedDriverId} onChange={setSelectedDriverId} />
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>Du</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inpStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>Au</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inpStyle} />
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 16,
        borderRadius: 12, overflow: "hidden", border: `1px solid ${t.border}`, width: "fit-content",
      }}>
        {([
          { key: "livraisons" as const, label: "Livraisons", color: "#f97316" },
          { key: "attributions" as const, label: "Attributions", color: "#3b82f6" },
          { key: "recuperations" as const, label: "Récupérations", color: "#10b981" },
        ]).map((tab, i, arr) => (
          <button key={tab.key} onClick={() => setSuiviTab(tab.key)} style={{
            padding: "12px 24px", fontSize: 14, fontWeight: 700,
            background: suiviTab === tab.key ? `${tab.color}18` : "transparent",
            color: suiviTab === tab.key ? tab.color : t.textMuted,
            border: "none", cursor: "pointer",
            borderRight: i < arr.length - 1 ? `1px solid ${t.border}` : "none",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Attribution History ─────────────────────────────── */}
      {suiviTab === "attributions" && selectedSD && (
        <ActivityLogTable t={t} isDark={isDark} selectedSD={selectedSD} driverId={selectedDriverId}
          action="attribution" dateFrom={dateFrom} dateTo={dateTo} title="Historique des attributions"
          color="#3b82f6" refreshTick={refreshTick} />
      )}

      {/* ── Récupération History ──────────────────────────────── */}
      {suiviTab === "recuperations" && selectedSD && (
        <ActivityLogTable t={t} isDark={isDark} selectedSD={selectedSD} driverId={selectedDriverId}
          action="recuperation" dateFrom={dateFrom} dateTo={dateTo} title="Historique des récupérations"
          color="#10b981" refreshTick={refreshTick} />
      )}

      {suiviTab === "livraisons" && (
      <div>
      {/* ── Status filter (livraisons only) ──────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {/* Status chips */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>
              Statut
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {ALL_STATUSES.map(s => {
                const cfg = STATUS_CFG[s];
                const active = activeStatuses.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "5px 13px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                      background: active ? cfg.bg : (isDark ? "#1e2130" : "#f3f4f6"),
                      color: active ? cfg.text : t.textMuted,
                      border: `1px solid ${active ? cfg.dot + "33" : t.border}`,
                      cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: active ? cfg.dot : t.textFaint,
                    }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI summary row ────────────────────────────────── */}
      {selectedDriverId && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14, marginBottom: 20,
        }}>
          {/* Total */}
          <KPICard
            icon={<Package2 size={18} color="#3b82f6" />}
            iconBg="rgba(59,130,246,0.1)"
            label="Total colis"
            value={String(displayTotal)}
            t={t}
          />
          {/* Livres */}
          <KPICard
            icon={<CheckCircle2 size={18} color="#10b981" />}
            iconBg="rgba(16,185,129,0.1)"
            label="Livrés"
            value={String(displayLivres)}
            t={t}
          />
          {/* Echecs */}
          <KPICard
            icon={<XCircle size={18} color="#ef4444" />}
            iconBg="rgba(239,68,68,0.1)"
            label="Échecs"
            value={String(displayEchecs)}
            t={t}
          />
          {/* Rate */}
          <KPICard
            icon={<Truck size={18} color="#f97316" />}
            iconBg="rgba(249,115,22,0.1)"
            label="Taux de livraison"
            value={`${displayRate}%`}
            t={t}
          />
        </div>
      )}

      {/* ── Content area ───────────────────────────────────── */}
      {!selectedSD ? (
        <EmptyState
          icon={<MapPin size={40} color={t.textFaint} />}
          title="Sélectionnez un Stop Desk"
          subtitle="Choisissez un stop desk pour afficher les chauffeurs."
          t={t}
        />
      ) : !selectedDriverId ? (
        <EmptyState
          icon={<Truck size={40} color={t.textFaint} />}
          title="Sélectionnez un chauffeur"
          subtitle="Choisissez un chauffeur dans la liste pour voir son historique de livraison."
          t={t}
        />
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={28} color={t.textMuted} style={{ animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<Package2 size={40} color={t.textFaint} />}
          title="Aucun colis trouvé"
          subtitle="Aucun colis ne correspond aux filtres sélectionnés."
          t={t}
        />
      ) : (
        <>
          {/* ── Packages table ───────────────────────────────── */}
          <div style={{
            ...cardStyle, padding: 0, overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse", fontSize: 13,
              }}>
                <thead>
                  <tr style={{
                    background: isDark ? "#161b28" : "#f9fafb",
                    position: "sticky", top: 0, zIndex: 2,
                  }}>
                    {["Tracking", "Destinataire", "Commune", "COD", "Frais", "Statut",
                      "Raison Échec", "Date Attribution", "Date Résultat"].map(col => (
                      <th
                        key={col}
                        style={{
                          padding: "10px 14px", textAlign: "left", fontWeight: 700,
                          fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                          color: t.textMuted, borderBottom: `1px solid ${t.border}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg, i) => {
                    const statusCfg = STATUS_CFG[pkg.status as SuiviStatus];
                    const resultDate = pkg.status === "livre"
                      ? pkg.delivered_at
                      : pkg.status === "echec_livraison"
                        ? pkg.failed_at
                        : null;
                    return (
                      <tr
                        key={pkg.id}
                        style={{
                          borderBottom: `1px solid ${t.divider}`,
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Tracking */}
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: t.text, fontFamily: "monospace", fontSize: 12 }}>
                          {pkg.tracking_number}
                        </td>

                        {/* Destinataire */}
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>
                            {pkg.recipient_name}
                          </div>
                          {pkg.recipient_phone && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 4,
                              fontSize: 11, color: t.textMuted, marginTop: 2,
                            }}>
                              <Phone size={10} />
                              {pkg.recipient_phone}
                            </div>
                          )}
                        </td>

                        {/* Commune */}
                        <td style={{ padding: "10px 14px", color: t.textSub, fontSize: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <MapPin size={11} color={t.textFaint} />
                            {pkg.recipient_commune?.name ?? "—"}
                          </div>
                        </td>

                        {/* COD */}
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: t.text, whiteSpace: "nowrap" }}>
                          {formatDA(pkg.cod_amount)}
                        </td>

                        {/* Frais */}
                        <td style={{ padding: "10px 14px", color: t.textSub, whiteSpace: "nowrap" }}>
                          {formatDA(pkg.shipping_cost)}
                        </td>

                        {/* Statut */}
                        <td style={{ padding: "10px 14px" }}>
                          {statusCfg ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                              background: statusCfg.bg, color: statusCfg.text, whiteSpace: "nowrap",
                            }}>
                              <span style={{
                                width: 7, height: 7, borderRadius: "50%",
                                background: statusCfg.dot, flexShrink: 0,
                              }} />
                              {statusCfg.label}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: t.textMuted }}>{pkg.status}</span>
                          )}
                        </td>

                        {/* Raison Echec */}
                        <td style={{ padding: "10px 14px", fontSize: 12 }}>
                          {pkg.status === "echec_livraison" && pkg.echec_reason ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              color: "#dc2626", fontSize: 12,
                            }}>
                              <AlertTriangle size={12} />
                              {ECHEC_REASON_LABELS[pkg.echec_reason as EchecReason] ?? pkg.echec_reason}
                            </span>
                          ) : (
                            <span style={{ color: t.textFaint }}>—</span>
                          )}
                        </td>

                        {/* Date Attribution */}
                        <td style={{ padding: "10px 14px", color: t.textSub, whiteSpace: "nowrap", fontSize: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={11} color={t.textFaint} />
                            {formatDate(pkg.driver_assigned_at)}
                          </div>
                        </td>

                        {/* Date Resultat */}
                        <td style={{ padding: "10px 14px", color: t.textSub, whiteSpace: "nowrap", fontSize: 12 }}>
                          {resultDate ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {pkg.status === "livre"
                                ? <CheckCircle2 size={11} color="#10b981" />
                                : <XCircle size={11} color="#ef4444" />
                              }
                              {formatDate(resultDate)}
                            </div>
                          ) : (
                            <span style={{ color: t.textFaint }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination ─────────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 16, padding: "0 4px",
          }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>
              {total} colis au total — Page {page} / {lastPage}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { if (page > 1) fetchPackages(page - 1); }}
                disabled={page <= 1}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: t.card, color: page <= 1 ? t.textFaint : t.textSub,
                  border: `1px solid ${t.border}`, cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.5 : 1, transition: "all 0.15s",
                }}
              >
                <ChevronLeft size={14} />
                Précédent
              </button>
              <button
                onClick={() => { if (page < lastPage) fetchPackages(page + 1); }}
                disabled={page >= lastPage}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: t.card, color: page >= lastPage ? t.textFaint : t.textSub,
                  border: `1px solid ${t.border}`, cursor: page >= lastPage ? "not-allowed" : "pointer",
                  opacity: page >= lastPage ? 0.5 : 1, transition: "all 0.15s",
                }}
              >
                Suivant
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
      </div>
      )}
    </div>
  );
}

/* ── Activity Log Table (shared for attribution + récupération) ── */
function ActivityLogTable({ t, isDark, selectedSD, driverId, action, dateFrom, dateTo, title, color, refreshTick }: {
  t: any; isDark: boolean; selectedSD: number; driverId: number | null;
  action: "attribution" | "recuperation"; dateFrom: string; dateTo: string;
  title: string; color: string; refreshTick: number;
}) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    // Only show full-screen loader on initial / filter change, not on background refresh
    if (lastSyncedAt === null) setLoading(true);
    const params = new URLSearchParams({ stop_desk_id: String(selectedSD), action });
    if (driverId) params.set("driver_id", String(driverId));
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    api<any>(`/drivers/activity-logs?${params}`).then(res => {
      const d = res.data?.data ?? [];
      setLogs(Array.isArray(d) ? d : []);
      setTotal(res.data?.total ?? 0);
      setLastSyncedAt(new Date());
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSD, driverId, action, dateFrom, dateTo, refreshTick]);

  const th: React.CSSProperties = {
    padding: "12px 16px", fontSize: 11, fontWeight: 700, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: `1px solid ${t.border}`, textAlign: "left", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "12px 16px", fontSize: 13, borderBottom: `1px solid ${t.divider}`, color: t.textSub,
    verticalAlign: "middle",
  };
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";
  const fmtSync = (d: Date | null) => d
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <div style={{
      background: t.card, borderRadius: 12, border: `1px solid ${t.border}`,
      boxShadow: t.shadow, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", gap: 10,
        background: isDark ? "#161b28" : "#f9fafb",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</span>
          <span style={{ fontSize: 11, color: t.textMuted }}>
            {total} entrée{total > 1 ? "s" : ""} · Synchronisé à {fmtSync(lastSyncedAt)}
          </span>
        </div>
        <div style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: "#10b981", fontWeight: 600,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: "#10b981",
            boxShadow: "0 0 0 0 rgba(16,185,129,0.7)",
            animation: "pulse 2s infinite",
          }} />
          Live
          <style>{`
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
              70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
              100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
            }
          `}</style>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: 60, textAlign: "center" }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite", color: t.textMuted }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : logs.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.textSub, marginBottom: 4 }}>Aucune entrée</div>
          <div style={{ fontSize: 12, color: t.textFaint }}>
            Aucune {action === "attribution" ? "attribution" : "récupération"} trouvée pour ces filtres.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Tracking</th>
                <th style={th}>Destinataire</th>
                <th style={th}>Chauffeur</th>
                <th style={th}>Détails</th>
                <th style={th}>Effectué par</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr
                  key={log.id}
                  style={{ transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: t.text }}>
                    {log.package?.tracking_number ?? "—"}
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>
                      {log.package?.recipient_name ?? "—"}
                    </div>
                    {log.package?.cod_amount != null && Number(log.package.cod_amount) > 0 && (
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                        COD: {Number(log.package.cod_amount).toLocaleString("fr-DZ")} DA
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    {log.driver ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                          background: `${color}22`, color, display: "flex",
                          alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {(log.driver.first_name?.[0] ?? "") + (log.driver.last_name?.[0] ?? "")}
                        </div>
                        <span style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>
                          {log.driver.first_name} {log.driver.last_name}
                        </span>
                      </div>
                    ) : "—"}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: t.textMuted, maxWidth: 240 }}>
                    {log.details ?? <span style={{ color: t.textFaint }}>—</span>}
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {log.performed_by_user
                      ? `${log.performed_by_user.first_name} ${log.performed_by_user.last_name ?? ""}`.trim()
                      : <span style={{ color: t.textFaint }}>—</span>}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: t.textMuted, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} color={t.textFaint} />
                      {fmtDate(log.created_at)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function KPICard({ icon, iconBg, label, value, t }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string; t: Tokens;
}) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
      boxShadow: t.shadow, padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle, t }: {
  icon: React.ReactNode; title: string; subtitle: string; t: Tokens;
}) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
      boxShadow: t.shadow, padding: "60px 32px", textAlign: "center",
    }}>
      <div style={{ marginBottom: 16, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: t.textMuted, maxWidth: 340, margin: "0 auto" }}>
        {subtitle}
      </div>
    </div>
  );
}
