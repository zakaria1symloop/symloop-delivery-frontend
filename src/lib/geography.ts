import { api, type ApiResponse } from "./api";

export interface Wilaya {
  id: number;
  name: string;
  code: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  communes_count?: number;
}

export interface Commune {
  id: number;
  name: string;
  wilaya_id: number;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
  delivery_stop_desk_id: number | null;
  delivery_stop_desk?: { id: number; name: string } | null;
  wilaya?: { id: number; name: string; code: string | null };
}

export interface StopDesk {
  id: number;
  commune_id: number;
  parent_sd_id: number | null;
  type: "agence" | "depot" | "hub";
  code: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  colis_capacity: number | null;
  users_count?: number;
  // Hierarchy relations
  parent?: StopDesk | null;
  children?: StopDesk[];
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

export interface SDHierarchy {
  hubs: StopDesk[];
  unassigned: StopDesk[];
}

// Wilayas
export const getWilayas = (params?: { origin_sd_id?: number; full?: boolean }): Promise<ApiResponse<Wilaya[]>> => {
  const qp: string[] = [];
  if (params?.origin_sd_id) qp.push(`origin_sd_id=${params.origin_sd_id}`);
  if (params?.full)         qp.push(`full=1`);
  const q = qp.length ? `?${qp.join("&")}` : "";
  return api(`/wilayas${q}`);
};

export const createWilaya = (data: { name: string; code?: string; lat?: number | null; lng?: number | null }): Promise<ApiResponse<Wilaya>> =>
  api("/wilayas", { method: "POST", body: JSON.stringify(data) });

export const updateWilaya = (id: number, data: { name: string; code?: string; lat?: number | null; lng?: number | null; is_active: boolean }): Promise<ApiResponse<Wilaya>> =>
  api(`/wilayas/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteWilaya = (id: number): Promise<ApiResponse> =>
  api(`/wilayas/${id}`, { method: "DELETE" });

// SD Hierarchy
export interface SDHierarchyInfo {
  id: number;
  name: string;
  type: string;
  role: "hub" | "sub_sd" | "commune_sd" | "autonome";
  parent: { id: number; name: string; type: string } | null;
  hub: { id: number; name: string } | null;
  upward_chain: { id: number; name: string; type: string; role: string }[];
  children: { id: number; name: string; type: string; commune?: string; wilaya?: string }[];
}

export const getSDHierarchy = (sdId: number): Promise<ApiResponse<SDHierarchyInfo>> =>
  api(`/stop-desks/${sdId}/hierarchy`);

// Communes
export const getAllCommunes = (): Promise<ApiResponse<Commune[]>> =>
  api("/communes?all=1");

export const getCommunes = (wilayaId: number): Promise<ApiResponse<Commune[]>> =>
  api(`/wilayas/${wilayaId}/communes`);

export const createCommune = (data: { name: string; wilaya_id: number; lat?: number | null; lng?: number | null }): Promise<ApiResponse<Commune>> =>
  api("/communes", { method: "POST", body: JSON.stringify(data) });

export const updateCommune = (id: number, data: { name: string; is_active: boolean; lat?: number | null; lng?: number | null; delivery_stop_desk_id?: number | null }): Promise<ApiResponse<Commune>> =>
  api(`/communes/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteCommune = (id: number): Promise<ApiResponse> =>
  api(`/communes/${id}`, { method: "DELETE" });

// Stop Desks
export const getStopDesks = (communeId: number): Promise<ApiResponse<StopDesk[]>> =>
  api(`/communes/${communeId}/stop-desks`);

// All stop desks in ONE call (avoids a per-commune request storm).
export const getAllStopDesks = (): Promise<ApiResponse<StopDesk[]>> =>
  api("/stop-desks");

export const createStopDesk = (data: {
  commune_id: number; parent_sd_id?: number | null;
  type: "agence" | "depot" | "hub"; code?: string | null;
  name: string; address?: string | null; phone?: string | null;
  lat?: number | null; lng?: number | null; colis_capacity?: number | null;
}): Promise<ApiResponse<StopDesk>> =>
  api("/stop-desks", { method: "POST", body: JSON.stringify(data) });

export const updateStopDesk = (id: number, data: {
  parent_sd_id?: number | null;
  type: "agence" | "depot" | "hub"; code?: string | null;
  name: string; address?: string | null; phone?: string | null;
  lat?: number | null; lng?: number | null; is_active: boolean;
  colis_capacity?: number | null;
}): Promise<ApiResponse<StopDesk>> =>
  api(`/stop-desks/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteStopDesk = (id: number): Promise<ApiResponse> =>
  api(`/stop-desks/${id}`, { method: "DELETE" });
