/**
 * API base URL — always go through the YARP gateway.
 *
 * Dev:  VITE_API_BASE_URL=/api  (Vite proxies /api; /ws/notifications is proxied separately)
 * Prod: VITE_API_BASE_URL=https://<gateway-host>/api
 */
export function resolveApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!raw) return "/api";
  return raw.replace(/\/+$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Offline demo data (localStorage mocks). Off unless VITE_ENABLE_MOCKS=true, so on staging/prod
 * a failing or mismatched API shows a real error instead of fake data (review #7).
 */
export const MOCKS_ENABLED = import.meta.env.VITE_ENABLE_MOCKS === "true";

/** SRS WS-01: realtime channel through the gateway. */
export const NOTIFICATION_WS_PATH = "/ws/notifications";

/** Week 5 toast: how often to look for newly posted jobs when the socket is quiet. */
export function jobToastPollMs(): number {
  const raw = Number(import.meta.env.VITE_JOB_TOAST_POLL_MS);
  if (Number.isFinite(raw) && raw >= 5000) return raw;
  return 30_000;
}

export const TOAST_DISMISS_MS = 8000;
export const WS_PING_MS = 25_000;
export const TOAST_STACK_LIMIT = 4;
