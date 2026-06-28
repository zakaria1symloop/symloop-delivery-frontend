import { api, type ApiResponse } from "./api";

// ── Types ───────────────────────────────────────────────────────────────────────
export type BagType = "aller" | "retour";
export type BagStatus = "cree" | "scelle" | "en_transit" | "recu" | "deballe" | "annule";
export type BagTransferType = "trip" | "local";

export interface Bag {
  id: number;
  tracking_number: string;
  type: BagType;
  transfer_type: BagTransferType;
  status: BagStatus;
  status_label: string;

  origin_stop_desk_id: number;
  origin_stop_desk?: { id: number; name: string; code: string | null };
  destination_wilaya_id: number;
  destination_wilaya?: { id: number; name: string };
  destination_stop_desk_id: number | null;
  destination_stop_desk?: { id: number; name: string; code: string | null; commune?: { id: number; name: string } };
  transit_driver_id: number | null;
  transit_driver?: { id: number; first_name: string; last_name: string; phone: string | null };

  packages_count: number;
  packages?: import("./packages").Package[];

  sealed_at: string | null;
  transit_at: string | null;
  received_at: string | null;
  unpacked_at: string | null;

  created_by: number;
  creator?: { id: number; first_name: string; last_name: string };
  created_at: string;
  updated_at: string;

  scan_logs?: BagScanLog[];
  route_steps?: BagRouteStep[];
}

export interface BagRouteStep {
  id: number;
  bag_id: number;
  step_order: number;
  stop_desk_id: number;
  stop_desk?: { id: number; name: string };
  step_type: "origin" | "local_up" | "transit" | "local_down" | "destination";
  step_type_label: string;
  status: "pending" | "arrived" | "forwarded" | "done";
  status_label: string;
  arrived_at: string | null;
  forwarded_at: string | null;
}

export interface BagScanLog {
  id: number;
  bag_id: number;
  package_id: number | null;
  action: string;
  action_label: string;
  scanned_by: number;
  scanned_by_user?: { id: number; first_name: string; last_name: string };
  stop_desk_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface PaginatedBags {
  data: Bag[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

// ── API ─────────────────────────────────────────────────────────────────────────
export const getBags = (params?: {
  status?: string;
  type?: string;
  destination_wilaya_id?: number;
  origin_stop_desk_id?: number;
  passing_through_sd_id?: number;
  destination_sd_id?: number;
  dest_child_of_sd_id?: number;
  routed_through_sd_id?: number;
  route_step_status?: string;
  include_children?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<ApiResponse<PaginatedBags>> => {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.type) q.set("type", params.type);
  if (params?.destination_wilaya_id) q.set("destination_wilaya_id", String(params.destination_wilaya_id));
  if (params?.origin_stop_desk_id) q.set("origin_stop_desk_id", String(params.origin_stop_desk_id));
  if (params?.passing_through_sd_id) q.set("passing_through_sd_id", String(params.passing_through_sd_id));
  if (params?.destination_sd_id) q.set("destination_sd_id", String(params.destination_sd_id));
  if (params?.dest_child_of_sd_id) q.set("dest_child_of_sd_id", String(params.dest_child_of_sd_id));
  if (params?.routed_through_sd_id) q.set("routed_through_sd_id", String(params.routed_through_sd_id));
  if (params?.route_step_status) q.set("route_step_status", params.route_step_status);
  if (params?.include_children) q.set("include_children", "1");
  if (params?.search) q.set("search", params.search);
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return api(`/bags${qs ? `?${qs}` : ""}`);
};

export const getBag = (id: number): Promise<ApiResponse<Bag>> =>
  api(`/bags/${id}`);

export const createBag = (data: {
  type: BagType;
  transfer_type?: BagTransferType;
  origin_stop_desk_id: number;
  destination_wilaya_id: number;
  destination_stop_desk_id?: number | null;
}): Promise<ApiResponse<Bag>> =>
  api("/bags", { method: "POST", body: JSON.stringify(data) });

export const updateBag = (id: number, data: {
  type?: BagType;
  destination_wilaya_id?: number;
  destination_stop_desk_id?: number | null;
}): Promise<ApiResponse<Bag>> =>
  api(`/bags/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteBag = (id: number): Promise<ApiResponse<void>> =>
  api(`/bags/${id}`, { method: "DELETE" });

export const addPackageToBag = (bagId: number, tracking_number: string): Promise<ApiResponse<import("./packages").Package>> =>
  api(`/bags/${bagId}/packages`, {
    method: "POST",
    body: JSON.stringify({ tracking_number }),
  });

export const removePackageFromBag = (bagId: number, packageId: number): Promise<ApiResponse<void>> =>
  api(`/bags/${bagId}/packages/${packageId}`, { method: "DELETE" });

export const sealBag = (bagId: number): Promise<ApiResponse<Bag>> =>
  api(`/bags/${bagId}/seal`, { method: "PATCH" });

export const startBagTransit = (bagId: number, transit_driver_id: number): Promise<ApiResponse<Bag>> =>
  api(`/bags/${bagId}/transit`, {
    method: "PATCH",
    body: JSON.stringify({ transit_driver_id }),
  });

export const receiveBag = (bagId: number): Promise<ApiResponse<Bag>> =>
  api(`/bags/${bagId}/receive`, { method: "PATCH" });

export const unpackBag = (bagId: number): Promise<ApiResponse<Bag>> =>
  api(`/bags/${bagId}/unpack`, { method: "PATCH" });

export const cancelBag = (bagId: number): Promise<ApiResponse<Bag>> =>
  api(`/bags/${bagId}/cancel`, { method: "PATCH" });

// Local transfer (SD-to-SD within hierarchy)
export const declareLocalTransit = (bagId: number): Promise<ApiResponse<Bag>> =>
  api(`/bags/${bagId}/local-transit`, { method: "PATCH" });

export const scanLocalReceive = (tracking_number: string): Promise<ApiResponse<Bag>> =>
  api("/bags/scan-local-receive", {
    method: "POST",
    body: JSON.stringify({ tracking_number }),
  });

// ── Display helpers ─────────────────────────────────────────────────────────────
export const BAG_STATUS_LABELS: Record<BagStatus, string> = {
  cree:       "Créé",
  scelle:     "Scellé",
  en_transit: "En transit",
  recu:       "Reçu",
  deballe:    "Déballé",
  annule:     "Annulé",
};

export const BAG_STATUS_COLORS: Record<BagStatus, { bg: string; text: string; dot: string }> = {
  cree:       { bg: "rgba(245,158,11,0.1)",  text: "#d97706", dot: "#f59e0b" },
  scelle:     { bg: "rgba(99,102,241,0.1)",   text: "#4f46e5", dot: "#6366f1" },
  en_transit: { bg: "rgba(249,115,22,0.1)",   text: "#ea580c", dot: "#f97316" },
  recu:       { bg: "rgba(59,130,246,0.1)",   text: "#2563eb", dot: "#3b82f6" },
  deballe:    { bg: "rgba(16,185,129,0.1)",   text: "#059669", dot: "#10b981" },
  annule:     { bg: "rgba(107,114,128,0.1)",  text: "#4b5563", dot: "#6b7280" },
};

export const BAG_TYPE_LABELS: Record<BagType, string> = {
  aller:  "Aller",
  retour: "Retour",
};

export const BAG_TYPE_COLORS: Record<BagType, { bg: string; text: string }> = {
  aller:  { bg: "rgba(59,130,246,0.1)",  text: "#2563eb" },
  retour: { bg: "rgba(168,85,247,0.1)",  text: "#7c3aed" },
};
