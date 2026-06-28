import { api, API_BASE_URL, type ApiResponse } from "./api";
import { getUsers, type StaffUser } from "./users";

// ── Enums (mirror backend create-reclamation.dto.ts) ──────────────────────────
export const RECLAMATION_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const RECLAMATION_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
// Réclamation categories. `colis` links a package; the others are package-less.
export const RECLAMATION_TYPES = ["colis", "general", "paiement", "ramassage", "autre"] as const;

export type ReclamationStatus = (typeof RECLAMATION_STATUSES)[number];
export type ReclamationPriority = (typeof RECLAMATION_PRIORITIES)[number];
export type ReclamationType = (typeof RECLAMATION_TYPES)[number];

// Display labels for the réclamation `type` (list badges, filters, selects). The
// authoritative list comes from GET /reclamations/types; this is a static
// fallback that also covers any value the backend hasn't relabelled.
export const RECLAMATION_TYPE_LABELS: Record<string, string> = {
  colis: "Colis",
  general: "Général",
  paiement: "Paiement",
  ramassage: "Ramassage",
  autre: "Autre",
};

// ── Shared brief shapes ───────────────────────────────────────────────────────
export interface UserBrief {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface PackageBrief {
  id: number;
  tracking_number: string;
  status: string;
  recipient_name: string;
}

// SLA clock metrics computed by the backend. `time_to_solve_minutes` is set for
// resolved/closed tickets (resolution duration); `age_minutes` is set for
// open/in_progress tickets (how long they've been open).
export interface ReclamationSla {
  time_to_solve_minutes: number | null;
  age_minutes: number | null;
  resolved: boolean;
}

// Users eligible to be assigned a réclamation (admins + roles granted the
// `handle_reclamations` permission). Returned by GET /reclamations/assignees.
export interface ReclamationAssignee {
  id: number;
  first_name: string;
  last_name: string;
  user_type: string;
  role_name: string | null;
}

export interface ReclamationNote {
  id: number;
  reclamation_id: number;
  user_id: number;
  body: string;
  created_at: string | null;
  user: UserBrief | null;
}

export interface ReclamationAttachment {
  id: number;
  reclamation_id: number;
  file_path: string;
  file_name: string;
  mime: string | null;
  size: number | null;
  uploaded_by: number;
  created_at: string | null;
  uploaded_by_user?: UserBrief | null;
}

// Brief SD shape — the réclamation now carries a stop_desk_id; the backend may
// surface a {id,name} brief, otherwise the page resolves the name from /stop-desks.
export interface StopDeskBrief {
  id: number;
  name: string;
}

// ── List row ──────────────────────────────────────────────────────────────────
export interface ReclamationListItem {
  id: number;
  type: ReclamationType;
  package_id: number | null;
  subject: string;
  description: string;
  status: ReclamationStatus;
  priority: ReclamationPriority;
  assigned_to: number | null;
  stop_desk_id: number | null;
  created_by: number;
  created_at: string | null;
  updated_at: string | null;
  package: PackageBrief | null;
  assignee: UserBrief | null;
  creator: UserBrief | null;
  stop_desk?: StopDeskBrief | null;
  notes_count: number;
  attachments_count: number;
  sla?: ReclamationSla;
}

// ── Detail (adds notes[] + attachments[]) ─────────────────────────────────────
// Inherits `sla` (and all other shared fields) from ReclamationListItem.
export interface ReclamationDetail
  extends Omit<ReclamationListItem, "notes_count" | "attachments_count"> {
  notes: ReclamationNote[];
  attachments: ReclamationAttachment[];
  sla?: ReclamationSla;
}

export interface PaginatedReclamations {
  data: ReclamationListItem[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ReclamationFilters {
  status?: string;
  type?: string;
  priority?: string;
  assigned_to?: number | string;
  package_id?: number | string;
  stop_desk_id?: number | string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

// ── CRUD + actions ────────────────────────────────────────────────────────────
export const getReclamations = (
  f: ReclamationFilters = {},
): Promise<ApiResponse<PaginatedReclamations>> => {
  const q = new URLSearchParams();
  if (f.status) q.set("status", String(f.status));
  if (f.type) q.set("type", String(f.type));
  if (f.priority) q.set("priority", String(f.priority));
  if (f.assigned_to != null && f.assigned_to !== "") q.set("assigned_to", String(f.assigned_to));
  if (f.package_id != null && f.package_id !== "") q.set("package_id", String(f.package_id));
  if (f.stop_desk_id != null && f.stop_desk_id !== "") q.set("stop_desk_id", String(f.stop_desk_id));
  if (f.date_from) q.set("date_from", f.date_from);
  if (f.date_to) q.set("date_to", f.date_to);
  if (f.search) q.set("search", f.search);
  if (f.page) q.set("page", String(f.page));
  if (f.per_page) q.set("per_page", String(f.per_page));
  const qs = q.toString();
  return api(`/reclamations${qs ? `?${qs}` : ""}`);
};

export const getReclamation = (id: number): Promise<ApiResponse<ReclamationDetail>> =>
  api(`/reclamations/${id}`);

// The backend's `status` filter is single-value (equality). For status-board
// views that span two statuses (e.g. Actives = open+in_progress, Historique =
// resolved+closed) we fetch each status and merge client-side. A generous cap
// keeps this bounded; active boards never approach it, and admins can pick a
// single concrete status for exact server-side pagination on large groups.
const MULTI_STATUS_FETCH_CAP = 500;

export async function getReclamationsMultiStatus(
  statuses: string[],
  f: Omit<ReclamationFilters, "status" | "page" | "per_page"> = {},
  page = 1,
  perPage = 20,
): Promise<PaginatedReclamations> {
  const results = await Promise.all(
    statuses.map((s) =>
      getReclamations({ ...f, status: s, page: 1, per_page: MULTI_STATUS_FETCH_CAP }),
    ),
  );
  const all: ReclamationListItem[] = [];
  for (const r of results) if (r.success && r.data) all.push(...r.data.data);
  all.sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
  const total = all.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), lastPage);
  const start = (safePage - 1) * perPage;
  return {
    data: all.slice(start, start + perPage),
    current_page: safePage,
    last_page: lastPage,
    per_page: perPage,
    total,
  };
}

// Role-gated assignee list: admins + users whose role carries the
// `handle_reclamations` permission. Used by the detail drawer's Assigner select.
export const getReclamationAssignees = (): Promise<ApiResponse<ReclamationAssignee[]>> =>
  api("/reclamations/assignees");

export const createReclamation = (data: {
  type?: ReclamationType;
  package_id?: number | null;
  subject: string;
  description: string;
  priority?: ReclamationPriority;
}): Promise<ApiResponse<ReclamationDetail>> =>
  api("/reclamations", { method: "POST", body: JSON.stringify(data) });

// Réclamation categories for the create form's Type selector. Returns
// [{key,label}] (colis/general/paiement/ramassage/autre).
export const getReclamationTypes = (): Promise<ApiResponse<{ key: string; label: string }[]>> =>
  api("/reclamations/types");

export const updateReclamation = (
  id: number,
  data: {
    subject?: string;
    description?: string;
    status?: ReclamationStatus;
    priority?: ReclamationPriority;
    assigned_to?: number | null;
  },
): Promise<ApiResponse<ReclamationDetail>> =>
  api(`/reclamations/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteReclamation = (id: number): Promise<ApiResponse> =>
  api(`/reclamations/${id}`, { method: "DELETE" });

export const setReclamationStatus = (
  id: number,
  status: ReclamationStatus,
): Promise<ApiResponse<ReclamationDetail>> =>
  api(`/reclamations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });

// Reopen a resolved/closed réclamation (admin-only server-side: the backend
// allows resolved/closed → 'open' for admins and 403s everyone else).
export const reopenReclamation = (id: number): Promise<ApiResponse<ReclamationDetail>> =>
  setReclamationStatus(id, "open");

export const assignReclamation = (
  id: number,
  user_id: number | null,
): Promise<ApiResponse<ReclamationDetail>> =>
  api(`/reclamations/${id}/assign`, { method: "POST", body: JSON.stringify({ user_id }) });

export const addReclamationNote = (
  id: number,
  body: string,
): Promise<ApiResponse<ReclamationNote>> =>
  api(`/reclamations/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) });

export const getReclamationNotes = (id: number): Promise<ApiResponse<ReclamationNote[]>> =>
  api(`/reclamations/${id}/notes`);

/**
 * Multipart upload. Mirrors src/lib/users.ts: build a FormData and pass it as the
 * body WITHOUT a manual Content-Type header so the browser can set the multipart
 * boundary itself. Field name is `files` (FilesInterceptor('files', …)).
 */
export const uploadReclamationAttachments = (
  id: number,
  files: File[],
): Promise<ApiResponse<ReclamationAttachment[]>> => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return api(`/reclamations/${id}/attachments`, { method: "POST", body: fd });
};

export const getReclamationAttachments = (
  id: number,
): Promise<ApiResponse<ReclamationAttachment[]>> => api(`/reclamations/${id}/attachments`);

export const deleteReclamationAttachment = (attId: number): Promise<ApiResponse> =>
  api(`/reclamations/attachments/${attId}`, { method: "DELETE" });

// ── Helpers ───────────────────────────────────────────────────────────────────

// API_BASE_URL ends with the API prefix (e.g. /api or /api/v1); strip it to get
// the bare backend origin for static (uploaded) files.
const API_ORIGIN = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, "");

/**
 * Build a download/view URL for an uploaded attachment. Files are stored under
 * the backend's storage/app/public, exposed (Laravel-parity) at /storage/<path>.
 * `file_path` already includes the folder, e.g. "reclamation-attachments/ab12.pdf",
 * mirroring how the users module links documents via /storage/<path>.
 */
export const attachmentUrl = (filePath: string): string => `${API_ORIGIN}/storage/${filePath}`;

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// Staff who can be assigned a ticket. `type` accepts a single user_type, so we
// fetch each staff role and merge (unique by id).
const STAFF_TYPES = ["admin", "operator", "responsable"] as const;

export async function getAssignableUsers(): Promise<StaffUser[]> {
  const results = await Promise.all(STAFF_TYPES.map((tp) => getUsers({ type: tp })));
  const seen = new Set<number>();
  const merged: StaffUser[] = [];
  for (const r of results) {
    if (r.success && r.data) {
      for (const u of r.data) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          merged.push(u);
        }
      }
    }
  }
  return merged.sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
  );
}

// Resolve a typed package reference (tracking number, or numeric id) to a
// package_id for linking on create. Returns null when nothing matches.
export interface PackageSearchResult {
  id: number;
  tracking_number: string;
  status?: string;
}

export async function resolvePackageRef(ref: string): Promise<number | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed); // plain numeric id
  const res = await api<{ data: PackageSearchResult[] }>(
    `/packages?search=${encodeURIComponent(trimmed)}&per_page=5`,
  );
  const rows = res.success && res.data ? res.data.data : [];
  if (!rows || rows.length === 0) return null;
  const exact = rows.find((p) => p.tracking_number?.toLowerCase() === trimmed.toLowerCase());
  return (exact ?? rows[0]).id;
}
