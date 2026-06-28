import { api, API_BASE_URL, type ApiResponse } from "./api";
import type { Package } from "./packages";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WalletSummary {
  balance: number;
  en_transit: number;
  libere: number;
  dettes: number;
  total_delivered?: number;
  retour_count?: number;
  total_cod_credited: number;
  total_shipping: number;
  total_return_cost: number;
  total_withdrawals: number;
}

export interface DashboardData {
  wallet: WalletSummary;
  recent_packages: Package[];
  status_counts: Record<string, number>;
  deliveries_by_day: { date: string; total: number; delivered: number; failed: number }[];
  top_wilayas: { wilaya_name: string; count: number }[];
}

export interface ExpStats {
  totals: {
    total_colis: number;
    livres: number;
    echecs: number;
    taux_livraison: number;
    ca_total: number;
    frais_total: number;
  };
  by_wilaya: { wilaya_id: number; wilaya_name: string; total: number; delivered: number; failed: number; rate: number }[];
  by_commune: { commune_id: number; commune_name: string; wilaya_name: string; total: number; delivered: number; failed: number; rate: number }[];
  by_status: Record<string, number>;
  by_day: { date: string; total: number; delivered: number; failed: number }[];
  money: { total_cod: number; total_shipping: number; total_return_cost: number };
}

export interface BulkCreateResult {
  created_count: number;
  error_count: number;
  created: Package[];
  errors: { row: number; messages: string[] }[];
}

export interface WalletData {
  balance: number;
  en_transit: number;
  libere: number;
  dettes: number;
  total_cod_credited: number;
  total_shipping: number;
  total_return_cost: number;
  total_withdrawals: number;
}

export interface WalletTransaction {
  id: number;
  type: string;
  direction: string;
  amount: number;
  balance_after: number;
  description: string | null;
  package?: { id: number; tracking_number: string } | null;
  created_at: string;
}

// ── API Functions ────────────────────────────────────────────────────────────

export const getExpDashboard = (): Promise<ApiResponse<DashboardData>> =>
  api("/expediteur/dashboard");

export const getExpPackages = (params?: {
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  destination_wilaya_id?: number;
  page?: number;
  per_page?: number;
}): Promise<ApiResponse<any>> => {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.destination_wilaya_id) q.set("destination_wilaya_id", String(params.destination_wilaya_id));
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return api(`/expediteur/packages${qs ? `?${qs}` : ""}`);
};

export const createExpPackage = (data: Record<string, any>): Promise<ApiResponse<Package>> =>
  api("/expediteur/packages", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateExpPackage = (id: number, data: Record<string, any>): Promise<ApiResponse<Package>> =>
  api(`/packages/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const bulkCreatePackages = (packages: Record<string, any>[]): Promise<ApiResponse<BulkCreateResult>> =>
  api("/expediteur/packages/bulk", {
    method: "POST",
    body: JSON.stringify({ packages }),
  });

export const getExpStats = (params?: {
  date_from?: string;
  date_to?: string;
}): Promise<ApiResponse<ExpStats>> => {
  const q = new URLSearchParams();
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString();
  return api(`/expediteur/stats${qs ? `?${qs}` : ""}`);
};

export interface ExpClient {
  recipient_phone: string;
  recipient_name: string;
  wilaya_name: string | null;
  commune_name: string | null;
  orders_count: number;
  delivered_count: number;
  returned_count: number;
  total_cod: number;
  success_rate: number;
  last_order_at: string | null;
}

export const getExpClients = (
  search?: string,
): Promise<ApiResponse<{ clients: ExpClient[]; summary: { total_clients: number; total_orders: number; total_cod: number } }>> => {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return api(`/expediteur/clients${q}`);
};

export const getExpWallet = (): Promise<ApiResponse<WalletData>> =>
  api("/expediteur/wallet");

export const getExpWalletTransactions = (params?: {
  type?: string;
  page?: number;
  per_page?: number;
}): Promise<ApiResponse<any>> => {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return api(`/expediteur/wallet/transactions${qs ? `?${qs}` : ""}`);
};

export const downloadTemplate = (): void => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const base = API_BASE_URL;
  window.open(`${base}/expediteur/template?token=${token}`, "_blank");
};
