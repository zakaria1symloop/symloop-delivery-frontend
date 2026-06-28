import { api, type ApiResponse } from "./api";

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  type: "string" | "integer" | "boolean" | "json" | "float";
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const getSystemConfigs = (): Promise<ApiResponse<SystemConfig[]>> =>
  api("/system-configs");

export const getSystemConfig = (key: string): Promise<ApiResponse<SystemConfig>> =>
  api(`/system-configs/${key}`);

export const updateSystemConfig = (
  key: string,
  value: string | number | boolean,
  type?: string
): Promise<ApiResponse<SystemConfig>> =>
  api(`/system-configs/${key}`, {
    method: "PUT",
    body: JSON.stringify({ value, type }),
  });
