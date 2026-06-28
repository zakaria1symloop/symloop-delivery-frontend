import { api, type ApiResponse } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

export type SystemConfigType = "string" | "integer" | "boolean" | "json" | "float";

export interface SystemConfig {
  id: number;
  key: string;
  value: string | null;
  type: SystemConfigType;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ── Known config keys used across the app ─────────────────────────────────────
export const SYSTEM_CONFIG_KEYS = {
  googleMaps: "google_maps_api_key",
  weather: "weather_api_key",
  openai: "openai_api_key",
  claude: "claude_api_key",
} as const;

// ── API wrappers ──────────────────────────────────────────────────────────────

/** Fetch all system configs. Returns `[]` when the endpoint is unavailable. */
export async function getSystemConfigs(): Promise<ApiResponse<SystemConfig[]>> {
  return api<SystemConfig[]>("/system-configs");
}

/** Fetch a single config by key. May 404 if the key is not set yet. */
export async function getSystemConfig(key: string): Promise<ApiResponse<SystemConfig>> {
  return api<SystemConfig>(`/system-configs/${encodeURIComponent(key)}`);
}

/** Upsert a config value by key. */
export async function setSystemConfig(
  key: string,
  value: string,
  type: SystemConfigType = "string",
): Promise<ApiResponse<SystemConfig>> {
  return api<SystemConfig>(`/system-configs/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value, type }),
  });
}
