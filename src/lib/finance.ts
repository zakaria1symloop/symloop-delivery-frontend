import { api, type ApiResponse } from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Finance redesign (Phase B) typed wrappers.
// Surfaces the clean `/finance/*` backend: the "who owes whom" report, the
// prélèvement config, and the three money flows (versement / dispatch / SD↔SD)
// plus the shared transfers ledger (confirm / reject).
// Contract mirrors backend-nest/src/finance exactly.
// ─────────────────────────────────────────────────────────────────────────────

export type SettlementMode = "gross" | "net";
export type PrelevementType = "fixed" | "percent";

// ── GET /finance/owing ──
export interface OwingBreakdown {
  collected: number;
  /** Total commission = sender_commission + receiver_commission. */
  commission: number;
  remitted: number;
  dispatched: number;
  /** Prélèvement origine — applied to colis originated by this SD. */
  sender_commission: number;
  sender_type: PrelevementType | string;
  sender_value: number;
  /** Prélèvement livraison — applied to colis delivered by this SD. */
  receiver_commission: number;
  receiver_type: PrelevementType | string;
  receiver_value: number;
  /** Number of colis originated by this SD (sender commission base). */
  originated_count: number;
  /** Number of colis delivered by this SD (receiver commission base). */
  delivered_count: number;
}

export interface OwingSd {
  stop_desk_id: number;
  name: string;
  settlement_mode: SettlementMode;
  caisse_balance: number;
  /** What the SD still owes the global caisse (clamped ≥ 0). */
  sd_owes_us: number;
  /** What the global caisse still owes the SD (clamped ≥ 0). */
  we_owe_sd: number;
  /** Signed net position: positive = SD owes us, negative = we owe SD. */
  net: number;
  breakdown: OwingBreakdown;
}

export interface OwingReport {
  global: {
    caisse_balance: number;
    total_sd_owes_us: number;
    total_we_owe_sd: number;
  };
  sds: OwingSd[];
}

export const getOwingReport = (): Promise<ApiResponse<OwingReport>> =>
  api("/finance/owing");

// ── GET / PUT /finance/prelevement ──
// DUAL prélèvement: a sender side (charged at origin) and a receiver side
// (charged at delivery). Each side has its own type + value.
export interface PrelevementSide {
  type: PrelevementType | string;
  value: number;
}

export interface PrelevementGlobal {
  sender: PrelevementSide;
  receiver: PrelevementSide;
}

export interface PrelevementSd {
  stop_desk_id: number;
  name: string;
  sender_type: PrelevementType | string;
  sender_value: number;
  receiver_type: PrelevementType | string;
  receiver_value: number;
  settlement_mode: SettlementMode | string;
}

export interface PrelevementConfig {
  global: PrelevementGlobal;
  sds: PrelevementSd[];
}

export const getPrelevement = (): Promise<ApiResponse<PrelevementConfig>> =>
  api("/finance/prelevement");

// Partial allowed: send only the side(s) that changed.
export const updateGlobalPrelevement = (
  body: { sender?: PrelevementSidePayload; receiver?: PrelevementSidePayload }
): Promise<ApiResponse<{ global: PrelevementGlobal }>> =>
  api("/finance/prelevement/global", { method: "PUT", body: JSON.stringify(body) });

export interface PrelevementSidePayload {
  type: PrelevementType;
  value: number;
}

export const updateSdPrelevement = (
  id: number,
  body: {
    sender_type?: PrelevementType;
    sender_value?: number;
    receiver_type?: PrelevementType;
    receiver_value?: number;
    settlement_mode?: SettlementMode;
  }
): Promise<ApiResponse<PrelevementSd>> =>
  api(`/finance/prelevement/sd/${id}`, { method: "PUT", body: JSON.stringify(body) });

// ── Transfers ledger (shared between the three flows) ──
export type TransferStatus = "pending" | "confirmed" | "rejected";

export interface FinanceTransfer {
  id: number;
  from_stop_desk_id: number | null;
  to_stop_desk_id: number | null;
  amount: number;
  type: string;
  status: TransferStatus | string;
  description: string | null;
  reference: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at?: string;
  from_stop_desk: { id: number; name: string } | null;
  to_stop_desk: { id: number; name: string } | null;
  created_by: { id: number; first_name: string; last_name: string } | null;
  confirmed_by: { id: number; first_name: string; last_name: string } | null;
}

export const getTransfers = (
  filters?: { stop_desk_id?: number; status?: string }
): Promise<ApiResponse<FinanceTransfer[]>> => {
  const q = new URLSearchParams();
  if (filters?.stop_desk_id) q.set("stop_desk_id", String(filters.stop_desk_id));
  if (filters?.status) q.set("status", filters.status);
  const qs = q.toString();
  return api(`/finance/transfers${qs ? `?${qs}` : ""}`);
};

// ── Money flows ──
// SD → Global (the SD remits collected cash up; admin confirms).
export const postVersement = (
  body: { stop_desk_id: number; amount: number; note?: string }
): Promise<ApiResponse<FinanceTransfer>> =>
  api("/finance/versement", { method: "POST", body: JSON.stringify(body) });

// Global → SD (admin dispatches money down; the SD confirms receipt).
export const postDispatch = (
  body: { stop_desk_id: number; amount: number; note?: string }
): Promise<ApiResponse<FinanceTransfer>> =>
  api("/finance/dispatch", { method: "POST", body: JSON.stringify(body) });

// SD ↔ SD (the receiving SD confirms).
export const postTransfer = (
  body: { from_stop_desk_id: number; to_stop_desk_id: number; amount: number; note?: string }
): Promise<ApiResponse<FinanceTransfer>> =>
  api("/finance/transfer", { method: "POST", body: JSON.stringify(body) });

export const confirmTransfer = (id: number): Promise<ApiResponse<FinanceTransfer>> =>
  api(`/finance/transfers/${id}/confirm`, { method: "PATCH" });

export const rejectTransfer = (id: number): Promise<ApiResponse<FinanceTransfer>> =>
  api(`/finance/transfers/${id}/reject`, { method: "PATCH" });

// ── Display helpers ──
export function formatDA(n: number | string): string {
  return Number(n).toLocaleString("fr-DZ") + " DA";
}

export const SETTLEMENT_LABELS: Record<string, string> = {
  gross: "Brut",
  net: "Net",
};

export const PRELEVEMENT_LABELS: Record<string, string> = {
  fixed: "Fixe",
  percent: "Pourcentage",
};

export const TRANSFER_STATUS_CFG: Record<string, { color: string; label: string }> = {
  pending: { color: "#f59e0b", label: "En attente" },
  confirmed: { color: "#16a34a", label: "Confirmé" },
  rejected: { color: "#ef4444", label: "Rejeté" },
};
