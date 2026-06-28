import { api, type ApiResponse } from "./api";

export interface ExpediteurWallet {
  id: number;
  user_id: number;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletWithUser {
  wallet: ExpediteurWallet;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    company_name: string | null;
  };
}

export interface WalletTransaction {
  id: number;
  wallet_id: number;
  type: string;
  direction: "in" | "out";
  amount: number;
  balance_after: number;
  package_id: number | null;
  description: string | null;
  created_at: string;
  package?: { id: number; tracking_number: string };
  created_by_user?: { id: number; first_name: string; last_name: string };
}

export const getWalletByPhone = (phone: string): Promise<ApiResponse<WalletWithUser | null>> =>
  api(`/wallet/by-phone/${encodeURIComponent(phone)}`);

export const getWallet = (userId: number): Promise<ApiResponse<ExpediteurWallet>> =>
  api(`/wallet/expediteur/${userId}`);

export interface WalletSummary {
  wallet_id: number;
  balance: number;
  en_transit: number;        // COD locked in transit
  libere: number;            // COD available for withdrawal
  dettes: number;            // Shipping + return costs owed
  retour_count: number;      // Failed packages count
  total_delivered: number;
  total_cod: number;
  total_cod_credited: number;
  total_shipping: number;
  total_return_cost: number;
  total_withdrawals: number;
}

export const getWalletSummary = (userId: number): Promise<ApiResponse<WalletSummary>> =>
  api(`/wallet/expediteur/${userId}/summary`);

export const withdrawFromWallet = (
  userId: number,
  amount: number,
  description?: string
): Promise<ApiResponse<{ new_balance: number; amount: number }>> =>
  api(`/wallet/expediteur/${userId}/withdraw`, {
    method: "POST",
    body: JSON.stringify({ amount, description }),
  });

export const getWalletTransactions = (userId: number): Promise<ApiResponse<WalletTransaction[]>> =>
  api(`/wallet/expediteur/${userId}/transactions`);
