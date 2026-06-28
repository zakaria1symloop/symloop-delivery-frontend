import { api, type ApiResponse } from "./api";

// ── Service types ──────────────────────────────────────────────────────────────
export type ServiceType = "livraison" | "pickup" | "echange" | "recouvrement";
export type DeliveryType = "home_delivery" | "stop_desk";
export type PaymentType = "sender" | "recipient";

// ── Package statuses (15 total: 10 outbound + 5 return) ───────────────────────
export type PackageStatus =
  // Outbound
  | "en_attente"
  | "pret_a_expedier"
  | "accepte_operateur"
  | "en_sac"
  | "en_transit"
  | "arrive_destination"
  | "reporte"
  | "pret_pour_retrait"
  | "pret_pour_chauffeur"
  | "demande_ramassage"
  | "en_ramassage"
  | "en_cours_livraison"
  | "livre"
  | "annule"
  // Return (deferred)
  | "echec_livraison"
  | "retour_en_sac"
  | "retour_en_transit"
  | "retour_arrive"
  | "retourne"
  | "echange_retour"
  // External provider
  | "externe_expedie"
  | "externe_en_transit"
  | "externe_livre"
  | "externe_retour";

// ── Call tracking ───────────────────────────────────────────────────────────
export type CallOutcome = "joint" | "pas_de_reponse" | "reporte" | "refuse" | "injoignable";

export const CALLABLE_STATUSES: PackageStatus[] = ["arrive_destination", "reporte"];

export interface PackageCallLog {
  id: number;
  package_id: number;
  outcome: CallOutcome;
  notes: string | null;
  called_by: number;
  called_by_user?: { id: number; first_name: string; last_name: string };
  created_at: string;
}

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  joint: "Joint",
  pas_de_reponse: "Pas de réponse",
  reporte: "Reporté",
  refuse: "Refusé",
  injoignable: "Injoignable",
};

// ── Interfaces ─────────────────────────────────────────────────────────────────
export interface Package {
  id: number;
  tracking_number: string;
  service_type: ServiceType;
  status: PackageStatus;

  // Sender
  sender_client_id: number | null;
  sender_name: string;
  sender_phone: string;
  sender_client?: { id: number; first_name: string; last_name: string; phone1: string };

  // Recipient
  recipient_name: string;
  recipient_phone: string;
  recipient_wilaya_id: number;
  recipient_commune_id: number | null;
  recipient_address: string | null;
  recipient_wilaya?: { id: number; name: string };
  recipient_commune?: { id: number; name: string };

  // Delivery
  delivery_type: DeliveryType;
  destination_stop_desk_id: number | null;
  destination_stop_desk?: { id: number; name: string; code: string | null };
  origin_stop_desk_id: number | null;
  origin_stop_desk?: { id: number; name: string; code: string | null };

  // Package details
  content_description: string;
  weight: number | null;
  declared_value: number;
  fragile: boolean;
  special_instructions: string | null;

  // Financials
  cod_amount: number;
  shipping_cost: number;
  payment_type: PaymentType;

  // Service-specific
  exchange_product: string | null;

  // Bag
  bag_id: number | null;
  bag?: { id: number; tracking_number: string; status: string };

  // Driver
  driver_id?: number | null;
  driver_assigned_at?: string | null;
  echec_reason?: string | null;
  driver?: { id: number; first_name: string; last_name: string; phone: string | null } | null;

  // Timestamps
  created_by: number;
  created_at: string;
  confirmed_at: string | null;
  accepted_at: string | null;
  in_bag_at: string | null;
  in_transit_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  returned_at: string | null;

  // Return
  return_cost: number | null;

  // Call tracking
  last_call_status: CallOutcome | null;
  last_call_notes: string | null;
  call_attempts: number;
  last_called_at: string | null;

  // External (DHD)
  routing_type?: "internal" | "external";
  external_shipment?: { id: number; external_tracking: string | null; mapped_status: string } | null;

  // Computed
  days_waiting?: number | null;
  status_logs?: PackageStatusLog[];
  call_logs?: PackageCallLog[];
}

export interface PackageStatusLog {
  id: number;
  package_id: number;
  from_status: string | null;
  to_status: string;
  changed_by: number;
  changed_by_user?: { id: number; first_name: string; last_name: string };
  stop_desk_id: number | null;
  stop_desk?: { id: number; name: string };
  bag_id: number | null;
  bag?: { id: number; tracking_number: string };
  notes: string | null;
  created_at: string;
}

export interface PaginatedPackages {
  data: Package[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface PackageStats {
  en_attente: number;
  pret_a_expedier: number;
  accepte_operateur: number;
  en_sac: number;
  en_transit: number;
  arrive_destination: number;
  pret_pour_retrait: number;
  livre: number;
  annule: number;
  reporte: number;
  echec_livraison: number;
  retour_en_sac: number;
  retour_en_transit: number;
  retour_arrive: number;
  retourne: number;
  total: number;
}

// ── Create payload ─────────────────────────────────────────────────────────────
export interface CreatePackagePayload {
  service_type: ServiceType;
  sender_client_id?: number | null;
  sender_name: string;
  sender_phone: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_wilaya_id: number;
  recipient_commune_id?: number | null;
  recipient_address?: string | null;
  origin_stop_desk_id: number;
  delivery_type: DeliveryType;
  destination_stop_desk_id?: number | null;
  content_description: string;
  weight?: number | null;
  declared_value?: number;
  cod_amount?: number;
  payment_type: PaymentType;
  fragile?: boolean;
  special_instructions?: string | null;
  exchange_product?: string | null;
  shipping_cost?: number;
}

// ── API functions ──────────────────────────────────────────────────────────────
export const getPackages = (params?: {
  service_type?: string;
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
  origin_stop_desk_id?: number;
  destination_stop_desk_id?: number;
  destination_wilaya_id?: number;
  date_from?: string;
  date_to?: string;
  late_only?: boolean;
}): Promise<ApiResponse<PaginatedPackages>> => {
  const q = new URLSearchParams();
  if (params?.service_type)             q.set("service_type", params.service_type);
  if (params?.status)                   q.set("status", params.status);
  if (params?.search)                   q.set("search", params.search);
  if (params?.page)                     q.set("page", String(params.page));
  if (params?.per_page)                 q.set("per_page", String(params.per_page));
  if (params?.origin_stop_desk_id)      q.set("origin_stop_desk_id", String(params.origin_stop_desk_id));
  if (params?.destination_stop_desk_id) q.set("destination_stop_desk_id", String(params.destination_stop_desk_id));
  if (params?.destination_wilaya_id)    q.set("destination_wilaya_id", String(params.destination_wilaya_id));
  if (params?.date_from)                q.set("date_from", params.date_from);
  if (params?.date_to)                  q.set("date_to", params.date_to);
  if (params?.late_only)                q.set("late_only", "1");
  const qs = q.toString();
  return api(`/packages${qs ? `?${qs}` : ""}`);
};

export const getPackage = (id: number): Promise<ApiResponse<Package>> =>
  api(`/packages/${id}`);

export const deletePackage = (id: number): Promise<ApiResponse> =>
  api(`/packages/${id}`, { method: "DELETE" });

export const createPackage = (data: CreatePackagePayload): Promise<ApiResponse<Package>> =>
  api("/packages", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updatePackage = (id: number, data: Partial<CreatePackagePayload>): Promise<ApiResponse<Package>> =>
  api(`/packages/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// Manual status endpoint: validates the transition, ENFORCES require_note
// (422 if missing), checks role/user authorization (403), and fires workflow
// actions. `status` is widened to accept custom workflow-step keys (arbitrary
// strings) returned by scan-accept's `workflow_next`, while keeping autocomplete
// for the built-in PackageStatus values.
export const updatePackageStatus = (
  id: number,
  status: PackageStatus | (string & {}),
  notes?: string
): Promise<ApiResponse<Package>> =>
  api(`/packages/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });

// ── scan-accept ────────────────────────────────────────────────────────────
// One available next step in a custom status workflow (returned by scan-accept
// when the colis must advance BEFORE it can be accepted).
export interface WorkflowNextStep {
  key: string;
  label: string;
  require_note: boolean;
}

// scan-accept's `data` is the package, but when a workflow blocks acceptance it
// also carries `workflow_next` + `workflow_message` (status NOT changed). On a
// normal acceptance it carries pickup_fee/pickup_free for the pay-driver prompt.
export interface ScanAcceptResult extends Package {
  workflow_next?: WorkflowNextStep[];
  workflow_message?: string;
  pickup_free?: boolean;
  pickup_fee?: number;
}

export const scanAcceptPackage = (
  tracking_number: string,
  force_accept?: boolean
): Promise<ApiResponse<ScanAcceptResult>> =>
  api("/packages/scan-accept", {
    method: "POST",
    body: JSON.stringify({ tracking_number, ...(force_accept ? { force_accept: true } : {}) }),
  });

export const searchByPhone = (
  phone: string,
  stop_desk_id?: number
): Promise<ApiResponse<Package[]>> =>
  api("/packages/search-by-phone", {
    method: "POST",
    body: JSON.stringify({ phone, stop_desk_id }),
  });

export const searchForRetrait = (
  query: string,
  stop_desk_id?: number
): Promise<ApiResponse<Package[]>> =>
  api("/packages/search-by-phone", {
    method: "POST",
    body: JSON.stringify({ query, stop_desk_id }),
  });

export const deliverPackage = (
  id: number,
  recipient_phone: string
): Promise<ApiResponse<Package>> =>
  api(`/packages/${id}/deliver`, {
    method: "POST",
    body: JSON.stringify({ recipient_phone }),
  });

export const getPackageHistory = (
  id: number
): Promise<ApiResponse<PackageStatusLog[]>> =>
  api(`/packages/${id}/history`);

export const getPackageStats = (params?: {
  origin_stop_desk_id?: number;
  destination_stop_desk_id?: number;
}): Promise<ApiResponse<PackageStats>> => {
  const q = new URLSearchParams();
  if (params?.origin_stop_desk_id) q.set("origin_stop_desk_id", String(params.origin_stop_desk_id));
  if (params?.destination_stop_desk_id) q.set("destination_stop_desk_id", String(params.destination_stop_desk_id));
  const qs = q.toString();
  return api(`/packages/stats${qs ? `?${qs}` : ""}`);
};

export const bulkMarkReady = (
  package_ids: number[]
): Promise<ApiResponse<{ updated: number; errors: string[] }>> =>
  api("/packages/bulk-ready", {
    method: "POST",
    body: JSON.stringify({ package_ids }),
  });

export const recordPackageCall = (
  id: number,
  outcome: CallOutcome,
  notes?: string
): Promise<ApiResponse<Package>> =>
  api(`/packages/${id}/record-call`, {
    method: "POST",
    body: JSON.stringify({ outcome, notes }),
  });

export const getPackageCallLogs = (
  id: number
): Promise<ApiResponse<PackageCallLog[]>> =>
  api(`/packages/${id}/call-logs`);

export interface ContactStats {
  total: number;
  livre: number;
  retour: number;
  retour_pct: number;
  // Sender-specific
  en_cours?: number;
  total_cod?: number;
  total_shipping?: number;
  // Recipient-specific
  reporte?: number;
  livre_pct?: number;
}

export const getContactStats = (
  phone: string,
  role: "sender" | "recipient"
): Promise<ApiResponse<ContactStats>> =>
  api(`/packages/contact-stats?phone=${encodeURIComponent(phone)}&role=${role}`);

export const getEchecThreshold = (): Promise<ApiResponse<{ threshold: number }>> =>
  api("/packages/echec-threshold");

export const declareEchec = (id: number): Promise<ApiResponse<Package>> =>
  api(`/packages/${id}/declare-echec`, { method: "POST" });

export const searchForReturnPickup = (
  query: string,
  stop_desk_id?: number
): Promise<ApiResponse<Package[]>> =>
  api("/packages/search-return-pickup", {
    method: "POST",
    body: JSON.stringify({ query, stop_desk_id }),
  });

export const returnPickupPackage = (
  id: number,
  sender_phone: string
): Promise<ApiResponse<Package>> =>
  api(`/packages/${id}/return-pickup`, {
    method: "POST",
    body: JSON.stringify({ sender_phone }),
  });

export const bulkReturnPickup = (
  package_ids: number[],
  sender_phone: string
): Promise<ApiResponse<{ processed: number; total_return_cost: number; errors: string[] }>> =>
  api("/packages/bulk-return-pickup", {
    method: "POST",
    body: JSON.stringify({ package_ids, sender_phone }),
  });

// ── Display helpers ────────────────────────────────────────────────────────────
export const SERVICE_LABELS: Record<ServiceType, string> = {
  livraison:    "Livraison",
  pickup:       "Pickup",
  echange:      "Échange",
  recouvrement: "Recouvrement",
};

export const STATUS_LABELS: Record<PackageStatus, string> = {
  en_attente:           "En attente",
  pret_a_expedier:      "Prêt à expédier",
  accepte_operateur:    "Accepté opérateur",
  en_sac:               "En sac",
  en_transit:           "En transit",
  arrive_destination:   "Arrivé destination",
  pret_pour_retrait:    "Prêt pour retrait",
  pret_pour_chauffeur:  "Prêt pour livreur",
  demande_ramassage:    "Demande de ramassage",
  en_ramassage:         "En ramassage",
  en_cours_livraison:   "En cours de livraison",
  livre:                "Livré",
  annule:               "Annulé",
  reporte:              "Reporté",
  echec_livraison:      "Échec livraison",
  retour_en_sac:        "Retour en sac",
  retour_en_transit:    "Retour en transit",
  retour_arrive:        "Retour arrivé",
  retourne:             "Retourné",
  echange_retour:       "Échange retour",
  externe_expedie:      "En préparation",
  externe_en_transit:   "En transit",
  externe_livre:        "Livré",
  externe_retour:       "Retour",
};

export const STATUS_COLORS: Record<PackageStatus, { bg: string; text: string; dot: string }> = {
  en_attente:          { bg: "rgba(245,158,11,0.1)",  text: "#d97706", dot: "#f59e0b" },
  pret_a_expedier:     { bg: "rgba(59,130,246,0.1)",  text: "#2563eb", dot: "#3b82f6" },
  accepte_operateur:   { bg: "rgba(16,185,129,0.1)",  text: "#059669", dot: "#10b981" },
  en_sac:              { bg: "rgba(99,102,241,0.1)",   text: "#4f46e5", dot: "#6366f1" },
  en_transit:          { bg: "rgba(249,115,22,0.1)",   text: "#ea580c", dot: "#f97316" },
  arrive_destination:  { bg: "rgba(20,184,166,0.1)",   text: "#0f766e", dot: "#14b8a6" },
  pret_pour_retrait:   { bg: "rgba(6,182,212,0.1)",    text: "#0891b2", dot: "#06b6d4" },
  pret_pour_chauffeur: { bg: "rgba(139,92,246,0.1)",   text: "#7c3aed", dot: "#8b5cf6" },
  demande_ramassage:   { bg: "rgba(251,191,36,0.1)",  text: "#b45309", dot: "#f59e0b" },
  en_ramassage:        { bg: "rgba(168,85,247,0.1)",  text: "#9333ea", dot: "#a855f7" },
  en_cours_livraison:  { bg: "rgba(249,115,22,0.1)",  text: "#ea580c", dot: "#f97316" },
  livre:               { bg: "rgba(34,197,94,0.1)",    text: "#16a34a", dot: "#22c55e" },
  annule:              { bg: "rgba(107,114,128,0.1)",  text: "#4b5563", dot: "#6b7280" },
  reporte:             { bg: "rgba(139,92,246,0.1)",    text: "#7c3aed", dot: "#8b5cf6" },
  echec_livraison:     { bg: "rgba(239,68,68,0.1)",    text: "#dc2626", dot: "#ef4444" },
  retour_en_sac:       { bg: "rgba(168,85,247,0.1)",   text: "#9333ea", dot: "#a855f7" },
  retour_en_transit:   { bg: "rgba(236,72,153,0.1)",   text: "#db2777", dot: "#ec4899" },
  retour_arrive:       { bg: "rgba(251,146,60,0.1)",   text: "#ea580c", dot: "#fb923c" },
  retourne:            { bg: "rgba(168,85,247,0.1)",   text: "#7c3aed", dot: "#a855f7" },
  echange_retour:      { bg: "rgba(168,85,247,0.1)",   text: "#7c3aed", dot: "#a855f7" },
  externe_expedie:     { bg: "rgba(249,115,22,0.1)",   text: "#ea580c", dot: "#f97316" },
  externe_en_transit:  { bg: "rgba(59,130,246,0.1)",   text: "#2563eb", dot: "#3b82f6" },
  externe_livre:       { bg: "rgba(16,185,129,0.1)",   text: "#059669", dot: "#10b981" },
  externe_retour:      { bg: "rgba(239,68,68,0.1)",    text: "#dc2626", dot: "#ef4444" },
};

// Transitions map for UI (restrict dropdown options)
export const TRANSITIONS: Partial<Record<PackageStatus, PackageStatus[]>> = {
  en_attente:           ["pret_a_expedier", "accepte_operateur", "demande_ramassage", "annule"],
  demande_ramassage:    ["en_ramassage", "en_attente", "annule"],
  en_ramassage:         ["accepte_operateur", "demande_ramassage", "en_attente"],
  pret_a_expedier:      ["accepte_operateur", "annule"],
  accepte_operateur:    ["en_sac", "annule"],
  en_sac:               ["en_transit"],
  en_transit:           ["arrive_destination"],
  arrive_destination:   ["pret_pour_retrait", "pret_pour_chauffeur", "reporte", "echec_livraison"],
  reporte:              ["pret_pour_retrait", "pret_pour_chauffeur", "echec_livraison", "annule"],
  pret_pour_retrait:    ["echec_livraison"],  // Livré only via Retrait Client page
  pret_pour_chauffeur:  ["en_cours_livraison", "echec_livraison"],
  en_cours_livraison:   ["livre", "echec_livraison", "pret_pour_chauffeur"],
  livre:                [],
  annule:               [],
  // Return flow
  echec_livraison:      ["retour_en_sac"],
  retour_en_sac:        ["retour_en_transit", "echec_livraison"],
  retour_en_transit:    ["retour_arrive"],
  retour_arrive:        ["retourne"],
  retourne:             [],
};
