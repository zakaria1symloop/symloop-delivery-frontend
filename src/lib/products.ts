import { api, type ApiResponse } from "./api";

export interface Product {
  id: number;
  user_id: number;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductSummary {
  total_products: number;
  in_stock: number;
  out_of_stock: number;
  total_units: number;
  stock_value: number;
}

export const getProducts = (
  search?: string,
): Promise<ApiResponse<{ products: Product[]; summary: ProductSummary }>> => {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return api(`/expediteur/products${q}`);
};

export const createProduct = (data: Partial<Product>): Promise<ApiResponse<Product>> =>
  api("/expediteur/products", { method: "POST", body: JSON.stringify(data) });

export const updateProduct = (id: number, data: Partial<Product>): Promise<ApiResponse<Product>> =>
  api(`/expediteur/products/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteProduct = (id: number): Promise<ApiResponse> =>
  api(`/expediteur/products/${id}`, { method: "DELETE" });

export const sellProduct = (id: number, quantity = 1): Promise<ApiResponse<Product>> =>
  api(`/expediteur/products/${id}/sell`, { method: "POST", body: JSON.stringify({ quantity }) });
