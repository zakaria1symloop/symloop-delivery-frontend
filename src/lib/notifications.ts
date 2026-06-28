// ── Automation / Notifications engine — frontend API wrappers ─────────────────
// Typed wrappers over the Nest notifications module. Mirrors the backend contract
// in backend-nest/src/notifications/notifications.constants.ts.
// The global ResponseInterceptor wraps every payload as { success, data }, so the
// api() helper already returns that envelope.

import { api, type ApiResponse } from "./api";

// ── Channels & recipients ─────────────────────────────────────────────────────
export const NOTIFICATION_CHANNELS = ["email", "sms", "notification", "webhook"] as const;
export type ChannelType = (typeof NOTIFICATION_CHANNELS)[number];

export const RECIPIENT_ROLES = [
  "expediteur",
  "destinataire",
  "chauffeur",
  "operateur",
  "admin",
  "custom",
] as const;
export type RecipientRole = (typeof RECIPIENT_ROLES)[number];

// ── Workflow definition (persisted as one JSON blob in system_configs) ─────────
// Status nodes round-trip arbitrary UI metadata (positions, colors, transitions…)
// verbatim — the backend keeps array elements as-is, so the index signature is
// intentional.
export interface WorkflowStatusNode {
  key: string;
  label?: string;
  color?: string;
  order?: number;
  [extra: string]: unknown;
}

export interface WorkflowActionNode {
  status_key: string;
  type: ChannelType;
  recipient: RecipientRole;
  custom_target?: string;
  subject?: string;
  template?: string;
}

export interface WorkflowDefinition {
  statuses: WorkflowStatusNode[];
  actions: WorkflowActionNode[];
}

export interface ChannelsStatus {
  email: boolean;
  sms: boolean;
  notification: boolean;
  webhook: boolean;
}

// ── Notification audit log (GET /notifications/logs) ──────────────────────────
export interface NotificationLog {
  id: number;
  trigger_type: string;
  trigger_ref: string | null;
  channel: string;
  recipient_role: string | null;
  recipient_address: string | null;
  package_id: number | null;
  user_id: number | null;
  subject: string | null;
  body: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  package?: { id: number; tracking_number: string; status: string } | null;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface NotificationLogFilters {
  status?: string;
  channel?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

// ── UI labels ─────────────────────────────────────────────────────────────────
export const CHANNEL_LABELS: Record<ChannelType, string> = {
  email: "Email",
  sms: "SMS",
  notification: "Notification",
  webhook: "Webhook",
};

export const RECIPIENT_LABELS: Record<RecipientRole, string> = {
  expediteur: "Expéditeur",
  destinataire: "Destinataire",
  chauffeur: "Chauffeur",
  operateur: "Opérateur",
  admin: "Admin",
  custom: "Personnalisé",
};

/** Template variables available for {{var}} interpolation in subjects/templates. */
export const TEMPLATE_VARS = [
  "tracking_number",
  "status",
  "recipient_name",
  "recipient_phone",
  "recipient_address",
  "sender_name",
  "sender_phone",
  "cod_amount",
  "shipping_cost",
  "declared_value",
] as const;

// ── API wrappers ──────────────────────────────────────────────────────────────

/** Per-channel readiness — drives the green/amber badges in the workflow builder. */
export async function getChannelsStatus(): Promise<ApiResponse<ChannelsStatus>> {
  return api<ChannelsStatus>("/notifications/channels-status");
}

/** Fetch the persisted workflow definition. May be empty (statuses: []) by default. */
export async function getWorkflow(): Promise<ApiResponse<WorkflowDefinition>> {
  return api<WorkflowDefinition>("/notifications/workflow");
}

/**
 * Read the workflow that governs manual status changes (per-status `transitions`,
 * `require_note`, `allowed_roles`, `allowed_users`). Alias of {@link getWorkflow}.
 */
export const getStatusWorkflow = getWorkflow;

/** Persist the workflow definition (admin only). */
export async function saveWorkflow(
  def: WorkflowDefinition,
): Promise<ApiResponse<WorkflowDefinition>> {
  return api<WorkflowDefinition>("/notifications/workflow", {
    method: "PUT",
    body: JSON.stringify(def),
  });
}

/** Paginated notification audit log (admin only). */
export async function getNotificationLogs(
  filters: NotificationLogFilters = {},
): Promise<ApiResponse<Paginated<NotificationLog>>> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.per_page) params.set("per_page", String(filters.per_page));
  const qs = params.toString();
  return api<Paginated<NotificationLog>>(`/notifications/logs${qs ? `?${qs}` : ""}`);
}
