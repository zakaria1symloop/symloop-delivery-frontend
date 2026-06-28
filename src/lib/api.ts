// NEXT_PUBLIC_API_URL is authoritative for BOTH client and SSR (e.g. the deployed
// NestJS backend at http://72.60.190.211:4000/api/v1), so the frontend talks to the
// live backend regardless of the host it's served from. When unset, fall back to the
// legacy LAN behaviour (same host on :8002) for a co-located dev backend.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8002/api`
    : "http://localhost:8002/api");

// Backend origin without the /api(/vN) suffix — for static uploads served at /storage/...
export const API_ORIGIN = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, "");

/** Absolute URL for an uploaded file the backend serves under /storage/<path>. */
export function fileUrl(path: string | null | undefined): string {
  if (!path) return "";
  return `${API_ORIGIN}/storage/${String(path).replace(/^\/+/, "")}`;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  user_type: "admin" | "operator" | "responsable" | "expediteur" | "chauffeur" | "transit_chauffeur";
  status: string;
  /** Per-expéditeur programmatic API access. Absent (legacy cached users) is treated as enabled. */
  api_enabled?: boolean;
  stop_desk_id: number | null;
  wilaya_id?: number | null;
  company_name?: string | null;
  stop_desk?: {
    id: number; name: string; code: string | null; type: string;
    commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
  } | null;
}

/** Returns true if user is locked to their assigned SD (operators/responsables) */
export function isSDLocked(user: User | null): boolean {
  if (!user) return false;
  return (user.user_type === "operator" || user.user_type === "responsable") && !!user.stop_desk_id;
}

/** Get the locked SD id, or null if not locked */
export function getLockedSDId(user: User | null): number | null {
  if (!user || !isSDLocked(user)) return null;
  return user.stop_desk_id;
}

export interface AuthData {
  user: User;
  token: string;
  token_type: string;
  redirect: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setAuth(token: string, user: User) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie = "token=; path=/; max-age=0";
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

/**
 * Fire-and-forget error reporting to the backend log file (POST /logs/client).
 * Never throws, never blocks, and never reports against its own endpoint so it
 * cannot create an infinite logging loop.
 */
export function reportClientError(payload: {
  message: string;
  url?: string;
  status?: number;
  stack?: string;
}) {
  try {
    if (typeof window === "undefined") return;
    const token = getToken();
    void fetch(`${API_BASE_URL}/logs/client`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // reporting must never break the caller
  }
}

export async function api<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  // For FormData bodies, let the browser set Content-Type (with the multipart
  // boundary) — forcing application/json breaks file uploads.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    const status = res.status;
    const data = (await res.json()) as ApiResponse<T>;
    // Report any error (HTTP not ok OR body says success:false). Never report
    // the reporter's own endpoint — that would loop forever.
    if (endpoint !== "/logs/client" && (!res.ok || data?.success === false)) {
      reportClientError({
        message: data?.message || `HTTP ${status}`,
        url: endpoint,
        status,
      });
    }
    return data;
  } catch {
    // Network/parse failure: report it (unless this *is* the reporter call).
    if (endpoint !== "/logs/client") {
      reportClientError({ message: "Server connection error", url: endpoint, status: 0 });
    }
    return { success: false, message: "Server connection error" };
  }
}

export async function login(
  email: string,
  password: string
): Promise<ApiResponse<AuthData>> {
  return api<AuthData>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<ApiResponse> {
  const res = await api("/auth/logout", { method: "POST" });
  clearAuth();
  return res;
}

export async function me(): Promise<ApiResponse<{ user: User; redirect: string }>> {
  return api("/auth/me");
}
