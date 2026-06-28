import { api, type ApiResponse } from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Role {
  id: number;
  name: string;
  description: string | null;
  pages: string[];
  permissions: string[];
  users_count: number;
}

/** A page that a role can be granted access to (route href as key). */
export interface RegistryPage {
  key: string;
  label: string;
  group: string;
}

/** A fine-grained permission a role can be granted. */
export interface RegistryPermission {
  key: string;
  label: string;
  description: string;
}

export interface RolesRegistry {
  pages: RegistryPage[];
  permissions: RegistryPermission[];
}

/**
 * The current user's effective access.
 * `pages` / `permissions` === null means NO restriction (admins and users
 * without a custom role) — the UI should behave exactly as before.
 */
export interface MyAccess {
  is_admin: boolean;
  role_id: number | null;
  role_name: string | null;
  pages: string[] | null;
  permissions: string[] | null;
}

export interface CreateRolePayload {
  name: string;
  description?: string | null;
  pages?: string[];
  permissions?: string[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string | null;
  pages?: string[];
  permissions?: string[];
}

// ── API wrappers ──────────────────────────────────────────────────────────────

/** List all roles with their pages, permissions and user counts. */
export const getRoles = (): Promise<ApiResponse<Role[]>> => api<Role[]>("/roles");

/** Fetch a single role by id. */
export const getRole = (id: number): Promise<ApiResponse<Role>> =>
  api<Role>(`/roles/${id}`);

/** Create a new role. */
export const createRole = (data: CreateRolePayload): Promise<ApiResponse<Role>> =>
  api<Role>("/roles", { method: "POST", body: JSON.stringify(data) });

/** Update an existing role. */
export const updateRole = (
  id: number,
  data: UpdateRolePayload,
): Promise<ApiResponse<Role>> =>
  api<Role>(`/roles/${id}`, { method: "PUT", body: JSON.stringify(data) });

/** Delete a role. */
export const deleteRole = (id: number): Promise<ApiResponse> =>
  api(`/roles/${id}`, { method: "DELETE" });

/**
 * Assign (or unassign) a role to a user.
 * Pass `role_id = null` (or 0) to remove the user's custom role.
 */
export const assignRole = (
  user_id: number,
  role_id: number | null,
): Promise<ApiResponse> =>
  api("/roles/assign", {
    method: "POST",
    body: JSON.stringify({ user_id, role_id }),
  });

/** Fetch the registry of grantable pages (grouped) and permissions. */
export const getRolesRegistry = (): Promise<ApiResponse<RolesRegistry>> =>
  api<RolesRegistry>("/roles/registry");

/** Fetch the current user's effective access (pages/permissions or null). */
export const getMyAccess = (): Promise<ApiResponse<MyAccess>> =>
  api<MyAccess>("/roles/my-access");
