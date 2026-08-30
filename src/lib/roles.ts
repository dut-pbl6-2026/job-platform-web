// SRS ROLES-01: canonical roles User / Recruiter / Admin
// 'Employer' is deprecated alias for Recruiter (backward compat with early auth impl)
export type CanonicalRole = "User" | "Recruiter" | "Admin";

export function normalizeRole(raw?: string | null): CanonicalRole {
  const r = (raw || "").trim().toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "recruiter" || r === "employer") return "Recruiter";
  return "User";
}

export function isRecruiter(role?: string | null): boolean {
  return normalizeRole(role) === "Recruiter";
}
export function isUser(role?: string | null): boolean {
  return normalizeRole(role) === "User";
}
export function isAdmin(role?: string | null): boolean {
  return normalizeRole(role) === "Admin";
}

// For registration: map UI selection to canonical value sent to API
export function toApiRole(uiValue: string): string {
  // UI may still show 'Employer' option; map to 'Recruiter' for API
  return normalizeRole(uiValue);
}
