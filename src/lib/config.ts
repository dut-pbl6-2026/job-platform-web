/**
 * API base URL — always go through the YARP gateway.
 *
 * Dev:  VITE_API_BASE_URL=/api  (Vite proxies → VITE_GATEWAY_URL, default http://localhost:5000)
 * Prod: VITE_API_BASE_URL=https://jp-gateway.onrender.com/api
 */
export function resolveApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!raw) return "/api";
  return raw.replace(/\/+$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl();
