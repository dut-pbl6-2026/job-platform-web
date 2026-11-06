/**
 * Where to send the user after login or register. The target comes from a query string (`?next=`) or from
 * router state (`state.from`, set by ProtectedRoute). Both are user-controllable, so only same-origin
 * paths are accepted: an absolute URL or `//host` would turn the login page into an open redirect.
 */

export const DEFAULT_AFTER_AUTH = "/jobs";

// Landing back on an auth page after signing in would loop, so these are never valid targets.
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

/** Returns `pathname + search + hash` when `raw` is a safe in-app path, otherwise null. */
export function safeInternalPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/")) return null;
  let url: URL;
  try {
    // The URL parser turns "/\\evil.com" and "//evil.com" into a different origin, which is what we reject.
    url = new URL(raw, "http://internal.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://internal.invalid") return null;
  if (AUTH_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `?next=` first (explicit link), then router state, then the default. */
export function resolveAfterAuth(search: string, state: unknown): string {
  const fromQuery = safeInternalPath(new URLSearchParams(search).get("next"));
  if (fromQuery) return fromQuery;
  const from = (state as { from?: unknown } | null)?.from;
  return safeInternalPath(from) ?? DEFAULT_AFTER_AUTH;
}

/** Query string that carries `target` to the next auth page; empty for the default so URLs stay clean. */
export function nextQuery(target: string): string {
  return target === DEFAULT_AFTER_AUTH ? "" : `?next=${encodeURIComponent(target)}`;
}

export function loginUrl(next: string): string {
  return `/login${nextQuery(next)}`;
}
