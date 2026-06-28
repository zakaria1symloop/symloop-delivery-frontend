import { api, type ApiResponse } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

export type TransactionType = "cod_collected" | "shipping_received" | "cod_remitted" | "expense" | "transfer_out" | "transfer_in" | "exp_payment" | "driver_commission" | "margin_profit";
export type Direction = "in" | "out";

export interface Caisse {
  id: number;
  name: string;
  stop_desk_id: number | null;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  stop_desk?: { id: number; name: string; code: string | null; type: string } | null;
  created_by_user?: { id: number; first_name: string; last_name: string } | null;
}

export interface CaisseWithBalance {
  id: number;
  name: string;
  is_active: boolean;
  caisse_type?: "sd" | "driver" | "admin";
  stop_desk: { id: number; name: string; code: string | null; type: string } | null;
  driver_user?: { id: number; first_name: string; last_name: string; phone: string | null } | null;
  total_in: number;
  total_out: number;
  balance: number;
}

export interface CaisseTransaction {
  id: number;
  caisse_id: number;
  type: TransactionType;
  direction: Direction;
  amount: number;
  package_id: number | null;
  description: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  package?: { id: number; tracking_number: string } | null;
  created_by_user?: { id: number; first_name: string; last_name: string } | null;
}

export interface PaginatedTransactions {
  data: CaisseTransaction[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface TransactionFilters {
  type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

// ── CRUD API functions ──────────────────────────────────────────────────────

export const getCaisses = (): Promise<ApiResponse<Caisse[]>> =>
  api("/caisse/list");

export const createCaisse = (data: {
  name: string;
  stop_desk_id?: number | null;
  is_active?: boolean;
}): Promise<ApiResponse<Caisse>> =>
  api("/caisse", { method: "POST", body: JSON.stringify(data) });

export const updateCaisse = (
  id: number,
  data: { name?: string; stop_desk_id?: number | null; is_active?: boolean }
): Promise<ApiResponse<Caisse>> =>
  api(`/caisse/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteCaisse = (id: number): Promise<ApiResponse> =>
  api(`/caisse/${id}`, { method: "DELETE" });

// ── Balance & Transaction API functions ─────────────────────────────────────

export const getCaisseBalances = (
  type?: "sd" | "driver"
): Promise<ApiResponse<CaisseWithBalance[]>> =>
  api(`/caisse/balances${type ? `?type=${type}` : ""}`);

/**
 * SD caisses only (stop_desk set, no driver). Used to resolve a Stop Desk →
 * its caisse id + live balance (the owing report doesn't carry the caisse id).
 */
export const getSdCaisses = (): Promise<ApiResponse<CaisseWithBalance[]>> =>
  getCaisseBalances("sd");

export const getCaisseTransactions = (
  caisseId: number,
  filters?: TransactionFilters
): Promise<ApiResponse<PaginatedTransactions>> => {
  const q = new URLSearchParams();
  if (filters?.type)      q.set("type", filters.type);
  if (filters?.date_from) q.set("date_from", filters.date_from);
  if (filters?.date_to)   q.set("date_to", filters.date_to);
  if (filters?.page)      q.set("page", String(filters.page));
  if (filters?.per_page)  q.set("per_page", String(filters.per_page));
  const qs = q.toString();
  return api(`/caisse/${caisseId}/transactions${qs ? `?${qs}` : ""}`);
};

export const createCaisseTransaction = (data: {
  caisse_id: number;
  type: string;
  amount: number;
  description?: string;
}): Promise<ApiResponse<CaisseTransaction>> =>
  api("/caisse/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });

// ── Display helpers ──────────────────────────────────────────────────────────

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  cod_collected:     "COD Collecté",
  shipping_received: "Frais Livraison",
  cod_remitted:      "COD Remis",
  expense:           "Dépense",
  transfer_out:      "Transfert Envoyé",
  transfer_in:       "Transfert Reçu",
  exp_payment:       "Paiement Expéditeur",
  driver_commission: "Commission Chauffeur",
  margin_profit:     "Marge Encaissée",
};

export const TRANSACTION_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  cod_collected:     { bg: "rgba(16,185,129,0.1)",  text: "#059669" },
  shipping_received: { bg: "rgba(59,130,246,0.1)",  text: "#2563eb" },
  cod_remitted:      { bg: "rgba(168,85,247,0.1)",  text: "#7c3aed" },
  expense:           { bg: "rgba(239,68,68,0.1)",   text: "#dc2626" },
  transfer_out:      { bg: "rgba(245,158,11,0.1)",  text: "#d97706" },
  transfer_in:       { bg: "rgba(16,185,129,0.1)",  text: "#059669" },
  exp_payment:       { bg: "rgba(239,68,68,0.1)",   text: "#dc2626" },
  driver_commission: { bg: "rgba(20,184,166,0.1)",  text: "#0d9488" },
  margin_profit:     { bg: "rgba(234,179,8,0.1)",   text: "#ca8a04" },
};

export function formatDA(amount: number): string {
  return new Intl.NumberFormat("fr-DZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " DA";
}
