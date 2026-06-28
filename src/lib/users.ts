import { api, type ApiResponse } from "./api";

export interface StaffUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  user_type: "admin" | "operator" | "responsable" | "expediteur" | "chauffeur" | "transit_chauffeur";
  status: "active" | "inactive" | "suspended";
  // Per-expéditeur programmatic API access (admin-only toggle). Defaults true.
  api_enabled?: boolean;
  wilaya_id: number | null;
  stop_desk_id: number | null;
  wilaya?: { id: number; name: string; code: string | null };
  stop_desk?: { id: number; name: string; code: string | null };
  // Expéditeur company
  company_name?: string | null;
  registre_commerce?: string | null;
  nif?: string | null;
  nis?: string | null;
  rc_file?: string | null;
  nif_file?: string | null;
  nis_file?: string | null;
  // Driver
  permis_numero?: string | null;
  permis_categorie?: string | null;
  permis_file?: string | null;
  cin_numero?: string | null;
  cin_file?: string | null;
  vehicle_plate?: string | null;
  vehicle_type?: string | null;
  vehicle_marque?: string | null;
  // Driver communes with delivery price (many-to-many, chauffeur + transit_chauffeur)
  communes?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string }; pivot?: { price: number | null } }[];
  // Custom role (roles & permissions system)
  role_id?: number | null;
  role?: { id: number; name: string } | null;
  created_at?: string;
  last_login_at?: string | null;
}

// ── Expéditeur dossier stats (GET /users/:id/expediteur-stats, admin) ──────────
export interface ExpediteurRecentPackage {
  tracking_number: string;
  status: string;
  recipient_name: string | null;
  recipient_wilaya: string | null;
  cod_amount: number;
  created_at: string | null;
}

export interface ExpediteurStats {
  total: number;
  by_status: Record<string, number>;
  delivered: number;
  in_progress: number;
  returned: number;
  failed: number;
  delivery_rate: number;
  return_rate: number;
  /** Sum of shipping_cost over delivered packages (merchant-billed shipping fees). */
  ca_genere: number;
  /** Sum of cod_amount over delivered packages (cash collected on delivery). */
  cod_collected: number;
  recent: ExpediteurRecentPackage[];
}

export const getExpediteurStats = (id: number): Promise<ApiResponse<ExpediteurStats>> =>
  api(`/users/${id}/expediteur-stats`);

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  phone1: string;
  phone2: string | null;
  wilaya_id: number | null;
  commune_id: number | null;
  stop_desk_id: number | null;
  created_by: number;
  created_at: string;
  wilaya?: { id: number; name: string };
  commune?: { id: number; name: string };
  stop_desk?: { id: number; name: string; code: string | null };
  created_by_user?: { id: number; first_name: string; last_name: string };
}

export interface PaginatedClients {
  data: Client[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

// ── Staff Users ───────────────────────────────────────────────────────────────

export const getUsers = (params?: { type?: string; search?: string }): Promise<ApiResponse<StaffUser[]>> => {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return api(`/users${qs ? `?${qs}` : ""}`);
};

/** Single user record (GET /users/:id → UserController@show), with wilaya / stop_desk / communes relations. */
export const getUser = (id: number): Promise<ApiResponse<StaffUser>> =>
  api(`/users/${id}`);

type UserPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  password?: string;
  user_type: string;
  status?: string;
  api_enabled?: boolean;
  wilaya_id?: number | null;
  stop_desk_id?: number | null;
  company_name?: string | null;
  registre_commerce?: string | null;
  nif?: string | null;
  nis?: string | null;
  permis_numero?: string | null;
  permis_categorie?: string | null;
  cin_numero?: string | null;
  vehicle_plate?: string | null;
  vehicle_type?: string | null;
  vehicle_marque?: string | null;
  communes?: { id: number; price?: number | null }[];
};

/** Use FormData when files are present, JSON otherwise */
function buildUserBody(data: UserPayload, files?: Record<string, File | null>): { body: BodyInit; headers?: Record<string, string> } {
  const hasFiles = files && Object.values(files).some(Boolean);
  if (hasFiles) {
    const fd = new FormData();
    const { communes, ...rest } = data;
    Object.entries(rest).forEach(([k, v]) => {
      if (v == null) return;
      fd.append(k, String(v));
    });
    // Laravel parses communes[0][id], communes[0][price], etc.
    (communes ?? []).forEach((item, i) => {
      fd.append(`communes[${i}][id]`, String(item.id));
      if (item.price != null) fd.append(`communes[${i}][price]`, String(item.price));
    });
    Object.entries(files!).forEach(([k, v]) => v && fd.append(k, v));
    return { body: fd };
  }
  return { body: JSON.stringify(data), headers: { "Content-Type": "application/json" } };
}

export const createUser = (data: UserPayload & { password: string }, files?: Record<string, File | null>): Promise<ApiResponse<StaffUser>> => {
  const { body, headers } = buildUserBody(data, files);
  return api("/users", { method: "POST", body, headers });
};

export const updateUser = (id: number, data: UserPayload, files?: Record<string, File | null>): Promise<ApiResponse<StaffUser>> => {
  const hasFiles = files && Object.values(files).some(Boolean);
  if (hasFiles) {
    // Laravel ignores multipart/form-data on PUT — use POST + _method spoofing
    const { body } = buildUserBody(data, files);
    (body as FormData).append("_method", "PUT");
    return api(`/users/${id}`, { method: "POST", body });
  }
  const { body, headers } = buildUserBody(data, undefined);
  return api(`/users/${id}`, { method: "PUT", body, headers });
};

export const toggleUserStatus = (id: number): Promise<ApiResponse<StaffUser>> =>
  api(`/users/${id}/status`, { method: "PATCH" });

export const deleteUser = (id: number): Promise<ApiResponse> =>
  api(`/users/${id}`, { method: "DELETE" });

// ── Clients ───────────────────────────────────────────────────────────────────

export const getClients = (params?: {
  search?: string;
  wilaya_id?: number;
  page?: number;
  per_page?: number;
}): Promise<ApiResponse<PaginatedClients>> => {
  const q = new URLSearchParams();
  if (params?.search)    q.set("search", params.search);
  if (params?.wilaya_id) q.set("wilaya_id", String(params.wilaya_id));
  if (params?.page)      q.set("page", String(params.page));
  if (params?.per_page)  q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return api(`/clients${qs ? `?${qs}` : ""}`);
};

export const getClientDetail = (id: number): Promise<ApiResponse<Client>> =>
  api(`/clients/${id}`);

export const createClient = (data: {
  first_name: string;
  last_name: string;
  phone1: string;
  phone2?: string | null;
  wilaya_id?: number | null;
  commune_id?: number | null;
  stop_desk_id?: number | null;
}): Promise<ApiResponse<Client>> =>
  api("/clients", { method: "POST", body: JSON.stringify(data) });

export const updateClient = (
  id: number,
  data: {
    first_name: string;
    last_name: string;
    phone1: string;
    phone2?: string | null;
    wilaya_id?: number | null;
    commune_id?: number | null;
    stop_desk_id?: number | null;
  }
): Promise<ApiResponse<Client>> =>
  api(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteClient = (id: number): Promise<ApiResponse> =>
  api(`/clients/${id}`, { method: "DELETE" });
