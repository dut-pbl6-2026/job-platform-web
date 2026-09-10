/** Unwrap common API envelopes used across services. */
export function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "data" in (raw as object) && (raw as { data: unknown }).data != null) {
    const inner = (raw as { data: unknown }).data;
    if (typeof inner === "object") return inner as T;
  }
  return raw as T;
}

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
