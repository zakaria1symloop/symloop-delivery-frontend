import { api, type ApiResponse } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

/** Brief author embedded on each log row (null for system / deleted users). */
export interface ActivityLogUser {
  id: number;
  first_name: string;
  last_name: string;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  subject_type: string | null;
  subject_id: number | null;
  description: string | null;
  ip: string | null;
  /** ISO timestamp (nullable — the column has no DB default). */
  created_at: string | null;
  user: ActivityLogUser | null;
}

/** Laravel-style paginated envelope returned inside `ApiResponse.data`. */
export interface PaginatedActivity {
  data: ActivityLog[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ActivityLogFilters {
  user_id?: number | string | null;
  action?: string;
  subject_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

// ── API wrappers ──────────────────────────────────────────────────────────────

/** GET /activity-logs — admin only, filterable + paginated (newest first). */
export function getActivityLogs(
  filters: ActivityLogFilters = {},
): Promise<ApiResponse<PaginatedActivity>> {
  const q = new URLSearchParams();
  if (filters.user_id != null && String(filters.user_id).trim() !== "")
    q.set("user_id", String(filters.user_id));
  if (filters.action) q.set("action", filters.action);
  if (filters.subject_type) q.set("subject_type", filters.subject_type);
  if (filters.date_from) q.set("date_from", filters.date_from);
  if (filters.date_to) q.set("date_to", filters.date_to);
  if (filters.search) q.set("search", filters.search);
  if (filters.page) q.set("page", String(filters.page));
  if (filters.per_page) q.set("per_page", String(filters.per_page));
  const qs = q.toString();
  return api<PaginatedActivity>(`/activity-logs${qs ? `?${qs}` : ""}`);
}

/** GET /activity-logs/user/:userId — one user's trail (admin, or that user). */
export function getUserActivity(
  userId: number | string,
  page = 1,
  perPage = 20,
): Promise<ApiResponse<PaginatedActivity>> {
  const q = new URLSearchParams();
  if (page) q.set("page", String(page));
  if (perPage) q.set("per_page", String(perPage));
  const qs = q.toString();
  return api<PaginatedActivity>(
    `/activity-logs/user/${encodeURIComponent(String(userId))}${qs ? `?${qs}` : ""}`,
  );
}

// ── Display helpers ────────────────────────────────────────────────────────────

/** Render `created_at` as a readable fr-DZ date-time, or "—" when missing. */
export function formatActivityDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Author label — full name, then `#id`, then "Système". */
export function activityUserName(log: Pick<ActivityLog, "user" | "user_id">): string {
  if (log.user) {
    const name = `${log.user.first_name ?? ""} ${log.user.last_name ?? ""}`.trim();
    if (name) return name;
  }
  return log.user_id != null ? `#${log.user_id}` : "Système";
}

/** Accent color for an action keyword (create/update/delete/auth → default orange). */
export function activityActionColor(action: string): string {
  const a = (action || "").toLowerCase();
  if (/(creat|ajout|\badd\b|nouveau)/.test(a)) return "#22c55e";
  if (/(updat|edit|modif|chang)/.test(a)) return "#f59e0b";
  if (/(delet|suppr|remov)/.test(a)) return "#ef4444";
  if (/(login|connex|auth)/.test(a)) return "#3b82f6";
  if (/(logout|deconnex)/.test(a)) return "#6b7280";
  return "#f97316";
}
