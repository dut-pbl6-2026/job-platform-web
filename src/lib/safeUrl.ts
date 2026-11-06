/**
 * URLs typed by users (company website, logo) are stored as-is: job-svc only checks their length.
 * React 18 renders `href="javascript:..."` (it only warns in dev), so a recruiter could store a
 * script link that runs in the viewer's session. Render only http(s); a bare "abc.vn" becomes https.
 */
export function safeHttpUrl(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
