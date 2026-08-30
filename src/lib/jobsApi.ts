import { api } from "./api";
import type { Job, JobSearchParams, PaginatedJobs } from "../types/job";
import { MOCK_JOBS, MOCK_CATEGORIES } from "../mocks/jobsMock";
import { normalizeEmploymentType, normalizeExperienceLevel } from "../types/job";

function normalizeJob(raw: any): Job {
  if (!raw) return raw as Job;
  return {
    ...raw,
    employmentType: raw.employmentType ? normalizeEmploymentType(String(raw.employmentType)) : raw.employmentType,
    experienceLevel: raw.experienceLevel ? normalizeExperienceLevel(String(raw.experienceLevel)) : raw.experienceLevel,
  } as Job;
}

function normalizePaginated(raw: any, fallbackParams: JobSearchParams): PaginatedJobs | null {
  if (!raw || typeof raw !== "object") return null;

  // Unwrap nested { data: ... } envelope (axios already unwraps one level, but API may wrap again)
  // Handle { data: { items: [...] } } or { data: [...] }
  if (raw.data && !raw.items && !Array.isArray(raw)) {
    // e.g. { data: { items, total } } or { data: [...] }
    const nested = normalizePaginated(raw.data, fallbackParams);
    if (nested) return nested;
    if (Array.isArray(raw.data)) {
      const items = (raw.data as any[]).map(normalizeJob);
      return { items, total: items.length, page: fallbackParams.page ?? 0, size: fallbackParams.size ?? 10, totalPages: 1 };
    }
  }

  // Spring-style { content: [...], totalElements, number, size, totalPages } or { content: [...] }
  if (Array.isArray(raw.content)) {
    const items = (raw.content as any[]).map(normalizeJob);
    const total = typeof raw.totalElements === "number" ? raw.totalElements : typeof raw.total === "number" ? raw.total : items.length;
    const page = typeof raw.number === "number" ? raw.number : typeof raw.page === "number" ? raw.page : fallbackParams.page ?? 0;
    const size = typeof raw.size === "number" ? raw.size : fallbackParams.size ?? 10;
    const totalPages = typeof raw.totalPages === "number" ? raw.totalPages : Math.ceil(total / size) || 1;
    return { items, total, page, size, totalPages };
  }

  // Standard { items: [...] }
  if (Array.isArray(raw.items)) {
    const items = (raw.items as any[]).map(normalizeJob);
    return {
      items,
      total: typeof raw.total === "number" ? raw.total : items.length,
      page: typeof raw.page === "number" ? raw.page : fallbackParams.page ?? 0,
      size: typeof raw.size === "number" ? raw.size : fallbackParams.size ?? 10,
      totalPages: typeof raw.totalPages === "number" ? raw.totalPages : Math.ceil((typeof raw.total === "number" ? raw.total : items.length) / (typeof raw.size === "number" ? raw.size : fallbackParams.size ?? 10)) || 1,
    };
  }

  // Plain array at top level
  if (Array.isArray(raw)) {
    const items = (raw as any[]).map(normalizeJob);
    return { items, total: items.length, page: fallbackParams.page ?? 0, size: fallbackParams.size ?? 10, totalPages: 1 };
  }

  // { data: [...] } where data is array (alternative envelope)
  if (Array.isArray(raw.data)) {
    const items = (raw.data as any[]).map(normalizeJob);
    return { items, total: items.length, page: fallbackParams.page ?? 0, size: fallbackParams.size ?? 10, totalPages: 1 };
  }

  return null;
}

function mockSearch(params: JobSearchParams): PaginatedJobs {
  const q = (params.q || "").toLowerCase();
  const loc = (params.location || "").toLowerCase();
  const cat = (params.category || "").toLowerCase();
  let filtered = MOCK_JOBS.filter((j) => {
    const hitQ = !q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q) || j.company.name.toLowerCase().includes(q);
    const hitLoc = !loc || j.location.toLowerCase().includes(loc);
    // Support filtering by category name OR id (mock uses lowercase name as id; real API uses UUID)
    const normalizedCat = normalizeJob(j).category.name.toLowerCase();
    const hitCat = !cat || normalizedCat === cat || j.categoryId.toLowerCase() === cat || j.category.name.toLowerCase() === cat;
    return hitQ && hitLoc && hitCat;
  });
  // SRS SEARCH-01-04: size 1..100, default 20 server; client may choose 9 for 3-col grid
  const page = Math.max(0, params.page ?? 0);
  const size = Math.min(100, Math.max(1, params.size ?? 10));
  const total = filtered.length;
  const totalPages = Math.ceil(total / size);
  const items = filtered.slice(page * size, page * size + size).map(normalizeJob);
  return { items, total, page, size, totalPages };
}

export async function fetchJobs(params: JobSearchParams): Promise<PaginatedJobs> {
  try {
    // Primary: Search Service via Gateway
    const { data } = await api.get("/search/jobs", { params });
    const normalized = normalizePaginated(data, params);
    if (normalized) return normalized;
    // Passthrough fallback: try to coerce items
    if (data && typeof data === "object") {
      const items = Array.isArray((data as any).items) ? (data as any).items.map(normalizeJob) : [];
      if (items.length || (data as any).total !== undefined) {
        return { items, total: (data as any).total ?? items.length, page: (data as any).page ?? params.page ?? 0, size: (data as any).size ?? params.size ?? 10, totalPages: (data as any).totalPages ?? 1 } as PaginatedJobs;
      }
    }
    return data as PaginatedJobs;
  } catch {
    // Fallback to mock (when job-svc/search-svc not yet deployed)
    await new Promise((r) => setTimeout(r, 280));
    return mockSearch(params);
  }
}

export async function fetchJobById(id: string): Promise<Job | null> {
  try {
    const { data } = await api.get(`/jobs/${id}`);
    // API may return { data: Job } envelope
    const raw = (data && typeof data === "object" && (data as any).data && !(data as any).title) ? (data as any).data : data;
    return normalizeJob(raw);
  } catch {
    await new Promise((r) => setTimeout(r, 200));
    const found = MOCK_JOBS.find((j) => j.id === id) ?? null;
    return found ? normalizeJob(found) : null;
  }
}

export async function fetchCategories(): Promise<{ id: string; name: string }[]> {
  try {
    const { data } = await api.get("/categories");
    // Normalize various envelopes: array, { data: [...] }, { items: [...] }, { content: [...] }
    if (Array.isArray(data)) return data as any;
    if (Array.isArray((data as any)?.data)) return (data as any).data as any;
    if (Array.isArray((data as any)?.items)) return (data as any).items as any;
    if (Array.isArray((data as any)?.content)) return (data as any).content as any;
    return data as any;
  } catch {
    return MOCK_CATEGORIES;
  }
}

export function formatSalary(min: number, max: number, currency = "VND") {
  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
  if (!min && !max) return "Thỏa thuận";
  if (min && max) return `${fmt(min)} - ${fmt(max)} ${currency}`;
  return `${fmt(min || max)} ${currency}`;
}

export function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 0) return "vừa xong";
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}
