import { api } from "./api";
import { unwrap, pickStr, pickNum } from "./http";
import { MOCK_JOBS } from "../mocks/jobsMock";
import type { Application, ApplicationStatus, PaginatedApplications, StatusHistoryEntry } from "../types/application";
import { APPLICATION_STATUSES } from "../types/application";

const STORE_KEY = "jp.mock.applications";
export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isAllowedCv(file: File): boolean {
  const name = file.name.toLowerCase();
  const okExt = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");
  const okMime = !file.type || /pdf|msword|officedocument\.wordprocessingml/.test(file.type);
  return okExt && okMime;
}

export function validateCvFile(file: File | null): string | null {
  if (!file) return "Hãy chọn file CV";
  if (!isAllowedCv(file)) return "Chỉ nhận PDF, DOC hoặc DOCX";
  if (file.size > CV_MAX_BYTES) return "File tối đa 5 MB";
  return null;
}

function loadStore(): Application[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Application[]) : [];
  } catch {
    return [];
  }
}

function saveStore(items: Application[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}

function asStatus(raw: unknown): ApplicationStatus {
  const s = String(raw || "pending").toLowerCase();
  return (APPLICATION_STATUSES as string[]).includes(s) ? (s as ApplicationStatus) : "pending";
}

function normalizeHistory(raw: unknown): StatusHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, "id", "Id") || crypto.randomUUID();
  const applicationId = pickStr(o, "applicationId", "application_id") || "";
  const changedAt = pickStr(o, "changedAt", "changed_at") || new Date().toISOString();
  return {
    id,
    applicationId,
    status: asStatus(o.status),
    note: pickStr(o, "note") ?? null,
    changedBy: pickStr(o, "changedBy", "changed_by") ?? null,
    changedAt,
  };
}

export function normalizeApplication(raw: unknown): Application {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const job = (o.job && typeof o.job === "object" ? o.job : null) as Record<string, unknown> | null;
  const company = (job?.company && typeof job.company === "object" ? job.company : o.company) as Record<string, unknown> | undefined;
  const histRaw = o.statusHistory ?? o.status_history;
  const statusHistory = Array.isArray(histRaw)
    ? histRaw.map(normalizeHistory).filter((x): x is StatusHistoryEntry => !!x)
    : undefined;
  return {
    id: pickStr(o, "id") || "",
    jobId: pickStr(o, "jobId", "job_id") || (job ? pickStr(job, "id") : "") || "",
    jobTitle: pickStr(o, "jobTitle", "job_title") || (job ? pickStr(job, "title") : undefined),
    companyName: pickStr(o, "companyName", "company_name") || (company ? pickStr(company, "name") : undefined),
    location: pickStr(o, "location") || (job ? pickStr(job, "location") : undefined),
    applicantId: pickStr(o, "applicantId", "applicant_id") || "",
    coverLetter: pickStr(o, "coverLetter", "cover_letter") ?? null,
    cvUrl: pickStr(o, "cvUrl", "cv_url") ?? null,
    cvFileName: pickStr(o, "cvFileName", "cv_file_name") ?? null,
    status: asStatus(o.status),
    recruiterNotes: pickStr(o, "recruiterNotes", "recruiter_notes") ?? null,
    score: pickNum(o, "score") ?? null,
    createdAt: pickStr(o, "createdAt", "created_at") || new Date().toISOString(),
    updatedAt: pickStr(o, "updatedAt", "updated_at") || pickStr(o, "createdAt", "created_at") || new Date().toISOString(),
    statusHistory,
  };
}

function paginate(items: Application[], page: number, size: number): PaginatedApplications {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size) || 1);
  const p = Math.max(0, page);
  const s = Math.min(100, Math.max(1, size));
  return { items: items.slice(p * s, p * s + s), total, page: p, size: s, totalPages };
}

function mockList(userId: string, status?: string, page = 0, size = 10): PaginatedApplications {
  let items = loadStore().filter((a) => a.applicantId === userId);
  if (status) items = items.filter((a) => a.status === status);
  items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return paginate(items, page, size);
}

function enrichFromJobs(app: Application): Application {
  if (app.jobTitle && app.companyName) return app;
  const job = MOCK_JOBS.find((j) => j.id === app.jobId);
  if (!job) return app;
  return { ...app, jobTitle: app.jobTitle || job.title, companyName: app.companyName || job.company.name, location: app.location || job.location };
}

export async function submitApplication(payload: {
  jobId: string;
  coverLetter?: string;
  cvFile: File;
  applicantId: string;
}): Promise<{ id: string; message: string }> {
  const form = new FormData();
  form.append("job_id", payload.jobId);
  form.append("jobId", payload.jobId);
  if (payload.coverLetter) {
    form.append("cover_letter", payload.coverLetter);
    form.append("coverLetter", payload.coverLetter);
  }
  form.append("cv_file", payload.cvFile);
  form.append("cvFile", payload.cvFile);
  try {
    const { data } = await api.post("/applications", form);
    const body = unwrap<Record<string, unknown>>(data);
    const id = pickStr(body, "id") || "";
    const message = pickStr(body, "message") || "Đã gửi hồ sơ";
    return { id, message };
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 409) throw e;
    if (status && status !== 404 && status < 500) throw e;
    const existing = loadStore();
    if (existing.some((a) => a.applicantId === payload.applicantId && a.jobId === payload.jobId)) {
      const err = Object.assign(new Error("Đã ứng tuyển tin này"), { response: { status: 409, data: { message: "Bạn đã ứng tuyển tin này rồi" } } });
      throw err;
    }
    const now = new Date().toISOString();
    const job = MOCK_JOBS.find((j) => j.id === payload.jobId);
    const app: Application = {
      id: crypto.randomUUID(),
      jobId: payload.jobId,
      jobTitle: job?.title,
      companyName: job?.company.name,
      location: job?.location,
      applicantId: payload.applicantId,
      coverLetter: payload.coverLetter || null,
      cvUrl: URL.createObjectURL(payload.cvFile),
      cvFileName: payload.cvFile.name,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      statusHistory: [{ id: crypto.randomUUID(), applicationId: "", status: "pending", note: "Đã gửi hồ sơ", changedAt: now }],
    };
    app.statusHistory![0].applicationId = app.id;
    saveStore([app, ...existing]);
    await new Promise((r) => setTimeout(r, 350));
    return { id: app.id, message: "Đã gửi hồ sơ (chế độ tạm, chưa có app-svc)" };
  }
}

export async function fetchMyApplications(params: { status?: string; page?: number; size?: number; userId: string }): Promise<PaginatedApplications> {
  const page = params.page ?? 0;
  const size = params.size ?? 10;
  try {
    const { data } = await api.get("/applications/me", { params: { status: params.status || undefined, page, size } });
    const raw = unwrap<Record<string, unknown>>(data);
    const itemsRaw = (Array.isArray(raw.items) ? raw.items : Array.isArray(raw.content) ? raw.content : Array.isArray(data) ? data : []) as unknown[];
    const items = itemsRaw.map(normalizeApplication).map(enrichFromJobs);
    const total = typeof raw.total === "number" ? raw.total : typeof raw.totalElements === "number" ? raw.totalElements : items.length;
    const totalPages = typeof raw.totalPages === "number" ? raw.totalPages : Math.ceil(total / size) || 1;
    return { items, total, page: typeof raw.page === "number" ? raw.page : page, size: typeof raw.size === "number" ? raw.size : size, totalPages };
  } catch {
    await new Promise((r) => setTimeout(r, 200));
    const res = mockList(params.userId, params.status, page, size);
    return { ...res, items: res.items.map(enrichFromJobs) };
  }
}

export async function fetchApplicationById(id: string, userId: string): Promise<Application | null> {
  try {
    const { data } = await api.get(`/applications/${id}`);
    return enrichFromJobs(normalizeApplication(unwrap(data)));
  } catch {
    await new Promise((r) => setTimeout(r, 180));
    const found = loadStore().find((a) => a.id === id && a.applicantId === userId) ?? null;
    return found ? enrichFromJobs(found) : null;
  }
}
