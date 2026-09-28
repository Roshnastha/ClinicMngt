/**
 * Lightweight API client for the PhysioDesk backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  json?: unknown;
}

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, ...fetchOpts } = opts;
  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string>),
  };
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(json);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path),
  post: <T = unknown>(path: string, json: unknown) => request<T>(path, { method: "POST", json }),
  put: <T = unknown>(path: string, json: unknown) => request<T>(path, { method: "PUT", json }),
  patch: <T = unknown>(path: string, json: unknown) => request<T>(path, { method: "PATCH", json }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }),
};
