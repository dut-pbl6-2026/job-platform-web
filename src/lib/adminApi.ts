import { api } from "./api";
import { unwrap, pickNum, pickStr, toOneBased, fromOneBased, shouldUseMock } from "./http";
import { MOCK_JOBS } from "../mocks/jobsMock";
import { normalizeRole } from "./roles";
import type { AdminHealth, AdminStatistics, AdminUser, Paginated, PendingJob } from "../types/admin";
import type { Job } from "../types/job";

const USERS_KEY = "jp.mock.admin.users";
const JOBS_KEY = "jp.mock.admin.jobs";

const isOffline = (e: unknown) => shouldUseMock(e, "admin API");

function paginate<T>(items: T[], page: number, size: number): Paginated<T> {
  const total = items.length;
  const s = Math.min(100, Math.max(1, size));
  const p = Math.max(0, page);
  const totalPages = Math.max(1, Math.ceil(total / s) || 1);
  return { items: items.slice(p * s, p * s + s), total, page: p, size: s, totalPages };
}

/**
 * auth-svc and job-svc admin lists return { data: [...], pagination: { page (1-based), pageSize, totalItems, totalPages } }.
 * Do not unwrap() first: an array `data` is an object too, and the items would be lost.
 */
function readPage(raw: unknown, page0: number, size: number): { items: unknown[]; page: number; size: number; total: number; totalPages: number } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : Array.isArray(r.data) ? r.data : Array.isArray(raw) ? raw : []) as unknown[];
  const meta = (r.pagination && typeof r.pagination === "object" ? r.pagination : r) as Record<string, unknown>;
  const s = pickNum(meta, "size", "pageSize") ?? size;
  const total = pickNum(meta, "total", "totalItems") ?? items.length;
  const totalPages = pickNum(meta, "totalPages") ?? (Math.ceil(total / s) || 1);
  return { items, page: fromOneBased(pickNum(meta, "page"), page0), size: s, total, totalPages };
}

function seedUsers(): AdminUser[] {
  const now = Date.now();
  const rows: Array<[string, string, AdminUser["role"], boolean]> = [
    ["Lan Nguyen", "lan@example.com", "User", true],
    ["Minh Tran", "minh@example.com", "Recruiter", true],
    ["Hoa Pham", "hoa@example.com", "User", true],
    ["Khoa Le", "khoa@example.com", "Recruiter", false],
    ["An Do", "an@example.com", "User", true],
    ["Chi Bao", "bao@example.com", "Admin", true],
    ["Thanh Vu", "thanh@example.com", "User", true],
    ["Hoai Nguyen", "hoai@example.com", "Recruiter", true],
  ];
  return rows.map(([fullName, email, role, isActive], i) => ({
    id: `mock-user-${i + 1}`,
    email,
    fullName,
    role,
    isActive,
    createdAt: new Date(now - i * 86400000 * 3).toISOString(),
  }));
}

function loadUsers(): AdminUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as AdminUser[];
  } catch { /* ignore */ }
  const users = seedUsers();
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users;
}

function saveUsers(users: AdminUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function seedJobs(): PendingJob[] {
  return MOCK_JOBS.slice(0, 8).map((job, i) => ({
    ...job,
    id: `pending-${job.id}`,
    status: "pending",
    recruiterName: ["Minh Tran", "Hoai Nguyen", "Khoa Le"][i % 3],
    recruiterId: `mock-user-${(i % 3) + 2}`,
  }));
}

function loadJobs(): PendingJob[] {
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (raw) return JSON.parse(raw) as PendingJob[];
  } catch { /* ignore */ }
  const jobs = seedJobs();
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  return jobs;
}

function saveJobs(jobs: PendingJob[]) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

function asUser(raw: unknown): AdminUser | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const role = normalizeRole(pickStr(o, "role"));
  return {
    id: pickStr(o, "id", "userId", "user_id") || crypto.randomUUID(),
    email: pickStr(o, "email") || "",
    fullName: pickStr(o, "fullName", "full_name") || "",
    role,
    isActive: typeof o.isActive === "boolean" ? o.isActive : true,
    createdAt: pickStr(o, "createdAt", "created_at") || new Date().toISOString(),
  };
}

function asJob(raw: unknown): PendingJob | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const companyRaw = (o.company && typeof o.company === "object" ? o.company : {}) as Record<string, unknown>;
  const categoryRaw = (o.category && typeof o.category === "object" ? o.category : {}) as Record<string, unknown>;
  const id = pickStr(o, "id") || "";
  if (!id) return null;
  const job = {
    id,
    title: pickStr(o, "title") || "Tin tuyển dụng",
    description: pickStr(o, "description") || "",
    requirements: pickStr(o, "requirements") ?? null,
    benefits: pickStr(o, "benefits") ?? null,
    company: { id: pickStr(companyRaw, "id") || pickStr(o, "companyId", "company_id") || "", name: pickStr(companyRaw, "name") || pickStr(o, "companyName", "company_name") || "—" },
    companyId: pickStr(o, "companyId", "company_id") || pickStr(companyRaw, "id") || "",
    location: pickStr(o, "location") || "",
    salaryMin: pickNum(o, "salaryMin", "salary_min") ?? 0,
    salaryMax: pickNum(o, "salaryMax", "salary_max") ?? 0,
    salaryCurrency: pickStr(o, "salaryCurrency", "salary_currency") || "VND",
    category: { id: pickStr(categoryRaw, "id") || "", name: pickStr(categoryRaw, "name") || pickStr(o, "categoryName", "category_name") || "—" },
    categoryId: pickStr(o, "categoryId", "category_id") || "",
    employmentType: (pickStr(o, "employmentType", "employment_type") || "Full-time") as Job["employmentType"],
    experienceLevel: (pickStr(o, "experienceLevel", "experience_level") || "Junior") as Job["experienceLevel"],
    status: "pending",
    viewCount: pickNum(o, "viewCount", "view_count") ?? 0,
    createdAt: pickStr(o, "createdAt", "created_at") || new Date().toISOString(),
    updatedAt: pickStr(o, "updatedAt", "updated_at") || new Date().toISOString(),
    recruiterId: pickStr(o, "recruiterId", "recruiter_id"),
    recruiterName: pickStr(o, "recruiterName", "recruiter_name"),
  } as PendingJob;
  return job;
}

function mockStats(): AdminStatistics {
  const users = loadUsers();
  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
    newUsersThisMonth: 2,
    totalRecruiters: users.filter((u) => u.role === "Recruiter").length,
    totalJobSeekers: users.filter((u) => u.role === "User").length,
    totalJobs: MOCK_JOBS.length,
    activeJobs: MOCK_JOBS.length,
    pendingJobs: loadJobs().length,
    totalApplications: 24,
    applicationStatus: { pending: 10, accepted: 5, rejected: 3 },
    unavailable: [],
  };
}

const STAT_SECTIONS = ["users", "jobs", "applications"] as const;

/** auth-svc GET /api/admin/stats → { users, jobs, applications }, each a StatsSection. */
export async function fetchAdminStatistics(): Promise<AdminStatistics> {
  try {
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
        ? { pending: pickNum(apps, "pending") ?? 0, accepted: pickNum(apps, "accepted") ?? 0, rejected: pickNum(apps, "rejected") ?? 0 }
        : null,
      unavailable: STAT_SECTIONS.filter((key) => !ok(key)),
    };
  } catch (e) {
    if (!isOffline(e)) throw e;
    return mockStats();
  }
}

/** Gateway GET /api/health → { status, services: [{ name, status: "UP" | "DOWN", latencyMs }] }. */
export async function fetchAdminHealth(): Promise<AdminHealth> {
  try {
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
            latencyMs: up ? pickNum(o, "latencyMs") ?? null : null,
          };
        }),
      ],
    };
  } catch (e) {
    if (!isOffline(e)) throw e;
    return {
      services: [
        { name: "gateway", status: "offline", latencyMs: null },
        { name: "auth", status: "offline", latencyMs: null },
        { name: "job", status: "offline", latencyMs: null },
      ],
    };
  }
}

/** auth-svc GET /api/admin/users?search=&role=&isActive=&page(1-based)&size. */
export async function fetchAdminUsers(params: { q?: string; role?: string; status?: string; page?: number; size?: number }): Promise<Paginated<AdminUser>> {
  const page = params.page ?? 0;
  const size = params.size ?? 8;
  try {
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
  } catch (e) {
    if (!isOffline(e)) throw e;
    let items = loadUsers();
    const q = (params.q || "").trim().toLowerCase();
    if (q) items = items.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    if (params.role) items = items.filter((u) => u.role === params.role);
    if (params.status === "active") items = items.filter((u) => u.isActive);
    if (params.status === "inactive") items = items.filter((u) => !u.isActive);
    return paginate(items, page, size);
  }
}

/**
 * auth-svc PATCH /api/admin/users/{id}/activate | /deactivate { reason? }.
 * There is no endpoint to change a role, so the UI does not offer it.
 */
export async function setAdminUserActive(userId: string, isActive: boolean, reason?: string): Promise<void> {
  try {
    if (isActive) await api.patch(`/admin/users/${userId}/activate`);
    else await api.patch(`/admin/users/${userId}/deactivate`, { reason: reason?.trim() || undefined });
  } catch (e) {
    if (!isOffline(e)) throw e;
    saveUsers(loadUsers().map((u) => (u.id === userId ? { ...u, isActive } : u)));
  }
}

/** job-svc GET /api/admin/jobs?status=Pending&page(1-based)&size. */
export async function fetchPendingJobs(params: { page?: number; size?: number }): Promise<Paginated<PendingJob>> {
  const page = params.page ?? 0;
  const size = params.size ?? 8;
  try {
    const { data } = await api.get("/admin/jobs", { params: { status: "Pending", page: toOneBased(page), size } });
    const parsed = readPage(data, page, size);
    return { ...parsed, items: parsed.items.map(asJob).filter((x): x is PendingJob => !!x) };
  } catch (e) {
    if (!isOffline(e)) throw e;
    return paginate(loadJobs(), page, size);
  }
}

/**
 * job-svc: approve and reject are separate endpoints. POST /approve { note? } always approves,
 * so a rejection must go to POST /reject { reason }, and reason is required there.
 */
export async function decideJob(jobId: string, approved: boolean, reason?: string): Promise<string> {
  const trimmed = reason?.trim() ?? "";
  if (!approved && !trimmed) throw new Error("Cần nhập lý do từ chối");
  try {
    const { data } = approved
      ? await api.post(`/admin/jobs/${jobId}/approve`, { note: trimmed || undefined })
      : await api.post(`/admin/jobs/${jobId}/reject`, { reason: trimmed });
    const body = unwrap<Record<string, unknown>>(data);
    return pickStr(body, "message") || (approved ? "Đã duyệt tin" : "Đã từ chối tin");
  } catch (e) {
    if (!isOffline(e)) throw e;
    saveJobs(loadJobs().filter((j) => j.id !== jobId));
    return approved ? "Đã duyệt tin (chế độ tạm)" : "Đã từ chối tin (chế độ tạm)";
  }
}
