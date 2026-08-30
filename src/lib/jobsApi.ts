import { api } from "./api";
import type { Job, JobSearchParams, PaginatedJobs } from "../types/job";
import { MOCK_JOBS, MOCK_CATEGORIES } from "../mocks/jobsMock";

function mockSearch(params: JobSearchParams): PaginatedJobs {
  const q = (params.q || "").toLowerCase();
  const loc = (params.location || "").toLowerCase();
  const cat = (params.category || "").toLowerCase();
  let filtered = MOCK_JOBS.filter((j) => {
    const hitQ = !q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q) || j.company.name.toLowerCase().includes(q);
    const hitLoc = !loc || j.location.toLowerCase().includes(loc);
    const hitCat = !cat || j.category.name.toLowerCase() === cat || j.categoryId === cat;
    return hitQ && hitLoc && hitCat;
  });
  // SRS SEARCH-01-04: size 1..100, default 20 server; client may choose 9 for 3-col grid
  const page = Math.max(0, params.page ?? 0);
  const size = Math.min(100, Math.max(1, params.size ?? 10));
  const total = filtered.length;
  const totalPages = Math.ceil(total / size);
  const items = filtered.slice(page * size, page * size + size);
  return { items, total, page, size, totalPages };
}

export async function fetchJobs(params: JobSearchParams): Promise<PaginatedJobs> {
  try {
    // Primary: Search Service via Gateway
    const { data } = await api.get("/search/jobs", { params });
    // Normalize: { items, total, page, size, totalPages } or { data: ... }
    if (data.items) return data as PaginatedJobs;
    if (Array.isArray(data)) return { items: data, total: data.length, page: params.page ?? 0, size: params.size ?? 10, totalPages: 1 };
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
    return data as Job;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_JOBS.find((j) => j.id === id) ?? null;
  }
}

export async function fetchCategories(): Promise<{ id: string; name: string }[]> {
  try {
    const { data } = await api.get("/categories");
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
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}
