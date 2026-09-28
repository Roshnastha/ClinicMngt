/**
 * API client with automatic Bearer token injection, single-retry refresh
 * on 401, and global sign-out when the session is unrecoverable.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const TOKEN_KEYS = {
  access: "pd_access_token",
  refresh: "pd_refresh_token",
  user: "pd_user",
} as const;

export interface ApiUser {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: "ADMIN" | "STAFF";
  is_active: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// --- token helpers (localStorage; SSR-safe) -------------------------------

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEYS.access);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEYS.refresh);
}

export function setTokens(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEYS.access, access);
  window.localStorage.setItem(TOKEN_KEYS.refresh, refresh);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEYS.access);
  window.localStorage.removeItem(TOKEN_KEYS.refresh);
  window.localStorage.removeItem(TOKEN_KEYS.user);
}

// --- core request ----------------------------------------------------------

let onUnauthorized: (() => void) | null = null;

/** Register the global 401 handler (wired to AuthProvider in layout.tsx). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
  body?: BodyInit;
  /** Skip the Authorization header (login, refresh). */
  skipAuth?: boolean;
  /** Skip the redirect to /login on unrecoverable 401s (login page). */
  skipRedirect?: boolean;
}

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, skipAuth, skipRedirect, ...fetchOpts } = opts;
  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string>),
  };

  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(json);
  }

  const token = getAccessToken();
  if (token && !skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // Session recovery: try one silent refresh, then replay the request.
  if (res.status === 401 && !skipAuth && !skipRedirect && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...opts, skipAuth: false });
    }
    // Refresh failed – session is dead.
    clearTokens();
    if (!skipRedirect && onUnauthorized) onUnauthorized();
  }

  const bodyText = await res.text().catch(() => "");
  throw new ApiError(res.status, bodyText || `API ${res.status}`);
}

/** Exchange the refresh token for a fresh token pair. Returns success. */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
    };
    setTokens(data.access_token, data.refresh_token || refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T = unknown>(path: string, opts?: RequestOptions) => request<T>(path, opts),
  post: <T = unknown>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "POST", json }),
  put: <T = unknown>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PUT", json }),
  patch: <T = unknown>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PATCH", json }),
  delete: <T = unknown>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
