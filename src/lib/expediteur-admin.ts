// ─────────────────────────────────────────────────────────────────────────────
// Admin-side merchant (expéditeur) ERP data layer.
//
// These wrappers power the back-office "fiche ERP" at
// /dashboard/expediteurs/:id — i.e. an admin / operator inspecting ANOTHER
// user's merchant data, scoped by :id. They mirror the merchant self-service
// endpoints in src/lib/expediteur.ts (which read auth()), but target the
// admin variants under /users/:id/expediteur-* (+ the shared /reclamations,
// /tarification/expediteur/:id and activity-logs endpoints).
//
// Result types reuse the canonical shapes already defined elsewhere so the tabs
// share one source of truth; only the genuinely admin-specific envelopes
// (wallet, clients/products summaries) are declared here.
// ─────────────────────────────────────────────────────────────────────────────
import { api, type ApiResponse } from "./api";
import { getUser, type ExpediteurStats } from "./users";
import type { PaginatedPackages } from "./packages";
import type { Product, ProductSummary } from "./products";
import type { ExpClient } from "./expediteur";
import { getExpediteurTariffs, type TariffRow } from "./tarification";
import { getUserActivity, type PaginatedActivity } from "./activity";
import type { PaginatedReclamations } from "./reclamations";

// ── Re-exported canonical types (one import surface for the tabs) ──────────────
export { getUser };
export type { StaffUser, ExpediteurStats } from "./users";
export type { Package, PaginatedPackages } from "./packages";
export type { Product, ProductSummary } from "./products";
export type { ExpClient } from "./expediteur";
export type { TariffRow } from "./tarification";
export type { PaginatedActivity, ActivityLog } from "./activity";
export type { PaginatedReclamations, ReclamationListItem } from "./reclamations";

// ── Admin-specific result envelopes ───────────────────────────────────────────

/** GET /users/:id/expediteur-wallet — admin view of a merchant's wallet ledger.
 *  Mirrors ExpediteurDashboardController@wallet (balance + breakdown totals). */
export interface ExpAdminWallet {
  balance: number;
  en_transit: number;
  libere: number;
  dettes: number;
  total_cod_credited: number;
  total_shipping: number;
  total_return_cost: number;
  total_withdrawals: number;
}

/** GET /users/:id/expediteur-clients — destinataires this merchant shipped to,
 *  aggregated by phone (mirrors ExpediteurDashboardController@clients). */
export interface ExpClientsResult {
  clients: ExpClient[];
  summary: { total_clients: number; total_orders: number; total_cod: number };
}

/** GET /users/:id/expediteur-products — merchant catalogue + stock summary
 *  (mirrors ExpediteurProductController@index). */
export interface ExpProductsResult {
  products: Product[];
  summary: ProductSummary;
}

/** GET /tarification/expediteur/:id — per-merchant tariff overrides. */
export interface ExpTarifsResult {
  tariffs: TariffRow[];
}

// ── Query param shapes ────────────────────────────────────────────────────────
export interface ExpPackagesParams {
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  destination_wilaya_id?: number;
  page?: number;
  per_page?: number;
}

export interface ExpReclamationsParams {
  status?: string;
  type?: string;
  priority?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

// ── Wrappers ──────────────────────────────────────────────────────────────────

/** 1. KPI / dossier statistics — total, by_status, rates, CA, COD, recent[]. */
export const getExpStats = (id: number): Promise<ApiResponse<ExpediteurStats>> =>
  api(`/users/${id}/expediteur-stats`);

/** 2. Paginated colis belonging to this merchant. */
export const getExpPackages = (
  id: number,
  params: ExpPackagesParams = {},
): Promise<ApiResponse<PaginatedPackages>> => {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.destination_wilaya_id) q.set("destination_wilaya_id", String(params.destination_wilaya_id));
  if (params.page) q.set("page", String(params.page));
  if (params.per_page) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return api(`/users/${id}/expediteur-packages${qs ? `?${qs}` : ""}`);
};

/** 3. Wallet ledger summary for this merchant. */
export const getExpWallet = (id: number): Promise<ApiResponse<ExpAdminWallet>> =>
  api(`/users/${id}/expediteur-wallet`);

/** 4. Catalogue + stock summary for this merchant. */
export const getExpProducts = (
  id: number,
  search?: string,
): Promise<ApiResponse<ExpProductsResult>> => {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return api(`/users/${id}/expediteur-products${q}`);
};

/** 5. Destinataires aggregated by phone for this merchant. */
export const getExpClients = (
  id: number,
  search?: string,
): Promise<ApiResponse<ExpClientsResult>> => {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return api(`/users/${id}/expediteur-clients${q}`);
};

/** 6. Réclamations opened BY this merchant (GET /reclamations?created_by=:id). */
export const getExpReclamations = (
  id: number,
  params: ExpReclamationsParams = {},
): Promise<ApiResponse<PaginatedReclamations>> => {
  const q = new URLSearchParams();
  q.set("created_by", String(id));
  if (params.status) q.set("status", params.status);
  if (params.type) q.set("type", params.type);
  if (params.priority) q.set("priority", params.priority);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.per_page) q.set("per_page", String(params.per_page));
  return api(`/reclamations?${q.toString()}`);
};

/** 7. Per-merchant tariff overrides (reuses the canonical tarification wrapper). */
export const getExpTarifs = (
  id: number,
  departureWilayaId?: number,
): Promise<ApiResponse<ExpTarifsResult>> =>
  getExpediteurTariffs(id, departureWilayaId);

/** 8. Paginated activity trail for this user (reuses the activity-logs wrapper). */
export const getExpActivity = (
  id: number,
  page = 1,
  perPage = 20,
): Promise<ApiResponse<PaginatedActivity>> =>
  getUserActivity(id, page, perPage);
