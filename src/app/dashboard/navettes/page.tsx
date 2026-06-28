"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Truck, Plus, X, Check, ArrowRight, Clock, Box, MapPin,
  UserPlus, Package, Play, Flag, Ban, Trash2, Navigation, AlertTriangle,
  Loader2, RefreshCw, Thermometer, Gauge, Activity, Timer, TrendingUp, ScanLine,
  Search, SlidersHorizontal, RotateCcw,
} from "lucide-react";
import { useIsDark, useTokens, PageHeader, Badge, ORANGE, type Tokens } from "../_ui";
import NavetteManifestPanel from "./NavetteManifestPanel";
import { api } from "@/lib/api";
import type { StopDesk } from "@/lib/geography";
import { getBags, type Bag, BAG_TYPE_LABELS, BAG_STATUS_LABELS, type BagStatus, type BagType } from "@/lib/bags";
import {
  getNavettes, getNavette, getNavetteSummary, createNavette, deleteNavette, assignNavette,
  attachNavetteBag, detachNavetteBag, departNavette, completeNavette, cancelNavette,
  navetteStatusColor, navetteStatusLabel, navetteFrequencyLabel, navetteRouteColor,
  isNavetteActive, retardDisplay, formatDeparture, formatDuration, formatTime,
  type Navette, type NavetteDetail, type NavetteDriver, type NavetteFrequency,
  type NavetteSdBrief, type NavetteSummary,
} from "@/lib/navettes";

type Notice = { tone: "success" | "warn" | "error"; text: string };

// Status board: the default ("actives") deliberately hides terminée & annulée.
type TabKey = "actives" | "en_route" | "terminee" | "annulee" | "all";
const TABS: { key: TabKey; label: string }[] = [
  { key: "actives", label: "Actives" },
  { key: "en_route", label: "En route" },
  { key: "terminee", label: "Terminées" },
  { key: "annulee", label: "Annulées" },
  { key: "all", label: "Toutes" },
];

function inTab(n: Navette, tab: TabKey): boolean {
  switch (tab) {
    case "actives": return isNavetteActive(n.status);
    case "en_route": return n.status === "en_route";
    case "terminee": return n.status === "terminee";
    case "annulee": return n.status === "annulee";
    case "all": return true;
  }
}

const driverName = (d: NavetteDriver | null): string =>
  d ? `${d.first_name} ${d.last_name}`.trim() : "Non assignée";

const sdLabel = (sd: NavetteSdBrief | null, id: number): string =>
  sd ? sd.name : `SD #${id}`;

// ── Hard filters (client-side, combine with the status-board tab) ──────────────
type Filters = {
  search: string;
  origin: string;   // origin_stop_desk_id as string ("" = any)
  dest: string;     // destination_stop_desk_id as string ("" = any)
  driver: string;   // driver_id as string ("" = any)
  dateFrom: string; // YYYY-MM-DD ("" = no lower bound)
  dateTo: string;   // YYYY-MM-DD ("" = no upper bound)
  lateOnly: boolean;
};

const EMPTY_FILTERS: Filters = {
  search: "", origin: "", dest: "", driver: "", dateFrom: "", dateTo: "", lateOnly: false,
};

/** Local-time YYYY-MM-DD key of an ISO datetime (comparable to <input type=date>). */
function localDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const countActiveFilters = (f: Filters): number =>
  (f.search.trim() ? 1 : 0) + (f.origin ? 1 : 0) + (f.dest ? 1 : 0) +
  (f.driver ? 1 : 0) + (f.dateFrom ? 1 : 0) + (f.dateTo ? 1 : 0) + (f.lateOnly ? 1 : 0);

/** The hard-filter predicate (status tab is applied separately, on top of this). */
function matchesFilters(n: Navette, f: Filters): boolean {
  const q = f.search.trim().toLowerCase();
  if (q) {
    const hay = [
      driverName(n.driver),
      n.vehicle ?? "",
      sdLabel(n.origin_stop_desk, n.origin_stop_desk_id),
      sdLabel(n.destination_stop_desk, n.destination_stop_desk_id),
    ].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.origin && n.origin_stop_desk_id !== Number(f.origin)) return false;
  if (f.dest && n.destination_stop_desk_id !== Number(f.dest)) return false;
  if (f.driver && n.driver_id !== Number(f.driver)) return false;
  if (f.dateFrom || f.dateTo) {
    const key = localDateKey(n.departure_time ?? n.metrics?.scheduled_departure ?? null);
    if (f.dateFrom && (key == null || key < f.dateFrom)) return false;
    if (f.dateTo && (key == null || key > f.dateTo)) return false;
  }
  // "Late only": keep rows whose retard exceeds the grace window (tone === "late").
  if (f.lateOnly && retardDisplay(n.metrics?.retard_minutes).tone !== "late") return false;
  return true;
}

const retardColor = (tone: "muted" | "ok" | "late", t: Tokens): string =>
  tone === "late" ? "#ef4444" : tone === "ok" ? "#22c55e" : t.textMuted;

/* Map renders only client-side (Google Maps JS touches window) — load lazily. */
const NavetteMap = dynamic(() => import("./NavetteMapGoogle"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={22} className="spin" style={{ color: ORANGE }} />
    </div>
  ),
});

export default function NavettesPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [navettes, setNavettes] = useState<Navette[]>([]);
  const [summary, setSummary] = useState<NavetteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [tab, setTab] = useState<TabKey>("actives");
  const [focusId, setFocusId] = useState<number | null>(null);

  // Hard filters (client-side, combine with the status-board tab + map).
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const patchFilters = useCallback((p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p })), []);
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const [stopDesks, setStopDesks] = useState<StopDesk[]>([]);
  const [drivers, setDrivers] = useState<NavetteDriver[]>([]);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    origin: "", dest: "", departure: "", frequency: "daily" as NavetteFrequency, vehicle: "", capacity: "250",
  });

  // Assign modal
  const [assignFor, setAssignFor] = useState<Navette | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);

  // Detail / bags modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<NavetteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [availableBags, setAvailableBags] = useState<Bag[]>([]);
  const [bagsLoading, setBagsLoading] = useState(false);
  const [bagBusy, setBagBusy] = useState<number | null>(null);

  // Per-row lifecycle busy
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  // SMART manifest panel (scan-to-load / scan-to-unload / Terminer summary)
  const [manifestForId, setManifestForId] = useState<number | null>(null);

  const flash = useCallback((tone: Notice["tone"], text: string) => setNotice({ tone, text }), []);

  // ── Loaders ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const res = await getNavettes();
    if (res.success && res.data) { setNavettes(res.data); setError(null); }
    else setError(res.message || "Erreur de chargement des navettes.");
    setLoading(false);
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    const res = await getNavetteSummary();
    if (res.success && res.data) setSummary(res.data);
    setSummaryLoading(false);
  }, []);

  const refresh = useCallback(() => { load(); loadSummary(); }, [load, loadSummary]);

  useEffect(() => { load(); loadSummary(); }, [load, loadSummary]);

  useEffect(() => {
    api<StopDesk[]>("/stop-desks").then((r) => { if (r.success && r.data) setStopDesks(r.data); });
    api<NavetteDriver[]>("/users?type=transit_chauffeur").then((r) => { if (r.success && r.data) setDrivers(r.data); });
  }, []);

  useEffect(() => {
    if (notice?.tone === "success") {
      const id = setTimeout(() => setNotice(null), 4000);
      return () => clearTimeout(id);
    }
  }, [notice]);

  const replaceInList = useCallback((updated: Navette) => {
    setNavettes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
  }, []);

  // ── Map focus: jump to the Actives tab, scroll + highlight the card ─────────
  const focusNavette = useCallback((id: number) => {
    setTab("actives");
    setFocusId(id);
    window.setTimeout(() => {
      document.getElementById(`nav-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 90);
    window.setTimeout(() => setFocusId((cur) => (cur === id ? null : cur)), 2400);
  }, []);

  // ── Create ───────────────────────────────────────────────────────────────
  function resetForm() {
    setForm({ origin: "", dest: "", departure: "", frequency: "daily", vehicle: "", capacity: "250" });
  }

  async function create() {
    if (!form.origin || !form.dest || form.origin === form.dest) return;
    setSaving(true);
    const res = await createNavette({
      origin_stop_desk_id: Number(form.origin),
      destination_stop_desk_id: Number(form.dest),
      departure_time: form.departure ? new Date(form.departure).toISOString() : null,
      frequency: form.frequency,
      vehicle: form.vehicle || null,
      capacity: Number(form.capacity) || 0,
    });
    setSaving(false);
    if (res.success && res.data) {
      const created = res.data;
      setNavettes((prev) => [created, ...prev]);
      setAddOpen(false);
      resetForm();
      loadSummary();
      // Smart auto-assignment: surface the freshly auto-filled manifest immediately.
      const auto = created.current_load;
      flash("success", auto > 0
        ? `Navette créée — ${auto} sac${auto > 1 ? "s" : ""} auto-affecté${auto > 1 ? "s" : ""}.`
        : "Navette créée — aucun sac éligible en attente à l'origine.");
      setManifestForId(created.id);
    } else flash("error", res.message || "Création impossible.");
  }

  // ── Assign ───────────────────────────────────────────────────────────────
  function openAssign(n: Navette) {
    setAssignFor(n);
    setAssignDriverId(n.driver_id ? String(n.driver_id) : "");
  }

  async function confirmAssign() {
    if (!assignFor || !assignDriverId) return;
    setAssignBusy(true);
    const res = await assignNavette(assignFor.id, Number(assignDriverId));
    setAssignBusy(false);
    if (res.success && res.data) {
      const d = res.data;
      replaceInList(d);
      setAssignFor(null);
      loadSummary();
      const warns = d.pre_data_warnings ?? [];
      if (warns.length) flash("warn", warns.join(" · "));
      else flash("success", "Chauffeur assigné — itinéraire & météo récupérés.");
      // Surface the freshly fetched pre-data (incl. route polyline) in detail.
      setDetail(d);
      setDetailOpen(true);
      loadAvailableBags(d);
    } else flash("error", res.message || "Assignation impossible.");
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  async function lifecycle(n: Navette, action: "depart" | "complete" | "cancel") {
    setRowBusy(n.id);
    const fn = action === "depart" ? departNavette : action === "complete" ? completeNavette : cancelNavette;
    const res = await fn(n.id);
    setRowBusy(null);
    if (res.success && res.data) {
      replaceInList(res.data);
      if (detail && detail.id === n.id) setDetail(res.data);
      loadSummary();
      flash("success", "Statut mis à jour.");
    } else flash("error", res.message || "Action impossible.");
  }

  // ── Detail / bags ────────────────────────────────────────────────────────
  const loadAvailableBags = useCallback(async (n: { origin_stop_desk_id: number }) => {
    setBagsLoading(true);
    const res = await getBags({ origin_stop_desk_id: n.origin_stop_desk_id, per_page: 200 });
    setBagsLoading(false);
    setAvailableBags(res.success && res.data ? res.data.data : []);
  }, []);

  async function openDetail(n: Navette) {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    const res = await getNavette(n.id);
    setDetailLoading(false);
    if (res.success && res.data) { setDetail(res.data); loadAvailableBags(res.data); }
    else { flash("error", res.message || "Détail introuvable."); setDetailOpen(false); }
  }

  async function attach(bagId: number) {
    if (!detail) return;
    setBagBusy(bagId);
    const res = await attachNavetteBag(detail.id, bagId);
    setBagBusy(null);
    if (res.success && res.data) { setDetail(res.data); replaceInList(res.data); loadSummary(); flash("success", "Sac ajouté à la navette."); }
    else flash("error", res.message || "Ajout du sac impossible.");
  }

  async function detach(bagId: number) {
    if (!detail) return;
    setBagBusy(bagId);
    const res = await detachNavetteBag(detail.id, bagId);
    setBagBusy(null);
    if (res.success && res.data) { setDetail(res.data); replaceInList(res.data); loadSummary(); flash("success", "Sac retiré."); }
    else flash("error", res.message || "Retrait du sac impossible.");
  }

  async function removeNavette() {
    if (!detail) return;
    if (!window.confirm("Supprimer cette navette ? Les sacs seront détachés.")) return;
    setRowBusy(detail.id);
    const res = await deleteNavette(detail.id);
    setRowBusy(null);
    if (res.success) {
      setNavettes((prev) => prev.filter((n) => n.id !== detail.id));
      setDetailOpen(false);
      setDetail(null);
      loadSummary();
      flash("success", "Navette supprimée.");
    } else flash("error", res.message || "Suppression impossible.");
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  // Live fleet KPI (always the true active count — KPIs ignore the hard filters).
  const activeNavettes = useMemo(() => navettes.filter((n) => isNavetteActive(n.status)), [navettes]);

  // Hard-filtered set (search / SD / driver / date range / late). Tab applied on top.
  const filtered = useMemo(() => navettes.filter((n) => matchesFilters(n, filters)), [navettes, filters]);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const hasActiveFilters = activeFilterCount > 0;

  // Map draws the filtered set, but only its ACTIVE statuses (rule preserved).
  const mapNavettes = useMemo(() => filtered.filter((n) => isNavetteActive(n.status)), [filtered]);
  // List = filtered set ∩ current status tab.
  const visible = useMemo(() => filtered.filter((n) => inTab(n, tab)), [filtered, tab]);

  // Tab badges reflect the filtered set so tab + filters stay coherent.
  const counts = useMemo(() => ({
    actives: filtered.filter((n) => isNavetteActive(n.status)).length,
    en_route: filtered.filter((n) => n.status === "en_route").length,
    terminee: filtered.filter((n) => n.status === "terminee").length,
    annulee: filtered.filter((n) => n.status === "annulee").length,
    all: filtered.length,
  }), [filtered]);

  const onTimePct = summary?.on_time_rate != null ? `${Math.round(summary.on_time_rate * 100)} %` : "—";
  const avgRetard = summary?.avg_retard_minutes != null ? `${summary.avg_retard_minutes} min` : "—";
  const kpi = (loading: boolean, v: string | number) => (loading ? "…" : String(v));

  const manifestIds = useMemo(() => new Set((detail?.bags ?? []).map((b) => b.id)), [detail]);
  const attachable = useMemo(
    () => availableBags.filter((b) => !manifestIds.has(b.id) && b.status !== "annule"),
    [availableBags, manifestIds],
  );

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="Navettes & Trajets"
        subtitle="Centre de commandement line-haul — carte, KPIs, statut & manifeste"
        icon={Truck}
        t={t}
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={refresh} style={ghostBtn(t)}><RefreshCw size={15} /> Actualiser</button>
            <button onClick={() => setAddOpen(true)} style={primaryBtn}><Plus size={15} /> Ajouter une navette</button>
          </div>
        }
      />

      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}

      {/* ── Trajets map (active fleet only) ── */}
      {/* position/z-index 0 caps Google Maps' internal high z-indexes inside this
          stacking context so the map can never paint over the modal overlays. */}
      <div style={{ position: "relative", zIndex: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: t.text }}>
            <Navigation size={16} color={ORANGE} /> Trajets actifs
            <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>
              · {mapNavettes.length} en cours
              {hasActiveFilters && <span style={{ color: ORANGE, fontWeight: 600 }}> · filtré</span>}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <LegendDot color={navetteRouteColor("planifiee")} label="Planifiée" t={t} />
            <LegendDot color={navetteRouteColor("assignee")} label="Assignée" t={t} />
            <LegendDot color={navetteRouteColor("en_route")} label="En route" t={t} />
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 0, height: 420 }}>
          {loading ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted, gap: 10, fontSize: 13 }}>
              <Loader2 size={20} className="spin" /> Chargement de la carte…
            </div>
          ) : (
            <NavetteMap navettes={mapNavettes} isDark={isDark} onFocus={focusNavette} />
          )}
          {!loading && mapNavettes.length === 0 && (
            <div style={{ position: "absolute", inset: 0, zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, pointerEvents: "none", background: isDark ? "rgba(14,16,23,0.55)" : "rgba(240,242,245,0.6)" }}>
              <Truck size={26} color={t.textFaint} />
              <span style={{ fontSize: 13, color: t.textSub, fontWeight: 500 }}>
                {hasActiveFilters ? "Aucune navette active ne correspond aux filtres." : "Aucune navette active à afficher."}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI strip (live: active fleet) ── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <Kpi label="Actives" value={kpi(loading, activeNavettes.length)} icon={Activity} accent={ORANGE} t={t} />
        <Kpi label="En route" value={kpi(summaryLoading, summary?.en_route ?? 0)} icon={Truck} accent="#3b82f6" t={t} />
        <Kpi label="Taux à l'heure" value={summaryLoading ? "…" : onTimePct} icon={TrendingUp} accent="#22c55e" t={t} />
        <Kpi label="Retard moyen" value={summaryLoading ? "…" : avgRetard} icon={Timer} accent="#f59e0b" t={t} />
        <Kpi label="Sacs en transit" value={kpi(summaryLoading, summary?.bags_in_transit ?? 0)} icon={Box} accent="#8b5cf6" t={t} />
      </div>

      {/* ── Status board tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map((tb) => {
          const on = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: on ? ORANGE : t.card,
                color: on ? "#fff" : t.textSub,
                border: `1px solid ${on ? ORANGE : t.border}`,
                transition: "all 0.15s",
              }}
            >
              {tb.label}
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                background: on ? "rgba(255,255,255,0.22)" : t.sectionBg,
                color: on ? "#fff" : t.textMuted,
              }}>{counts[tb.key]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Hard filters (apply to list + map, combine with the active tab) ── */}
      {!loading && !error && navettes.length > 0 && (
        <FilterBar
          t={t}
          filters={filters}
          onChange={patchFilters}
          onReset={resetFilters}
          stopDesks={stopDesks}
          drivers={drivers}
          activeCount={activeFilterCount}
          resultCount={visible.length}
        />
      )}

      {/* ── List (filtered by tab + hard filters) ── */}
      {loading ? (
        <Centered t={t}><Loader2 size={20} className="spin" /> Chargement des navettes…</Centered>
      ) : error ? (
        <Centered t={t}>
          <AlertTriangle size={20} color="#ef4444" />
          <span>{error}</span>
          <button onClick={refresh} style={ghostBtn(t)}>Réessayer</button>
        </Centered>
      ) : navettes.length === 0 ? (
        <Centered t={t}>
          <Truck size={26} color={t.textFaint} />
          <span>Aucune navette pour le moment.</span>
          <button onClick={() => setAddOpen(true)} style={primaryBtn}><Plus size={15} /> Créer une navette</button>
        </Centered>
      ) : visible.length === 0 ? (
        <Centered t={t}>
          <Truck size={24} color={t.textFaint} />
          <span>{hasActiveFilters ? "Aucune navette ne correspond aux filtres." : "Aucune navette dans cet onglet."}</span>
          {hasActiveFilters && (
            <button onClick={resetFilters} style={ghostBtn(t)}><RotateCcw size={14} /> Réinitialiser les filtres</button>
          )}
        </Centered>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {visible.map((n) => (
            <NavetteCard
              key={n.id}
              n={n}
              t={t}
              busy={rowBusy === n.id}
              focused={focusId === n.id}
              onAssign={() => openAssign(n)}
              onBags={() => openDetail(n)}
              onDetail={() => openDetail(n)}
              onManifest={() => setManifestForId(n.id)}
              onLifecycle={(a) => lifecycle(n, a)}
            />
          ))}
        </div>
      )}

      {/* ── Add modal ── */}
      {addOpen && (
        <Overlay onClose={() => setAddOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={modalCard(t, 520)}>
            <ModalHead t={t} title="Nouvelle navette (Stop-desk → Stop-desk)" onClose={() => setAddOpen(false)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Stop-desk de départ" t={t}>
                <select style={inp(t)} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
                  <option value="">Choisir…</option>
                  {stopDesks.map((sd) => <option key={sd.id} value={sd.id}>{sd.name}{sd.code ? ` (${sd.code})` : ""}</option>)}
                </select>
              </Field>
              <Field label="Stop-desk d'arrivée" t={t}>
                <select style={inp(t)} value={form.dest} onChange={(e) => setForm({ ...form, dest: e.target.value })}>
                  <option value="">Choisir…</option>
                  {stopDesks.map((sd) => <option key={sd.id} value={sd.id}>{sd.name}{sd.code ? ` (${sd.code})` : ""}</option>)}
                </select>
              </Field>
              <Field label="Départ (date & heure)" t={t}>
                <input type="datetime-local" style={inp(t)} value={form.departure} onChange={(e) => setForm({ ...form, departure: e.target.value })} />
              </Field>
              <Field label="Fréquence" t={t}>
                <select style={inp(t)} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as NavetteFrequency })}>
                  <option value="once">Ponctuelle</option>
                  <option value="daily">Quotidienne</option>
                  <option value="weekly">Hebdomadaire</option>
                </select>
              </Field>
              <Field label="Véhicule" t={t}><input style={inp(t)} value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="Camion 12T · plaque" /></Field>
              <Field label="Capacité (sacs, 0 = illimité)" t={t}><input type="number" min={0} style={inp(t)} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
            </div>
            {form.origin && form.dest && form.origin === form.dest && (
              <p style={{ fontSize: 12, color: "#ef4444", marginTop: 10 }}>Les stop-desks de départ et d&apos;arrivée doivent être différents.</p>
            )}
            <p style={{ fontSize: 11.5, color: t.textMuted, marginTop: 10 }}>La navette est créée vide. Assignez un chauffeur (itinéraire + météo) puis attachez des sacs.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => setAddOpen(false)} style={ghostBtn(t)}>Annuler</button>
              <button onClick={create} disabled={saving || !form.origin || !form.dest || form.origin === form.dest} style={{ ...primaryBtn, opacity: saving || !form.origin || !form.dest || form.origin === form.dest ? 0.6 : 1 }}>
                {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Créer la navette
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Assign modal ── */}
      {assignFor && (
        <Overlay onClose={() => setAssignFor(null)}>
          <div onClick={(e) => e.stopPropagation()} style={modalCard(t, 440)}>
            <ModalHead t={t} title="Assigner un chauffeur de transit" onClose={() => setAssignFor(null)} />
            <div style={{ fontSize: 13, color: t.textSub, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <MapPin size={14} color={ORANGE} />{sdLabel(assignFor.origin_stop_desk, assignFor.origin_stop_desk_id)}
              <ArrowRight size={14} color={t.textFaint} />
              {sdLabel(assignFor.destination_stop_desk, assignFor.destination_stop_desk_id)}
            </div>
            <Field label="Chauffeur de transit" t={t}>
              <select style={inp(t)} value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)}>
                <option value="">Choisir un chauffeur…</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{driverName(d)}{d.phone ? ` · ${d.phone}` : ""}</option>)}
              </select>
            </Field>
            {drivers.length === 0 && <p style={{ fontSize: 12, color: t.textMuted, marginTop: 8 }}>Aucun chauffeur de transit disponible.</p>}
            <p style={{ fontSize: 11.5, color: t.textMuted, marginTop: 10 }}>À l&apos;assignation, l&apos;itinéraire (Google) et la météo (à destination) sont récupérés et stockés pour le chauffeur.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => setAssignFor(null)} style={ghostBtn(t)}>Annuler</button>
              <button onClick={confirmAssign} disabled={assignBusy || !assignDriverId} style={{ ...primaryBtn, opacity: assignBusy || !assignDriverId ? 0.6 : 1 }}>
                {assignBusy ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />} Assigner
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Detail / bags modal ── */}
      {detailOpen && (
        <Overlay onClose={() => setDetailOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalCard(t, 640), maxHeight: "88vh", overflowY: "auto" }}>
            {detailLoading || !detail ? (
              <Centered t={t}><Loader2 size={20} className="spin" /> Chargement…</Centered>
            ) : (
              <DetailContent
                detail={detail}
                t={t}
                attachable={attachable}
                bagsLoading={bagsLoading}
                bagBusy={bagBusy}
                rowBusy={rowBusy === detail.id}
                onClose={() => setDetailOpen(false)}
                onAttach={attach}
                onDetach={detach}
                onAssign={() => { const cur = navettes.find((x) => x.id === detail.id) ?? detail; openAssign(cur); }}
                onManifest={() => { setDetailOpen(false); setManifestForId(detail.id); }}
                onLifecycle={(a) => lifecycle(detail, a)}
                onDelete={removeNavette}
              />
            )}
          </div>
        </Overlay>
      )}

      {/* ── SMART manifest / scan-to-load panel ── */}
      {manifestForId != null && (
        <NavetteManifestPanel
          navetteId={manifestForId}
          t={t}
          onClose={() => setManifestForId(null)}
          onChanged={refresh}
        />
      )}

      <style>{`.spin{animation:nav-spin 1s linear infinite}@keyframes nav-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ───────────────────────── Filter toolbar ───────────────────────── */
function FilterBar({
  t, filters, onChange, onReset, stopDesks, drivers, activeCount, resultCount,
}: {
  t: Tokens;
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  stopDesks: StopDesk[];
  drivers: NavetteDriver[];
  activeCount: number;
  resultCount: number;
}) {
  const hasFilters = activeCount > 0;
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, padding: 16, marginBottom: 18 }}>
      {/* Header: title + active count + result count + reset */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: t.text }}>
          <SlidersHorizontal size={16} color={ORANGE} /> Filtres
          {hasFilters && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: ORANGE + "1f", color: ORANGE }}>
              {activeCount} actif{activeCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textMuted }}>
            {resultCount} résultat{resultCount > 1 ? "s" : ""}
          </span>
          <button
            onClick={onReset}
            disabled={!hasFilters}
            style={{ ...ghostBtn(t), padding: "7px 13px", opacity: hasFilters ? 1 : 0.5, cursor: hasFilters ? "pointer" : "default" }}
          >
            <RotateCcw size={14} /> Réinitialiser
          </button>
        </div>
      </div>

      {/* Search (full width) */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
        <input
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Rechercher — chauffeur, véhicule, stop-desk d'origine/destination…"
          style={{ ...inp(t), padding: "9px 32px 9px 34px" }}
        />
        {filters.search && (
          <button
            onClick={() => onChange({ search: "" })}
            aria-label="Effacer la recherche"
            style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 2 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Selects + date range + late toggle */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, alignItems: "end" }}>
        <Field label="Stop-desk d'origine" t={t}>
          <select style={inp(t)} value={filters.origin} onChange={(e) => onChange({ origin: e.target.value })}>
            <option value="">Toutes les origines</option>
            {stopDesks.map((sd) => <option key={sd.id} value={sd.id}>{sd.name}{sd.code ? ` (${sd.code})` : ""}</option>)}
          </select>
        </Field>
        <Field label="Stop-desk de destination" t={t}>
          <select style={inp(t)} value={filters.dest} onChange={(e) => onChange({ dest: e.target.value })}>
            <option value="">Toutes les destinations</option>
            {stopDesks.map((sd) => <option key={sd.id} value={sd.id}>{sd.name}{sd.code ? ` (${sd.code})` : ""}</option>)}
          </select>
        </Field>
        <Field label="Chauffeur" t={t}>
          <select style={inp(t)} value={filters.driver} onChange={(e) => onChange({ driver: e.target.value })}>
            <option value="">Tous les chauffeurs</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{driverName(d)}</option>)}
          </select>
        </Field>
        <Field label="Départ — du" t={t}>
          <input type="date" style={inp(t)} value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(e) => onChange({ dateFrom: e.target.value })} />
        </Field>
        <Field label="Départ — au" t={t}>
          <input type="date" style={inp(t)} value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => onChange({ dateTo: e.target.value })} />
        </Field>
        <Field label="Ponctualité" t={t}>
          <button
            type="button"
            onClick={() => onChange({ lateOnly: !filters.lateOnly })}
            style={{
              width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 11px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: filters.lateOnly ? "#ef4444" : t.inp.bg,
              color: filters.lateOnly ? "#fff" : t.textSub,
              border: `1px solid ${filters.lateOnly ? "#ef4444" : t.inp.border}`,
              transition: "all 0.15s",
            }}
          >
            <AlertTriangle size={14} /> En retard{filters.lateOnly ? <Check size={14} /> : null}
          </button>
        </Field>
      </div>
    </div>
  );
}

/* ───────────────────────── Navette card ───────────────────────── */
function NavetteCard({
  n, t, busy, focused, onAssign, onBags, onDetail, onManifest, onLifecycle,
}: {
  n: Navette; t: Tokens; busy: boolean; focused: boolean;
  onAssign: () => void; onBags: () => void; onDetail: () => void; onManifest: () => void;
  onLifecycle: (a: "depart" | "complete" | "cancel") => void;
}) {
  const cap = n.capacity || 0;
  const fill = cap > 0 ? Math.round((n.current_load / cap) * 100) : 0;
  const fillColor = fill >= 85 ? "#ef4444" : fill >= 50 ? "#f59e0b" : "#22c55e";
  const sColor = navetteStatusColor(n.status);
  const pd = n.pre_data;
  const hasPre = pd && (pd.has_route || pd.has_weather);
  const m = n.metrics;
  const r = retardDisplay(m?.retard_minutes);
  const scan = m && m.bags_loaded > 0
    ? `${m.bags_loaded} sac${m.bags_loaded > 1 ? "s" : ""}${m.last_loaded_at ? ` · ${formatTime(m.last_loaded_at)}` : ""}`
    : "—";

  return (
    <div
      id={`nav-card-${n.id}`}
      style={{
        background: t.card, border: `1px solid ${focused ? ORANGE : t.border}`, borderRadius: 14, padding: 18,
        boxShadow: focused ? `0 0 0 3px ${ORANGE}33` : t.shadow,
        display: "flex", flexDirection: "column", transition: "box-shadow 0.2s, border-color 0.2s", scrollMarginTop: 90,
      }}
    >
      {/* Route + status */}
      <div onClick={onDetail} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14.5, fontWeight: 700, color: t.text }}><MapPin size={14} color={ORANGE} />{sdLabel(n.origin_stop_desk, n.origin_stop_desk_id)}</span>
          <ArrowRight size={15} color={t.textFaint} />
          <span style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>{sdLabel(n.destination_stop_desk, n.destination_stop_desk_id)}</span>
        </div>
        <Badge color={sColor} bg={sColor + "18"}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sColor }} />{navetteStatusLabel(n.status)}
        </Badge>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, color: t.textSub, marginBottom: 12 }}>
        <Row label="Départ"><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={13} color={t.textFaint} />{formatDeparture(n.departure_time)} · {navetteFrequencyLabel(n.frequency)}</span></Row>
        <Row label="Chauffeur"><span style={{ color: n.driver ? t.textSub : t.textMuted }}>{driverName(n.driver)}</span></Row>
        <Row label="Retard"><span style={{ fontWeight: 700, color: retardColor(r.tone, t) }}>{r.text}</span></Row>
        <Row label="Scan"><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><ScanLine size={13} color={t.textFaint} />{scan}</span></Row>
      </div>

      {/* Pre-data (route + weather) */}
      {hasPre && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {pd.route_distance_km != null && <Chip t={t} icon={Navigation} color="#3b82f6">{pd.route_distance_km} km</Chip>}
          {pd.route_duration_min != null && (
            <Chip t={t} icon={Clock} color="#8b5cf6">
              {formatDuration(pd.route_duration_min)}
              {pd.route_duration_traffic_min != null && <span style={{ color: "#ef4444" }}> · trafic {formatDuration(pd.route_duration_traffic_min)}</span>}
            </Chip>
          )}
          {pd.weather && (
            <Chip t={t} icon={Thermometer} color="#f59e0b">
              {pd.weather.temp != null ? `${Math.round(pd.weather.temp)}°C` : "—"}{pd.weather.description ? ` · ${pd.weather.description}` : ""}
            </Chip>
          )}
        </div>
      )}

      {/* Fill bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: t.textMuted, marginBottom: 5 }}>
          <span>Remplissage</span>
          <span style={{ fontWeight: 700, color: fillColor }}>{cap > 0 ? `${n.current_load}/${cap} sacs (${fill}%)` : `${n.current_load} sacs (illimité)`}</span>
        </div>
        <div style={{ height: 7, borderRadius: 4, background: t.divider, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${cap > 0 ? Math.min(fill, 100) : 0}%`, background: fillColor, borderRadius: 4 }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
        {(n.status === "planifiee" || n.status === "assignee") && (
          <button onClick={onAssign} disabled={busy} style={miniBtn(t, "#8b5cf6")}><UserPlus size={13} /> Assigner</button>
        )}
        <button onClick={onManifest} disabled={busy} style={miniBtn(t, ORANGE)}><ScanLine size={13} /> Manifeste / Charger</button>
        <button onClick={onBags} disabled={busy} style={miniBtn(t, t.textMuted)}><Package size={13} /> Sacs</button>
        {n.status === "assignee" && <button onClick={() => onLifecycle("depart")} disabled={busy} style={miniBtn(t, "#3b82f6")}><Play size={13} /> Démarrer</button>}
        {n.status === "en_route" && <button onClick={() => onLifecycle("complete")} disabled={busy} style={miniBtn(t, "#22c55e")}><Flag size={13} /> Terminer</button>}
        {n.status !== "terminee" && n.status !== "annulee" && <button onClick={() => onLifecycle("cancel")} disabled={busy} style={miniBtn(t, "#ef4444")}><Ban size={13} /> Annuler</button>}
        <button onClick={onDetail} disabled={busy} style={{ ...miniBtn(t, t.textMuted), marginLeft: "auto" }}>Détails</button>
      </div>
    </div>
  );
}

/* ───────────────────────── Detail content ───────────────────────── */
function DetailContent({
  detail, t, attachable, bagsLoading, bagBusy, rowBusy,
  onClose, onAttach, onDetach, onAssign, onManifest, onLifecycle, onDelete,
}: {
  detail: NavetteDetail; t: Tokens; attachable: Bag[]; bagsLoading: boolean; bagBusy: number | null; rowBusy: boolean;
  onClose: () => void; onAttach: (id: number) => void; onDetach: (id: number) => void;
  onAssign: () => void; onManifest: () => void; onLifecycle: (a: "depart" | "complete" | "cancel") => void; onDelete: () => void;
}) {
  const sColor = navetteStatusColor(detail.status);
  const pd = detail.pre_data;
  const w = pd.weather;
  const cap = detail.capacity || 0;
  const m = detail.metrics;
  const r = retardDisplay(m?.retard_minutes);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 16, fontWeight: 750, color: t.text }}><MapPin size={15} color={ORANGE} />{sdLabel(detail.origin_stop_desk, detail.origin_stop_desk_id)}</span>
          <ArrowRight size={16} color={t.textFaint} />
          <span style={{ fontSize: 16, fontWeight: 750, color: t.text }}>{sdLabel(detail.destination_stop_desk, detail.destination_stop_desk_id)}</span>
        </div>
        <button onClick={onClose} style={{ border: "none", background: "none", color: t.textFaint, cursor: "pointer" }}><X size={18} /></button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Badge color={sColor} bg={sColor + "18"}><span style={{ width: 6, height: 6, borderRadius: "50%", background: sColor }} />{navetteStatusLabel(detail.status)}</Badge>
        <span style={{ fontSize: 12.5, color: t.textSub }}><Clock size={12} /> {formatDeparture(detail.departure_time)} · {navetteFrequencyLabel(detail.frequency)}</span>
      </div>

      {/* Meta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5, color: t.textSub, marginBottom: 16 }}>
        <Row label="Chauffeur"><span style={{ color: detail.driver ? t.textSub : t.textMuted }}>{driverName(detail.driver)}</span></Row>
        <Row label="Véhicule"><span style={{ fontFamily: "monospace", fontSize: 12 }}>{detail.vehicle || "—"}</span></Row>
        <Row label="Charge">{cap > 0 ? `${detail.current_load}/${cap} sacs` : `${detail.current_load} sacs`}</Row>
        <Row label="Créée par">{detail.creator ? `${detail.creator.first_name} ${detail.creator.last_name}` : "—"}</Row>
      </div>

      {/* pre-data warnings */}
      {detail.pre_data_warnings && detail.pre_data_warnings.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "#f59e0b18", border: "1px solid #f59e0b44", marginBottom: 14 }}>
          <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "#b45309" }}>
            {detail.pre_data_warnings.map((w2, i) => <div key={i}>{w2}</div>)}
          </div>
        </div>
      )}

      {/* Suivi / metrics */}
      <SectionTitle t={t} icon={Activity}>Suivi & métriques</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <PreCard t={t} label="Retard au départ" value={r.text} valueColor={retardColor(r.tone, t)} sub={m?.departed_at ? `Parti à ${formatTime(m.departed_at)}` : "Pas encore parti"} icon={Timer} color="#f59e0b" />
        <PreCard t={t} label="Durée de transit" value={formatDuration(m?.transit_minutes ?? null) ?? "—"} sub={m?.est_duration_min != null ? `Estimée : ${formatDuration(m.est_duration_min)}` : undefined} icon={Clock} color="#3b82f6" />
        <PreCard t={t} label="Premier scan" value={formatTime(m?.first_loaded_at)} sub={m ? `${m.bags_loaded} sac${m.bags_loaded > 1 ? "s" : ""} chargé${m.bags_loaded > 1 ? "s" : ""}` : undefined} icon={ScanLine} color="#8b5cf6" />
        <PreCard t={t} label="Dernier scan" value={formatTime(m?.last_loaded_at)} sub={m?.arrived_at ? `Arrivée ${formatTime(m.arrived_at)}` : undefined} icon={ScanLine} color="#22c55e" />
      </div>

      {/* Pre-data panel (what the driver sees) */}
      <SectionTitle t={t} icon={Navigation}>Itinéraire & météo</SectionTitle>
      {pd.has_route || pd.has_weather ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <PreCard t={t} label="Distance" value={pd.route_distance_km != null ? `${pd.route_distance_km} km` : "—"} icon={Navigation} color="#3b82f6" />
          <PreCard t={t} label="Durée" value={formatDuration(pd.route_duration_min) ?? "—"} sub={pd.route_duration_traffic_min != null ? `Avec trafic : ${formatDuration(pd.route_duration_traffic_min)}` : undefined} icon={Clock} color="#8b5cf6" />
          <PreCard t={t} label={w?.city ? `Météo · ${w.city}` : "Météo (destination)"} value={w?.temp != null ? `${Math.round(w.temp)}°C` : "—"} sub={w?.description ?? undefined} icon={Thermometer} color="#f59e0b" />
          <PreCard t={t} label="Ressenti / humidité" value={w?.feels_like != null ? `${Math.round(w.feels_like)}°C` : "—"} sub={w?.humidity != null ? `Humidité ${w.humidity}%` : undefined} icon={Gauge} color="#22c55e" />
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: t.textMuted, marginBottom: 18 }}>Aucune pré-donnée. Assignez un chauffeur pour récupérer l&apos;itinéraire et la météo.</p>
      )}

      {/* Manifest */}
      <SectionTitle t={t} icon={Package}>Manifeste — {detail.bags.length} sac{detail.bags.length > 1 ? "s" : ""}</SectionTitle>
      {detail.bags.length === 0 ? (
        <p style={{ fontSize: 12.5, color: t.textMuted, marginBottom: 16 }}>Aucun sac attaché.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {detail.bags.map((b) => (
            <div key={b.id} style={bagRow(t)}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 600, color: t.text }}>{b.tracking_number}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{BAG_TYPE_LABELS[b.type as BagType] ?? b.type} · {BAG_STATUS_LABELS[b.status as BagStatus] ?? b.status} · {b.packages_count} colis</div>
              </div>
              <button onClick={() => onDetach(b.id)} disabled={bagBusy === b.id} style={miniBtn(t, "#ef4444")}>
                {bagBusy === b.id ? <Loader2 size={13} className="spin" /> : <X size={13} />} Retirer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Attach available bags */}
      <SectionTitle t={t} icon={Plus}>Ajouter des sacs (origine : {sdLabel(detail.origin_stop_desk, detail.origin_stop_desk_id)})</SectionTitle>
      {bagsLoading ? (
        <p style={{ fontSize: 12.5, color: t.textMuted }}><Loader2 size={13} className="spin" /> Chargement des sacs disponibles…</p>
      ) : attachable.length === 0 ? (
        <p style={{ fontSize: 12.5, color: t.textMuted, marginBottom: 4 }}>Aucun sac disponible à ce stop-desk.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {attachable.map((b) => (
            <div key={b.id} style={bagRow(t)}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 600, color: t.text }}>{b.tracking_number}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{BAG_TYPE_LABELS[b.type] ?? b.type} · {b.status_label} · {b.packages_count} colis{b.destination_wilaya ? ` · → ${b.destination_wilaya.name}` : ""}</div>
              </div>
              <button onClick={() => onAttach(b.id)} disabled={bagBusy === b.id} style={miniBtn(t, "#22c55e")}>
                {bagBusy === b.id ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} Ajouter
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
        <button onClick={onManifest} style={miniBtn(t, ORANGE)}><ScanLine size={13} /> Manifeste / Charger</button>
        {(detail.status === "planifiee" || detail.status === "assignee") && <button onClick={onAssign} style={miniBtn(t, "#8b5cf6")}><UserPlus size={13} /> Assigner</button>}
        {detail.status === "assignee" && <button onClick={() => onLifecycle("depart")} disabled={rowBusy} style={miniBtn(t, "#3b82f6")}><Play size={13} /> Démarrer</button>}
        {detail.status === "en_route" && <button onClick={() => onLifecycle("complete")} disabled={rowBusy} style={miniBtn(t, "#22c55e")}><Flag size={13} /> Terminer</button>}
        {detail.status !== "terminee" && detail.status !== "annulee" && <button onClick={() => onLifecycle("cancel")} disabled={rowBusy} style={miniBtn(t, "#ef4444")}><Ban size={13} /> Annuler</button>}
        <button onClick={onDelete} disabled={rowBusy} style={{ ...miniBtn(t, "#ef4444"), marginLeft: "auto" }}><Trash2 size={13} /> Supprimer</button>
      </div>
    </>
  );
}

/* ───────────────────────── Small bits ───────────────────────── */
function LegendDot({ color, label, t }: { color: string; label: string; t: Tokens }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: t.textSub }}>
      <span style={{ width: 14, height: 4, borderRadius: 3, background: color, display: "inline-block" }} />{label}
    </span>
  );
}

function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const c = notice.tone === "success" ? "#22c55e" : notice.tone === "warn" ? "#f59e0b" : "#ef4444";
  const Icon = notice.tone === "success" ? Check : AlertTriangle;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 11, background: c + "16", border: `1px solid ${c}44`, marginBottom: 18 }}>
      <Icon size={16} color={c} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: c, fontWeight: 500, flex: 1 }}>{notice.text}</span>
      <button onClick={onClose} style={{ border: "none", background: "none", color: c, cursor: "pointer", opacity: 0.7 }}><X size={15} /></button>
    </div>
  );
}

function Chip({ children, icon: Icon, color, t }: { children: React.ReactNode; icon: React.ElementType; color: string; t: Tokens }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, background: t.sectionBg, border: `1px solid ${t.border}`, color: t.textSub }}>
      <Icon size={12} color={color} />{children}
    </span>
  );
}

function PreCard({ label, value, valueColor, sub, icon: Icon, color, t }: { label: string; value: string; valueColor?: string; sub?: string; icon: React.ElementType; color: string; t: Tokens }) {
  return (
    <div style={{ background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textMuted, marginBottom: 5 }}><Icon size={13} color={color} />{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: valueColor ?? t.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, icon: Icon, t }: { children: React.ReactNode; icon: React.ElementType; t: Tokens }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>
      <Icon size={15} color={ORANGE} />{children}
    </div>
  );
}

function Centered({ children, t }: { children: React.ReactNode; t: Tokens }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "50px 20px", color: t.textSub, fontSize: 13.5 }}>
      {children}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {children}
    </div>
  );
}

function ModalHead({ title, onClose, t }: { title: string; onClose: () => void; t: Tokens }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>{title}</h3>
      <button onClick={onClose} style={{ border: "none", background: "none", color: t.textFaint, cursor: "pointer" }}><X size={18} /></button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ textAlign: "right", fontWeight: 500 }}>{children}</span>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent, t }: { label: string; value: string; icon: React.ElementType; accent: string; t: Tokens }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 150, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", boxShadow: t.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={17} color={accent} /></div>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{value}</div>
    </div>
  );
}

function Field({ label, children, t, full }: { label: string; children: React.ReactNode; t: Tokens; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

/* ───────────────────────── styles ───────────────────────── */
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: ORANGE, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostBtn = (t: Tokens): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: t.card, color: t.textSub, border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer" });
const miniBtn = (t: Tokens, color: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, background: color + "16", color, border: `1px solid ${color}33`, fontSize: 12, fontWeight: 600, cursor: "pointer" });
const inp = (t: Tokens): React.CSSProperties => ({ width: "100%", padding: "9px 11px", borderRadius: 8, fontSize: 13, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none", fontFamily: "inherit" });
const modalCard = (t: Tokens, maxWidth: number): React.CSSProperties => ({ width: "100%", maxWidth, background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22 });
const bagRow = (t: Tokens): React.CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 9, background: t.sectionBg, border: `1px solid ${t.border}` });
