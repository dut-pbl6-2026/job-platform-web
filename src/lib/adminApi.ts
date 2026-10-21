import { api } from "./api";
import { unwrap, pickNum, pickStr } from "./http";
import { MOCK_JOBS } from "../mocks/jobsMock";
import { normalizeRole } from "./roles";
import type { AdminHealth, AdminPeriod, AdminStatistics, AdminUser, Paginated, PendingJob } from "../types/admin";
import type { Job } from "../types/job";

const USERS_KEY = "jp.mock.admin.users";
const JOBS_KEY = "jp.mock.admin.jobs";

function isOffline(e: unknown): boolean {
  const status = (e as { response?: { status?: number } })?.response?.status;
  return !status || status === 404 || status >= 500;
}

function paginate<T>(items: T[], page: number, size: number): Paginated<T> {
  const total = items.length;
  const s = Math.min(100, Math.max(1, size));
  const p = Math.max(0, page);
  const totalPages = Math.max(1, Math.ceil(total / s) || 1);
  return { items: items.slice(p * s, p * s + s), total, page: p, size: s, totalPages };
}

function readPage(raw: unknown, page: number, size: number): { items: unknown[]; page: number; size: number; total: number; totalPages: number } {
  const body = unwrap<Record<string, unknown>>(raw);
  const items = (Array.isArray(body.items) ? body.items : Array.isArray(body.content) ? body.content : Array.isArray(raw) ? raw : []) as unknown[];
  const total = pickNum(body, "total", "totalElements") ?? items.length;
  const p = pickNum(body, "page", "number") ?? page;
  const s = pickNum(body, "size") ?? size;
  const totalPages = pickNum(body, "totalPages") ?? (Math.ceil(total / s) || 1);
  return { items, page: p, size: s, total, totalPages };
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
    isActive: Boolean(o.isActive ?? o.is_active ?? true),
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

function mockStats(period: AdminPeriod): AdminStatistics {
  const users = loadUsers();
  const jobs = loadJobs();
  const buckets = period === "daily" ? 7 : period === "weekly" ? 4 : 6;
  const series = Array.from({ length: buckets }, (_, i) => ({
    label: period === "monthly" ? `T${i + 1}` : period === "weekly" ? `Tuần ${i + 1}` : `Ngày ${i + 1}`,
    users: 2 + ((i * 3) % 5),
    jobs: 1 + (i % 4),
    applications: 4 + ((i * 5) % 9),
  }));
  const byCat = new Map<string, number>();
  for (const job of jobs) byCat.set(job.category.name, (byCat.get(job.category.name) || 0) + 1);
  return {
    period,
    totalUsers: users.length,
    totalRecruiters: users.filter((u) => u.role === "Recruiter").length,
    totalJobSeekers: users.filter((u) => u.role === "User").length,
    totalJobs: MOCK_JOBS.length,
    totalApplications: 24,
    pendingJobs: jobs.length,
    series,
    categories: [...byCat.entries()].map(([name, count]) => ({ name, count })),
    applicationStatus: { pending: 10, reviewed: 6, accepted: 5, rejected: 3 },
  };
}

export async function fetchAdminStatistics(period: AdminPeriod): Promise<AdminStatistics> {
  try {
    const { data } = await api.get("/admin/statistics", { params: { period } });
    const body = unwrap<Record<string, unknown>>(data);
    const totals = (body.totals && typeof body.totals === "object" ? body.totals : body) as Record<string, unknown>;
    const seriesRaw = Array.isArray(body.series) ? body.series : [];
    const catsRaw = Array.isArray(body.categories) ? body.categories : [];
    const status = (body.applicationStatus ?? body.application_status ?? {}) as Record<string, unknown>;
    return {
      period,
      totalUsers: pickNum(totals, "totalUsers", "users", "total_users") ?? 0,
      totalRecruiters: pickNum(totals, "totalRecruiters", "recruiters", "total_recruiters") ?? 0,
      totalJobSeekers: pickNum(totals, "totalJobSeekers", "jobSeekers", "job_seekers") ?? 0,
      totalJobs: pickNum(totals, "totalJobs", "jobs", "total_jobs") ?? 0,
      totalApplications: pickNum(totals, "totalApplications", "applications", "total_applications") ?? 0,
      pendingJobs: pickNum(totals, "pendingJobs", "pending_jobs") ?? 0,
      series: seriesRaw.map((row) => {
        const o = row as Record<string, unknown>;
        return {
          label: pickStr(o, "label", "date") || "",
          users: pickNum(o, "users", "newUsers", "new_users") ?? 0,
          jobs: pickNum(o, "jobs") ?? 0,
          applications: pickNum(o, "applications") ?? 0,
        };
      }),
      categories: catsRaw.map((row) => {
        const o = row as Record<string, unknown>;
        return { name: pickStr(o, "name") || "—", count: pickNum(o, "count") ?? 0 };
      }),
      applicationStatus: {
        pending: pickNum(status, "pending") ?? 0,
        reviewed: pickNum(status, "reviewed") ?? 0,
        accepted: pickNum(status, "accepted") ?? 0,
        rejected: pickNum(status, "rejected") ?? 0,
      },
    };
  } catch (e) {
    if (!isOffline(e)) throw e;
    return mockStats(period);
  }
}

export async function fetchAdminHealth(): Promise<AdminHealth> {
  try {
    const { data } = await api.get("/admin/health");
    const body = unwrap<Record<string, unknown>>(data);
    const services = Array.isArray(body.services) ? body.services : [];
    return {
      services: services.map((row) => {
        const o = row as Record<string, unknown>;
        const status = String(o.status || "offline").toLowerCase() === "online" ? "online" : "offline";
        return { name: pickStr(o, "name") || "service", status, latencyMs: pickNum(o, "latencyMs", "latency_ms") ?? null };
      }),
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

export async function fetchAdminUsers(params: { q?: string; role?: string; status?: string; page?: number; size?: number }): Promise<Paginated<AdminUser>> {
  const page = params.page ?? 0;
  const size = params.size ?? 8;
  try {
    const { data } = await api.get("/admin/users", { params: { q: params.q || undefined, role: params.role || undefined, status: params.status || undefined, page, size } });
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

export async function updateAdminUser(userId: string, payload: { role?: string; isActive?: boolean }): Promise<void> {
  try {
    await api.put(`/admin/users/${userId}`, { role: payload.role, isActive: payload.isActive, is_active: payload.isActive });
  } catch (e) {
    if (!isOffline(e)) throw e;
    const users = loadUsers().map((u) => u.id === userId ? { ...u, role: payload.role ? normalizeRole(payload.role) : u.role, isActive: payload.isActive ?? u.isActive } : u);
    saveUsers(users);
  }
}

export async function fetchPendingJobs(params: { page?: number; size?: number }): Promise<Paginated<PendingJob>> {
  const page = params.page ?? 0;
  const size = params.size ?? 8;
  try {
    const { data } = await api.get("/admin/jobs/pending", { params: { page, size } });
    const parsed = readPage(data, page, size);
    return { ...parsed, items: parsed.items.map(asJob).filter((x): x is PendingJob => !!x) };
  } catch (e) {
    if (!isOffline(e)) throw e;
    return paginate(loadJobs(), page, size);
  }
}

export async function decideJob(jobId: string, approved: boolean, reason?: string): Promise<string> {
  try {
    const { data } = await api.post(`/admin/jobs/${jobId}/approve`, { approved, reason: reason || undefined });
    const body = unwrap<Record<string, unknown>>(data);
    return pickStr(body, "message") || (approved ? "Đã duyệt tin" : "Đã từ chối tin");
  } catch (e) {
    if (!isOffline(e)) throw e;
    saveJobs(loadJobs().filter((j) => j.id !== jobId));
    return approved ? "Đã duyệt tin (chế độ tạm)" : "Đã từ chối tin (chế độ tạm)";
  }
}
