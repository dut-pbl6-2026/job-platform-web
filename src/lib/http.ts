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
