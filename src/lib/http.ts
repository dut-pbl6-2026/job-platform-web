import { isAxiosError } from "axios";
import { MOCKS_ENABLED } from "./config";

export function httpStatus(e: unknown): number | undefined {
  return (e as { status?: number; response?: { status?: number } })?.response?.status
    ?? (e as { status?: number })?.status;
}

/**
 * Whether a failed call may fall back to mock data: only with VITE_ENABLE_MOCKS=true, and only
 * when the backend is unreachable (no response) or failing (5xx). Never on 4xx: a 404 means the
 * URL or contract is wrong and must surface, not be hidden behind fake data.
 */
export function shouldUseMock(e: unknown, what: string): boolean {
  if (!MOCKS_ENABLED) return false;
  const status = httpStatus(e);
  const use = !status || status >= 500;
  if (use) console.warn(`[mock] ${what}: backend unavailable (${status ?? "no response"}), using mock data`);
  return use;
}

/**
 * Vietnamese message for a failed GET, naming what could not be loaded ("danh sách việc làm") and what the
 * failure was. The real cause stays visible (no mock, no silent fallback), just in the user's language.
 */
export function loadErrorMessage(e: unknown, what: string): string {
  const status = httpStatus(e);
  if (isAxiosError(e) && !e.response) {
    return `Không kết nối được máy chủ nên chưa tải được ${what}. Kiểm tra mạng rồi thử lại.`;
  }
  if (status && status >= 500) return `Máy chủ đang gặp sự cố (lỗi ${status}) nên chưa tải được ${what}. Vui lòng thử lại sau.`;
  if (status === 401 || status === 403) return `Bạn không có quyền xem ${what}. Hãy đăng nhập lại.`;
  if (status === 404) return `Không tìm thấy ${what}.`;
  if (status) return `Không tải được ${what} (lỗi ${status}).`;
  // Not an HTTP failure: most likely a bug or a contract change (e.g. normalizeJob throwing on a new
  // shape). React Query does not log query errors, so log it for whoever opens the console.
  console.error("[load]", what, e);
  return `Đã xảy ra lỗi khi tải ${what}.`;
}

/** Unwrap common API envelopes used across services. */
export function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "data" in (raw as object) && (raw as { data: unknown }).data != null) {
    const inner = (raw as { data: unknown }).data;
    if (typeof inner === "object") return inner as T;
  }
  return raw as T;
}

/**
 * The UI pages from 0 (like search-svc). app-svc and the auth/job admin APIs page from 1:
 * convert at the boundary until Phase 2 unifies on 0-based (api-conventions §5).
 */
export const toOneBased = (page0: number) => Math.max(0, page0) + 1;
export const fromOneBased = (page1: unknown, fallback0: number) =>
  typeof page1 === "number" && Number.isFinite(page1) ? Math.max(0, page1 - 1) : fallback0;

export function pickStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

export function pickNum(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

/**
 * Readable error text from an axios error: job-svc/app-svc send { message },
 * auth-svc/profile-svc/search-svc send ProblemDetails { title, detail }.
 */
export function apiErrorMessage(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === "object") {
    const msg = pickStr(data as Record<string, unknown>, "message", "detail", "title");
    if (msg) return msg;
  }
  return (e as { message?: string })?.message || fallback;
}
