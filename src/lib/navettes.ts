import { api, type ApiResponse } from "./api";

// ── Vocabularies (must match backend dto/navette.dto.ts) ──────────────────────
export type NavetteStatus = "planifiee" | "assignee" | "en_route" | "terminee" | "annulee";
export type NavetteFrequency = "once" | "daily" | "weekly";

// ── Briefs ────────────────────────────────────────────────────────────────────
export interface NavetteSdBrief {
  id: number;
  name: string;
  code: string | null;
  lat: number | null;
  lng: number | null;
}

export interface NavetteDriver {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
}

// ── Pre-data (route + weather), computed on assign ────────────────────────────
export interface NavetteWeather {
  temp: number | null;
  feels_like: number | null;
  humidity: number | null;
  description: string | null;
  main: string | null;
  icon: string | null;
  wind_speed: number | null;
  wind_deg: number | null;
  city: string | null;
  fetched_at: string;
}

export interface NavettePreData {
  route_distance_km: number | null;
  route_duration_min: number | null;
  route_duration_traffic_min: number | null;
  /** Google-encoded overview polyline of the assigned route (decode client-side). */
  route_polyline: string | null;
  has_route: boolean;
  weather: NavetteWeather | null;
  has_weather: boolean;
}

// ── Per-navette ERP metrics (schedule vs actuals, retard, transit, scan span) ──
export interface NavetteMetrics {
  scheduled_departure: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  /** departed_at − scheduled_departure, minutes; null until departed. >0 = late. */
  retard_minutes: number | null;
  /** arrived_at − departed_at, minutes; null until arrived. */
  transit_minutes: number | null;
  est_duration_min: number | null;
  bags_loaded: number;
  first_loaded_at: string | null;
  last_loaded_at: string | null;
}

// ── Navette (list row) ────────────────────────────────────────────────────────
export interface Navette {
  id: number;
  origin_stop_desk_id: number;
  destination_stop_desk_id: number;
  origin_stop_desk: NavetteSdBrief | null;
  destination_stop_desk: NavetteSdBrief | null;
  driver_id: number | null;
  driver: NavetteDriver | null;
  departure_time: string | null;
  frequency: NavetteFrequency | string | null;
  vehicle: string | null;
  capacity: number;
  current_load: number;
  status: NavetteStatus;
  pre_data: NavettePreData;
  metrics: NavetteMetrics;
  assigned_at: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  created_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

// ── Fleet aggregates (GET /navettes/metrics/summary) ──────────────────────────
export interface NavetteSummary {
  total: number;
  en_route: number;
  planifiee: number;
  terminee: number;
  on_time_count: number;
  late_count: number;
  /** Fraction 0..1 (multiply by 100 for %); null when no departures measured. */
  on_time_rate: number | null;
  avg_retard_minutes: number | null;
  bags_in_transit: number;
}

// ── Bag manifest entry (detail only) ──────────────────────────────────────────
export interface NavetteBag {
  id: number;
  tracking_number: string;
  type: string;
  status: string;
  packages_count: number;
  origin_stop_desk_id: number;
  destination_stop_desk_id: number | null;
  destination_wilaya_id: number;
}

// ── Navette detail (manifest + creator; assign also adds pre_data_warnings) ────
export interface NavetteDetail extends Navette {
  creator: { id: number; first_name: string; last_name: string } | null;
  bags: NavetteBag[];
  pre_data_warnings?: string[];
}

// ── Inputs ────────────────────────────────────────────────────────────────────
export interface CreateNavetteInput {
  origin_stop_desk_id: number;
  destination_stop_desk_id: number;
  departure_time?: string | null;
  frequency?: NavetteFrequency;
  vehicle?: string | null;
  capacity?: number;
}

export type UpdateNavetteInput = Partial<CreateNavetteInput> & { status?: NavetteStatus };

// ── API wrappers (base already includes /api/v1) ──────────────────────────────
export const getNavettes = (params?: {
  status?: NavetteStatus;
  origin_stop_desk_id?: number;
  destination_stop_desk_id?: number;
}): Promise<ApiResponse<Navette[]>> => {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.origin_stop_desk_id) q.set("origin_stop_desk_id", String(params.origin_stop_desk_id));
  if (params?.destination_stop_desk_id)
    q.set("destination_stop_desk_id", String(params.destination_stop_desk_id));
  const qs = q.toString();
  return api(`/navettes${qs ? `?${qs}` : ""}`);
};

export const getNavette = (id: number): Promise<ApiResponse<NavetteDetail>> =>
  api(`/navettes/${id}`);

/** Fleet command-center aggregates (admin/ops). */
export const getNavetteSummary = (): Promise<ApiResponse<NavetteSummary>> =>
  api("/navettes/metrics/summary");

export const createNavette = (data: CreateNavetteInput): Promise<ApiResponse<NavetteDetail>> =>
  api("/navettes", { method: "POST", body: JSON.stringify(data) });

export const updateNavette = (
  id: number,
  data: UpdateNavetteInput,
): Promise<ApiResponse<NavetteDetail>> =>
  api(`/navettes/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteNavette = (id: number): Promise<ApiResponse<{ message: string }>> =>
  api(`/navettes/${id}`, { method: "DELETE" });

/** Assign a transit_chauffeur; response carries the freshly fetched route+weather
 *  pre_data plus `pre_data_warnings` (e.g. missing Google Maps key). */
export const assignNavette = (
  id: number,
  driver_id: number,
): Promise<ApiResponse<NavetteDetail>> =>
  api(`/navettes/${id}/assign`, { method: "POST", body: JSON.stringify({ driver_id }) });

export const attachNavetteBag = (
  id: number,
  bag_id: number,
): Promise<ApiResponse<NavetteDetail>> =>
  api(`/navettes/${id}/bags`, { method: "POST", body: JSON.stringify({ bag_id }) });

export const detachNavetteBag = (
  id: number,
  bagId: number,
): Promise<ApiResponse<NavetteDetail>> =>
  api(`/navettes/${id}/bags/${bagId}`, { method: "DELETE" });

export const departNavette = (id: number): Promise<ApiResponse<NavetteDetail>> =>
  api(`/navettes/${id}/depart`, { method: "PATCH" });

export const completeNavette = (id: number): Promise<ApiResponse<NavetteCompleteResult>> =>
  api(`/navettes/${id}/complete`, { method: "PATCH" });

export const cancelNavette = (id: number): Promise<ApiResponse<NavetteDetail>> =>
  api(`/navettes/${id}/cancel`, { method: "PATCH" });

// ════════════════════════════════════════════════════════════════════════════
// SMART line-haul: manifest + scan-to-load / scan-to-unload / complete
// (mirrors backend navettes.service.ts manifest()/scanLoad()/scanUnload()/complete())
// ════════════════════════════════════════════════════════════════════════════

/** A SD or wilaya brief carrying map coords (lat/lng may be null when ungeocoded). */
export interface ManifestGeoBrief {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
}

/** One bag on a navette manifest (to_scan / confirmed / to_unload share this shape). */
export interface ManifestBag {
  id: number;
  tracking_number: string;
  packages_count: number;
  status: string;
  direction: "pick" | "drop";
  loaded: boolean;
  navette_loaded_at: string | null;
  origin_stop_desk: { id: number; name: string } | null;
  next_hop_stop_desk: { id: number; name: string | null } | null;
  final_destination: {
    stop_desk: ManifestGeoBrief | null;
    wilaya: ManifestGeoBrief | null;
    /** Resolved marker coords (SD if geocoded, else wilaya centroid). */
    lat: number | null;
    lng: number | null;
  };
}

export interface NavetteManifestRoute {
  distance_km: number | null;
  duration_min: number | null;
  duration_traffic_min: number | null;
  /** Google-encoded overview polyline of the assigned route. */
  polyline: string | null;
}

/** GET /navettes/:id/manifest payload — the smart loading/unloading command sheet. */
export interface NavetteManifest {
  navette: {
    id: number;
    status: NavetteStatus;
    capacity: number;
    current_load: number;
    origin_stop_desk: ManifestGeoBrief | null;
    destination_stop_desk: ManifestGeoBrief | null;
    route: NavetteManifestRoute;
  };
  to_load: { to_scan: ManifestBag[]; confirmed: ManifestBag[] };
  to_unload: ManifestBag[];
  counts: { to_scan: number; confirmed: number; to_unload: number; total_assigned: number };
}

/** POST /navettes/:id/scan-load success payload. */
export interface ScanLoadResult {
  bag: { id: number; tracking_number: string };
  progress: { confirmed: number; total_assigned: number; remaining: number };
}

/** POST /navettes/:id/scan-unload success payload. */
export interface ScanUnloadResult {
  bag: { id: number; tracking_number: string };
  is_final: boolean;
  progress: { remaining_on_board: number };
}

/** PATCH /navettes/:id/complete returns the detail PLUS this finalize summary. */
export interface NavetteCompleteSummary {
  unloaded: string[];
  still_missing: string[];
  total: number;
}
export type NavetteCompleteResult = NavetteDetail & { summary: NavetteCompleteSummary };

/** The smart loading/unloading sheet for one navette (groups + route + counts). */
export const getNavetteManifest = (id: number): Promise<ApiResponse<NavetteManifest>> =>
  api(`/navettes/${id}/manifest`);

/** Confirm a physical load by scanning a bag tracking. 422 carries a clear
 *  message (wrong direction / not assigned here / capacity / closed) in `message`. */
export const scanLoadBag = (
  id: number,
  bagTracking: string,
): Promise<ApiResponse<ScanLoadResult>> =>
  api(`/navettes/${id}/scan-load`, {
    method: "POST",
    body: JSON.stringify({ bag_tracking: bagTracking }),
  });

/** Confirm a physical unload (at destination) by scanning a bag tracking. */
export const scanUnloadBag = (
  id: number,
  bagTracking: string,
): Promise<ApiResponse<ScanUnloadResult>> =>
  api(`/navettes/${id}/scan-unload`, {
    method: "POST",
    body: JSON.stringify({ bag_tracking: bagTracking }),
  });

// ── Display helpers ─────────────────────────────────────────────────────────────
export const NAVETTE_STATUS_LABELS: Record<NavetteStatus, string> = {
  planifiee: "Planifiée",
  assignee: "Assignée",
  en_route: "En route",
  terminee: "Terminée",
  annulee: "Annulée",
};

export const NAVETTE_STATUS_COLORS: Record<NavetteStatus, string> = {
  planifiee: "#f59e0b",
  assignee: "#8b5cf6",
  en_route: "#3b82f6",
  terminee: "#22c55e",
  annulee: "#6b7280",
};

export const NAVETTE_FREQUENCY_LABELS: Record<NavetteFrequency, string> = {
  once: "Ponctuelle",
  daily: "Quotidienne",
  weekly: "Hebdomadaire",
};

export const navetteStatusLabel = (s: string): string =>
  NAVETTE_STATUS_LABELS[s as NavetteStatus] ?? s;

export const navetteStatusColor = (s: string): string =>
  NAVETTE_STATUS_COLORS[s as NavetteStatus] ?? "#6b7280";

export const navetteFrequencyLabel = (f: string | null | undefined): string =>
  f ? NAVETTE_FREQUENCY_LABELS[f as NavetteFrequency] ?? f : "—";

// ── Active fleet (drawn on the map / counted in the live KPIs) ────────────────
export const NAVETTE_ACTIVE_STATUSES: NavetteStatus[] = ["planifiee", "assignee", "en_route"];

export const isNavetteActive = (s: string): boolean =>
  NAVETTE_ACTIVE_STATUSES.includes(s as NavetteStatus);

/** Map polyline colours — only the three active states are ever drawn. */
export const NAVETTE_ROUTE_COLORS: Record<string, string> = {
  planifiee: "#9ca3af", // grey — not yet assigned
  assignee: "#f59e0b",  // amber — driver assigned, awaiting departure
  en_route: "#3b82f6",  // blue — in transit
};

export const navetteRouteColor = (s: string): string =>
  NAVETTE_ROUTE_COLORS[s] ?? "#9ca3af";

const RETARD_GRACE_MIN = 5; // mirrors backend on-time threshold

export interface RetardDisplay {
  /** Short label, e.g. "—", "à l'heure", "+12 min". */
  text: string;
  /** Semantic colour: muted (not departed), green (on time), red (late). */
  tone: "muted" | "ok" | "late";
}

/** Turn metrics.retard_minutes into a coloured label for cards/detail. */
export function retardDisplay(retardMinutes: number | null | undefined): RetardDisplay {
  if (retardMinutes == null) return { text: "—", tone: "muted" };
  if (retardMinutes <= RETARD_GRACE_MIN) {
    return { text: retardMinutes > 0 ? `+${retardMinutes} min` : "à l'heure", tone: "ok" };
  }
  return { text: `+${retardMinutes} min`, tone: "late" };
}

/** "14:32" short time from an ISO datetime (fr-DZ), or "—". */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" });
}

/** "06:00" (or date + time) from an ISO datetime, locale fr-DZ. */
export function formatDeparture(iso: string | null): string {
  if (!iso) return "Non planifié";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Non planifié";
  return d.toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2 h 35" from minutes. */
export function formatDuration(min: number | null): string | null {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} h ${m.toString().padStart(2, "0")}` : `${h} h`;
}
