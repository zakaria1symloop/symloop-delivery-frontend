import { api, type ApiResponse } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────
export type ServiceType = "delivery" | "pickup" | "exchange" | "recouvrement" | "return";
export type DeliveryMode = "home" | "desk";

export interface TariffRow {
  id?: number;
  departure_wilaya_id: number;
  destination_wilaya_id: number;
  destination_wilaya?: { id: number; name: string; code: string };
  departure_wilaya?: { id: number; name: string; code: string };
  delivery_home_price: number;
  delivery_desk_price: number;
  pickup_home_price: number;
  pickup_desk_price: number;
  exchange_home_price: number;
  exchange_desk_price: number;
  recouvrement_home_price: number;
  recouvrement_desk_price: number;
  return_home_price: number;
  return_desk_price: number;
  is_active: boolean;
  [key: string]: unknown;
}

export interface TariffLookupResult {
  price: number;
  source: "expediteur" | "default";
}

export interface TariffLookupParams {
  user_id?: number;
  departure_wilaya_id: number;
  destination_wilaya_id: number;
  service_type: ServiceType;
  delivery_mode: DeliveryMode;
}

// ── Constants ────────────────────────────────────────────────────────────────
export const PRICE_COLUMNS = [
  "delivery_home_price", "delivery_desk_price",
  "pickup_home_price", "pickup_desk_price",
  "exchange_home_price", "exchange_desk_price",
  "recouvrement_home_price", "recouvrement_desk_price",
  "return_home_price", "return_desk_price",
] as const;

export type PriceColumn = (typeof PRICE_COLUMNS)[number];

export const SERVICE_TABS: {
  key: ServiceType;
  label: string;
  homeCol: PriceColumn;
  deskCol: PriceColumn;
}[] = [
  { key: "delivery",      label: "Livraison",     homeCol: "delivery_home_price",      deskCol: "delivery_desk_price" },
  { key: "pickup",        label: "PickUp",        homeCol: "pickup_home_price",        deskCol: "pickup_desk_price" },
  { key: "exchange",      label: "Échange",       homeCol: "exchange_home_price",      deskCol: "exchange_desk_price" },
  { key: "recouvrement",  label: "Recouvrement",  homeCol: "recouvrement_home_price",  deskCol: "recouvrement_desk_price" },
  { key: "return",        label: "Retour",        homeCol: "return_home_price",        deskCol: "return_desk_price" },
];

// ── API functions ────────────────────────────────────────────────────────────
export function getDefaultTariffs(departureWilayaId?: number): Promise<ApiResponse<{ tariffs: TariffRow[]; override_counts: Record<number, number> }>> {
  const q = new URLSearchParams();
  if (departureWilayaId !== undefined) {
    q.set("departure_wilaya_id", String(departureWilayaId));
  }
  const qs = q.toString();
  return api(`/tarification/defaults${qs ? `?${qs}` : ""}`);
}

export function saveDefaultTariffs(tariffs: Partial<TariffRow>[]): Promise<ApiResponse> {
  return api("/tarification/defaults", {
    method: "POST",
    body: JSON.stringify({ tariffs }),
  });
}

export function getDefaultDepartures(): Promise<ApiResponse<{ id: number; name: string; code: string }[]>> {
  return api("/tarification/defaults/departures");
}

export function getExpediteurTariffs(userId: number, departureWilayaId?: number): Promise<ApiResponse<{ tariffs: TariffRow[] }>> {
  const q = new URLSearchParams();
  if (departureWilayaId !== undefined) {
    q.set("departure_wilaya_id", String(departureWilayaId));
  }
  const qs = q.toString();
  return api(`/tarification/expediteur/${userId}${qs ? `?${qs}` : ""}`);
}

export function saveExpediteurTariffs(userId: number, tariffs: Partial<TariffRow>[]): Promise<ApiResponse> {
  return api(`/tarification/expediteur/${userId}`, {
    method: "POST",
    body: JSON.stringify({ tariffs }),
  });
}

export function getExpediteurDepartures(userId: number): Promise<ApiResponse<{ id: number; name: string; code: string }[]>> {
  return api(`/tarification/expediteur/${userId}/departures`);
}

export function lookupTariff(params: TariffLookupParams): Promise<ApiResponse<TariffLookupResult | null>> {
  const q = new URLSearchParams({
    departure_wilaya_id: String(params.departure_wilaya_id),
    destination_wilaya_id: String(params.destination_wilaya_id),
    service_type: params.service_type,
    delivery_mode: params.delivery_mode,
  });
  if (params.user_id) q.set("user_id", String(params.user_id));
  return api(`/tarification/lookup?${q}`);
}
