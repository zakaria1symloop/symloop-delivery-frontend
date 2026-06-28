import { api, type ApiResponse } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DriverCommune {
  id: number;
  name: string;
  wilaya: string | null;
  price: number;
}

export interface DriverKPIs {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  stop_desk_id: number | null;
  vehicle_plate: string | null;
  vehicle_type: string | null;
  vehicle_marque: string | null;
  communes: DriverCommune[];
  total_assigned: number;
  total_delivered: number;
  total_failed: number;
  current_packages: number;
  delivery_rate: number;
  caisse_balance: number;
  caisse_id: number | null;
}

export type EchecReason =
  | "absent"
  | "adresse_incorrecte"
  | "refuse_colis"
  | "injoignable"
  | "zone_inaccessible"
  | "autre";

export const ECHEC_REASON_LABELS: Record<EchecReason, string> = {
  absent: "Absent",
  adresse_incorrecte: "Adresse incorrecte",
  refuse_colis: "Refus du colis",
  injoignable: "Injoignable",
  zone_inaccessible: "Zone inaccessible",
  autre: "Autre",
};

export const ECHEC_REASONS: EchecReason[] = Object.keys(ECHEC_REASON_LABELS) as EchecReason[];

export interface CollectResultItem {
  package_id: number;
  outcome: "livre" | "echec";
  echec_reason?: string;
}

export interface CollectSummary {
  delivered: number;
  failed: number;
  total_collected: number;
  driver_fee: number;
  net_for_caisse: number;
  errors: string[];
}

export interface SettleSummary {
  driver_balance_was: number;
  driver_fee: number;
  transferred_to_sd: number;
  new_driver_balance: number;
}

// ── API Functions ────────────────────────────────────────────────────────────

export const getLocalDrivers = (params?: {
  stop_desk_id?: number;
}): Promise<ApiResponse<DriverKPIs[]>> => {
  const q = new URLSearchParams();
  if (params?.stop_desk_id) q.set("stop_desk_id", String(params.stop_desk_id));
  const qs = q.toString();
  return api(`/drivers/local${qs ? `?${qs}` : ""}`);
};

export const getDriverPackages = (
  id: number,
  params?: { status?: string; date_from?: string; date_to?: string; page?: number; per_page?: number }
): Promise<ApiResponse<any>> => {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return api(`/drivers/${id}/packages${qs ? `?${qs}` : ""}`);
};

export const assignPackageToDriver = (
  driver_id: number,
  tracking_number: string
): Promise<ApiResponse<any>> =>
  api("/drivers/assign", {
    method: "POST",
    body: JSON.stringify({ driver_id, tracking_number }),
  });

export const collectDriverResults = (
  driver_id: number,
  results: CollectResultItem[]
): Promise<ApiResponse<CollectSummary>> =>
  api("/drivers/collect", {
    method: "POST",
    body: JSON.stringify({ driver_id, results }),
  });

export const settleDriver = (
  id: number,
  driver_fee: number
): Promise<ApiResponse<SettleSummary>> =>
  api(`/drivers/${id}/settle`, {
    method: "POST",
    body: JSON.stringify({ driver_fee }),
  });

// ── Ramassage (Pickup) ──────────────────────────────────────────────────────

export const getRamassage = (params?: {
  stop_desk_id?: number;
  assigned?: "yes" | "no";
}): Promise<ApiResponse<any[]>> => {
  const q = new URLSearchParams();
  if (params?.stop_desk_id) q.set("stop_desk_id", String(params.stop_desk_id));
  if (params?.assigned) q.set("assigned", params.assigned);
  const qs = q.toString();
  return api(`/drivers/ramassage${qs ? `?${qs}` : ""}`);
};

export const ramassageAssign = (
  package_id: number,
  driver_id: number
): Promise<ApiResponse<any>> =>
  api("/drivers/ramassage/assign", {
    method: "POST",
    body: JSON.stringify({ package_id, driver_id }),
  });

export const ramassageUnassign = (package_id: number): Promise<ApiResponse<any>> =>
  api("/drivers/ramassage/unassign", {
    method: "POST",
    body: JSON.stringify({ package_id }),
  });

export const ramassageCollected = (package_ids: number[]): Promise<ApiResponse<any>> =>
  api("/drivers/ramassage/collected", {
    method: "POST",
    body: JSON.stringify({ package_ids }),
  });

export const ramassageToggleFree = (package_ids: number[], pickup_free: boolean): Promise<ApiResponse<any>> =>
  api("/drivers/ramassage/toggle-free", {
    method: "POST",
    body: JSON.stringify({ package_ids, pickup_free }),
  });

export const ramassageAutoAssign = (stop_desk_id: number): Promise<ApiResponse<{ assigned: number; no_driver: number; total: number }>> =>
  api("/drivers/ramassage/auto-assign", {
    method: "POST",
    body: JSON.stringify({ stop_desk_id }),
  });
