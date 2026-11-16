import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
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

/** Refresh retries on 429 (per-IP rate limit): at most this many calls in total, each waiting at most the cap. */
const REFRESH_MAX_ATTEMPTS = 3;
const REFRESH_MAX_BACKOFF_MS = 5_000;

/** Retry-After (seconds) when the server sends one, otherwise 1s, 2s, ... always capped. */
function refreshBackoffMs(res: AxiosResponse | undefined, attempt: number): number {
  const header = res?.headers?.["retry-after"];
  const seconds = typeof header === "string" ? Number(header) : Number.NaN;
  const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 1000 * 2 ** (attempt - 1);
  return Math.min(delay, REFRESH_MAX_BACKOFF_MS);
}

/**
 * POST /auth/refresh. A 429 is retried after a bounded backoff: the rate limiter rejects the call
 * before the token family is touched, so the refresh token is still valid for the next attempt.
 */
async function postRefresh(refreshToken: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await axios.post<{ accessToken: string; refreshToken: string }>(`${API_BASE}/auth/refresh`, {
        refreshToken,
      });
    } catch (e) {
      if (!axios.isAxiosError(e) || e.response?.status !== 429 || attempt >= REFRESH_MAX_ATTEMPTS) throw e;
      await new Promise((resolve) => setTimeout(resolve, refreshBackoffMs(e.response, attempt)));
    }
  }
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
    const res = await postRefresh(refreshToken);
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
      // Only a rejected refresh (401/403) ends the session. A 429, a 5xx or a network error keeps
      // the tokens for a later attempt. The refresh error is thrown in that case, not the original
      // 401, so callers such as AuthContext do not read it as a logout.
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      if (!axios.isAxiosError(e) || status === 401 || status === 403) {
        setTokens(null, null);
        throw error;
      }
      throw e;
    }
    original.headers.Authorization = `Bearer ${access}`;
    return api(original);
  },
);

// Typed helpers. Registration answers 202 with { message } only: no tokens and no user id, because the
// account must be verified by email before it can log in.
export async function register(payload: {
  email: string;
  password: string;
  fullName: string;
  role?: string;
  inviteCode?: string;
}) {
  const { data } = await api.post("/auth/register", payload);
  return data as { message: string };
}
/**
 * Company self-serve sign-up (SRS AUTH-01-10). Anonymous, and the server answers 202 with one fixed
 * message for every business outcome (new sign-up, existing email, taken name or tax code, or a
 * domain that routes to a join request), so the client never learns which case applied. 422 is a
 * free public email domain; 503 means a job-svc lookup failed and nothing was stored.
 */
export async function registerCompany(payload: {
  companyName: string;
  taxCode?: string;
  email: string;
  password: string;
  fullName: string;
}) {
  const { data } = await api.post("/auth/register-company", payload);
  return data as { message: string };
}
export async function verifyEmail(token: string) {
  const { data } = await api.post("/auth/verify-email", { token });
  return data as { message: string };
}
/** Always 202 for any address, so the body is not read. 429 when the IP is rate limited. */
export async function resendVerification(email: string) {
  await api.post("/auth/resend-verification", { email });
}
export async function login(payload: { email: string; password: string; rememberMe?: boolean }) {
  const { data } = await api.post("/auth/login", payload);
  return data as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; fullName: string; role: string };
  };
}
export async function fetchMe() {
  const { data } = await api.get("/auth/me");
  return data as {
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
    companyId?: string | null;
  };
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
