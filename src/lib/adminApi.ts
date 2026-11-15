import i18n from "../i18n";
import { api } from "./api";
import { unwrap, pickNum, pickStr, toOneBased, fromOneBased } from "./http";
import { normalizeJob } from "./jobsApi";
import { normalizeRole } from "./roles";
import type { AdminHealth, AdminStatistics, AdminUser, Paginated, PendingJob } from "../types/admin";

/**
 * auth-svc and job-svc admin lists return { data: [...], pagination: { page (1-based), pageSize, totalItems, totalPages } }.
 * Do not unwrap() first: an array `data` is an object too, and the items would be lost.
 */
function readPage(
  raw: unknown,
  page0: number,
  size: number,
): { items: unknown[]; page: number; size: number; total: number; totalPages: number } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items = (
    Array.isArray(r.items) ? r.items : Array.isArray(r.data) ? r.data : Array.isArray(raw) ? raw : []
  ) as unknown[];
  const meta = (r.pagination && typeof r.pagination === "object" ? r.pagination : r) as Record<string, unknown>;
  const s = pickNum(meta, "size", "pageSize") ?? size;
  const total = pickNum(meta, "total", "totalItems") ?? items.length;
  const totalPages = pickNum(meta, "totalPages") ?? (Math.ceil(total / s) || 1);
  return { items, page: fromOneBased(pickNum(meta, "page"), page0), size: s, total, totalPages };
}

/**
 * auth-svc UserDto. A row without id, role or isActive is not a user we can show: skip it rather than
 * invent an id, a role or an active status.
 */
function asUser(raw: unknown): AdminUser | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, "id");
  const role = pickStr(o, "role");
  if (!id || !role || typeof o.isActive !== "boolean") return null;
  return {
    id,
    email: pickStr(o, "email") ?? "",
    fullName: pickStr(o, "fullName") ?? "",
    role: normalizeRole(role),
    isActive: o.isActive,
    createdAt: pickStr(o, "createdAt") ?? "",
  };
}

/** Same adapter as search/job pages (normalizeJob), plus the admin-only recruiterName. */
function asJob(raw: unknown): PendingJob | null {
  if (!raw || typeof raw !== "object") return null;
  const job = normalizeJob(raw);
  if (!job.id) return null;
  return { ...job, recruiterName: pickStr(raw as Record<string, unknown>, "recruiterName", "recruiter_name") };
}

const STAT_SECTIONS = ["users", "jobs", "applications"] as const;

/** auth-svc GET /api/admin/stats → { users, jobs, applications }, each a StatsSection. */
export async function fetchAdminStatistics(): Promise<AdminStatistics> {
  const { data } = await api.get("/admin/stats");
  const body = (data ?? {}) as Record<string, unknown>;
  const sec = (key: string) => (body[key] && typeof body[key] === "object" ? body[key] : {}) as Record<string, unknown>;
  const ok = (key: string) => String(sec(key).status ?? "").toLowerCase() === "ok";
  const users = sec("users");
  const jobs = sec("jobs");
  const apps = sec("applications");
  const byRole = (users.byRole && typeof users.byRole === "object" ? users.byRole : {}) as Record<string, unknown>;
  return {
    totalUsers: pickNum(users, "total") ?? null,
    activeUsers: pickNum(users, "active") ?? null,
    newUsersThisMonth: pickNum(users, "newThisMonth") ?? null,
    totalRecruiters: pickNum(byRole, "Recruiter", "recruiter") ?? 0,
    totalJobSeekers: pickNum(byRole, "User", "user") ?? 0,
    totalJobs: pickNum(jobs, "total") ?? null,
    activeJobs: pickNum(jobs, "active") ?? null,
    pendingJobs: pickNum(jobs, "pending") ?? null,
    totalApplications: pickNum(apps, "total") ?? null,
    applicationStatus: ok("applications")
      ? {
          pending: pickNum(apps, "pending") ?? 0,
          accepted: pickNum(apps, "accepted") ?? 0,
          rejected: pickNum(apps, "rejected") ?? 0,
        }
      : null,
    unavailable: STAT_SECTIONS.filter((key) => !ok(key)),
  };
}

/** Gateway GET /api/health → { status, services: [{ name, status: "UP" | "DOWN", latencyMs }] }. */
export async function fetchAdminHealth(): Promise<AdminHealth> {
  const started = performance.now();
  const { data } = await api.get("/health");
  const gatewayMs = Math.round(performance.now() - started);
  const body = (data ?? {}) as Record<string, unknown>;
  const services = Array.isArray(body.services) ? body.services : [];
  return {
    services: [
      { name: "gateway", status: "online", latencyMs: gatewayMs },
      ...services.map((row) => {
        const o = row as Record<string, unknown>;
        const up = String(o.status ?? "").toUpperCase() === "UP";
        return {
          name: pickStr(o, "name") || "service",
          status: up ? ("online" as const) : ("offline" as const),
          latencyMs: up ? (pickNum(o, "latencyMs") ?? null) : null,
        };
      }),
    ],
  };
}

/** auth-svc GET /api/admin/users?search=&role=&isActive=&page(1-based)&size. */
export async function fetchAdminUsers(params: {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  size?: number;
}): Promise<Paginated<AdminUser>> {
  const page = params.page ?? 0;
  const size = params.size ?? 8;
  const { data } = await api.get("/admin/users", {
    params: {
      // api-conventions target is `q`; auth-svc only reads `search` today (D4).
      search: params.q?.trim() || undefined,
      role: params.role || undefined,
      isActive: params.status === "active" ? true : params.status === "inactive" ? false : undefined,
      page: toOneBased(page),
      size,
    },
  });
  const parsed = readPage(data, page, size);
  return { ...parsed, items: parsed.items.map(asUser).filter((x): x is AdminUser => !!x) };
}

/**
 * auth-svc PATCH /api/admin/users/{id}/activate | /deactivate { reason? }.
 * There is no endpoint to change a role, so the UI does not offer it.
 */
export async function setAdminUserActive(userId: string, isActive: boolean, reason?: string): Promise<void> {
  if (isActive) await api.patch(`/admin/users/${userId}/activate`);
  else await api.patch(`/admin/users/${userId}/deactivate`, { reason: reason?.trim() || undefined });
}

/** job-svc JobStatus values the admin list filters on. Omitting the status lists every job except Deleted. */
export const ADMIN_JOB_STATUSES = ["Active", "Pending", "Rejected", "Closed", "Deleted"] as const;
export type AdminJobStatus = (typeof ADMIN_JOB_STATUSES)[number];

export function isAdminJobStatus(value: string): value is AdminJobStatus {
  return (ADMIN_JOB_STATUSES as readonly string[]).includes(value);
}

/** job-svc GET /api/admin/jobs?status=&q=&page(1-based)&size. `q` matches the title, ignoring case. */
export async function fetchAdminJobs(params: {
  status?: AdminJobStatus | "";
  q?: string;
  page?: number;
  size?: number;
}): Promise<Paginated<PendingJob>> {
  const page = params.page ?? 0;
  const size = params.size ?? 8;
  const q = params.q?.trim() || undefined;
  const { data } = await api.get("/admin/jobs", {
    params: { status: params.status || undefined, q, page: toOneBased(page), size },
  });
  const parsed = readPage(data, page, size);
  return { ...parsed, items: parsed.items.map(asJob).filter((x): x is PendingJob => !!x) };
}

/** Body of POST /api/admin/jobs and PUT /api/admin/jobs/{id} (job-svc JobCreateDto / JobUpdateDto). */
export interface AdminJobInput {
  title: string;
  description: string;
  companyId: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  categoryId?: string;
  requirements?: string;
  benefits?: string;
  employmentType?: string;
  experienceLevel?: string;
}

/**
 * Field errors of a .NET ValidationProblem (400 { errors: { title: ["..."] } }), keyed by the
 * backend field name in camelCase. Empty when the response is not a validation problem.
 */
export function validationErrors(e: unknown): Record<string, string> {
  const errors = (e as { response?: { status?: number; data?: { errors?: unknown } } })?.response?.data?.errors;
  if (!errors || typeof errors !== "object") return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    const first = Array.isArray(messages) ? messages[0] : messages;
    if (typeof first === "string" && first) out[field.charAt(0).toLowerCase() + field.slice(1)] = first;
  }
  return out;
}

/** job-svc POST /api/admin/jobs → 201 { id, message }. An admin's job is published at once (Active). */
export async function createAdminJob(input: AdminJobInput): Promise<string> {
  const { data } = await api.post("/admin/jobs", input);
  return pickStr((data ?? {}) as Record<string, unknown>, "id") ?? "";
}

/** job-svc PUT /api/admin/jobs/{id}. 409 when the job is deleted: restore is not offered. */
export async function updateAdminJob(jobId: string, input: AdminJobInput): Promise<void> {
  await api.put(`/admin/jobs/${jobId}`, input);
}

/** job-svc DELETE /api/admin/jobs/{id}: soft delete. The job leaves the board but stays in the database. */
export async function softDeleteAdminJob(jobId: string): Promise<void> {
  await api.delete(`/admin/jobs/${jobId}`);
}

/** job-svc DELETE /api/admin/jobs/{id}/permanent: removes a soft-deleted job from the database (409 otherwise). */
export async function hardDeleteAdminJob(jobId: string): Promise<void> {
  await api.delete(`/admin/jobs/${jobId}/permanent`);
}

/**
 * job-svc GET /api/admin/jobs/{id}: full content of a job in any status. The list above only has
 * title/company/category, and the public GET /api/jobs/{id} hides Pending jobs (404), so this is
 * the only way for an admin to read a job before approving or rejecting it.
 */
export async function fetchAdminJob(jobId: string): Promise<PendingJob | null> {
  try {
    const { data } = await api.get(`/admin/jobs/${jobId}`);
    return asJob(data);
  } catch (e) {
    if ((e as { response?: { status?: number } })?.response?.status === 404) return null;
    throw e;
  }
}

/**
 * job-svc: approve and reject are separate endpoints. POST /approve { note? } always approves,
 * so a rejection must go to POST /reject { reason }, and reason is required there.
 */
export async function decideJob(jobId: string, approved: boolean, reason?: string): Promise<string> {
  const trimmed = reason?.trim() ?? "";
  if (!approved && !trimmed) throw new Error(i18n.t("admin.jobs.reasonRequiredApi"));
  const { data } = approved
    ? await api.post(`/admin/jobs/${jobId}/approve`, { note: trimmed || undefined })
    : await api.post(`/admin/jobs/${jobId}/reject`, { reason: trimmed });
  const body = unwrap<Record<string, unknown>>(data);
  return pickStr(body, "message") || (approved ? i18n.t("admin.jobs.approved") : i18n.t("admin.jobs.rejected"));
}
