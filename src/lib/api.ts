import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./config";

const API_BASE = API_BASE_URL;
const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

/*
 * Tokens are read from localStorage on every use, never cached in module variables.
 * auth-svc rotates the refresh token on each /auth/refresh and treats a second use of an
 * already-rotated token as theft: it revokes the whole token family. A tab holding a stale
 * copy (another tab had refreshed first) therefore logged the user out in every tab.
 */
export function setTokens(access: string | null, refresh: string | null) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  else localStorage.removeItem(ACCESS_KEY);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  else localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

/**
 * Another tab logged in, logged out or rotated the tokens (`storage` only fires in the other tabs).
 * `loggedIn` is whether a refresh token is still stored.
 */
export function subscribeTokenChanges(onChange: (loggedIn: boolean) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === REFRESH_KEY || e.key === null) onChange(!!getRefreshToken());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  // Let the browser set multipart boundary (APP-01-01 FormData cv_file)
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** A 401 from these means bad credentials or token, not an expired access token: never refresh. */
const NO_REFRESH = /\/auth\/(login|register|refresh|forgot-password|reset-password)$/;

let inflight: Promise<string> | null = null;

/** Web Lock shared by every tab of this origin; falls back to no lock where unsupported. */
function withRefreshLock(fn: () => Promise<string>): Promise<string> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  // lib.dom types the result as Promise<Promise<string>>; the browser flattens it to Promise<string>.
  return locks ? (locks.request("jp-auth-refresh", fn) as unknown as Promise<string>) : fn();
}

/**
 * One refresh at a time: single-flight inside the tab, Web Lock across tabs. Once the lock is
 * held, if the stored access token is no longer the one the failed request carried, another
 * tab (or an earlier call) already refreshed: use its token instead of spending the refresh
 * token a second time.
 */
function refreshAccessToken(sentAccess: string): Promise<string> {
  inflight ??= withRefreshLock(async () => {
    const access = getAccessToken();
    if (access && access !== sentAccess) return access;
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token");
    const res = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${API_BASE}/auth/refresh`,
      { refreshToken }
    );
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken;
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as RetryConfig | undefined;
    if (
      !original ||
      error.response?.status !== 401 ||
      original._retry ||
      NO_REFRESH.test(original.url ?? "") ||
      !getRefreshToken()
    ) {
      throw error;
    }
    original._retry = true;
    const sentAccess = String(original.headers?.Authorization ?? "").replace(/^Bearer /, "");
    let access: string;
    try {
      access = await refreshAccessToken(sentAccess);
    } catch (e) {
      // Only a rejected refresh token ends the session. A network error or a 5xx keeps the
      // tokens so the next request can try again, instead of logging the user out.
      const status = axios.isAxiosError(e) ? e.response?.status : 401;
      if (status !== undefined && status < 500) setTokens(null, null);
      throw error;
    }
    original.headers.Authorization = `Bearer ${access}`;
    return api(original);
  }
);


// Typed helpers — 2026 best practice: register returns 201 RegisterResponse(userId), not tokens
export async function register(payload: { email: string; password: string; fullName: string; role?: string; companyId?: string }) {
  const { data } = await api.post("/auth/register", payload);
  return data as { userId: string; message: string };
}
export async function login(payload: { email: string; password: string; rememberMe?: boolean }) {
  const { data } = await api.post("/auth/login", payload);
  return data as { accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string; role: string } };
}
export async function fetchMe() {
  const { data } = await api.get("/auth/me");
  return data as { id: string; email: string; fullName: string; role: string; isActive: boolean };
}
export async function logoutApi() {
  const rt = getRefreshToken();
  if (!rt) return;
  await api.post("/auth/logout", { refreshToken: rt });
}
export async function forgotPassword(email: string) {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data as { message: string };
}
export async function resetPassword(payload: { token: string; newPassword: string }) {
  const { data } = await api.post("/auth/reset-password", payload);
  return data as { message: string };
}
