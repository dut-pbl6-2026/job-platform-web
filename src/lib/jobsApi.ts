import { api } from "./api";
import type { FacetBucket, Job, JobSearchParams, PaginatedJobs, SearchFacets } from "../types/job";
import { MOCK_JOBS, MOCK_CATEGORIES } from "../mocks/jobsMock";
import { normalizeEmploymentType, normalizeExperienceLevel } from "../types/job";
import { splitCsv, locationMatches } from "./searchFilters";

function normalizeJob(raw: any): Job {
  if (!raw) return raw as Job;
  return {
    ...raw,
    employmentType: raw.employmentType ? normalizeEmploymentType(String(raw.employmentType)) : raw.employmentType,
    experienceLevel: raw.experienceLevel ? normalizeExperienceLevel(String(raw.experienceLevel)) : raw.experienceLevel,
    skills: Array.isArray(raw.skills) ? raw.skills.map(String) : raw.skills,
  } as Job;
}

function readFacets(raw: any): SearchFacets | undefined {
  const source = raw?.facets ?? raw?.Facets;
  if (!source || typeof source !== "object") return undefined;
  const buckets = (value: unknown): FacetBucket[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rec = item as Record<string, unknown>;
        const name = rec.value ?? rec.name ?? rec.key;
        const count = rec.count ?? rec.docCount ?? rec.doc_count;
        if (name == null || typeof count !== "number") return null;
        return { value: String(name), count };
      })
      .filter((item): item is FacetBucket => !!item);
  };
  return {
    location: buckets(source.location ?? source.Location),
    employmentType: buckets(source.employmentType ?? source.employment_type),
    experienceLevel: buckets(source.experienceLevel ?? source.experience_level),
    category: buckets(source.category ?? source.Category),
    skills: buckets(source.skills ?? source.Skills),
  };
}

function withFacets(page: PaginatedJobs, raw: any): PaginatedJobs {
  const facets = readFacets(raw);
  return facets ? { ...page, facets } : page;
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

function compactKey(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function matchesEmployment(jobValue: string, selected: string[]) {
  if (selected.length === 0) return true;
  const job = compactKey(jobValue);
  return selected.some((item) => {
    const want = compactKey(item);
    return job === want || job.includes(want) || want.includes(job);
  });
}

function matchesExperience(jobValue: string, selected: string[]) {
  if (selected.length === 0) return true;
  const job = compactKey(normalizeExperienceLevel(jobValue) || jobValue);
  return selected.some((item) => {
    const want = compactKey(item);
    if (job === want) return true;
    if ((want === "mid" || want === "middle") && (job === "mid" || job === "middle")) return true;
    if ((want === "entry" || want === "junior") && (job === "entry" || job === "junior")) return true;
    return false;
  });
}

function countFacets(jobs: Job[]): SearchFacets {
  const tally = (pick: (job: Job) => string[]) => {
    const map = new Map<string, number>();
    for (const job of jobs) {
      for (const value of pick(job)) {
        if (!value) continue;
        map.set(value, (map.get(value) ?? 0) + 1);
      }
    }
    return [...map.entries()].map(([value, count]) => ({ value, count }));
  };
  return {
    location: tally((job) => [job.location]),
    employmentType: tally((job) => [String(job.employmentType || "")]),
    experienceLevel: tally((job) => [String(job.experienceLevel || "")]),
    category: tally((job) => [job.category?.name || ""]),
    skills: tally((job) => job.skills ?? []),
  };
}

function mockSearch(params: JobSearchParams): PaginatedJobs {
  const q = (params.q || "").toLowerCase();
  const loc = (params.location || "").toLowerCase();
  const cat = (params.category || "").toLowerCase();
  const types = splitCsv(params.employmentType);
  const levels = splitCsv(params.experienceLevel);
  const skills = splitCsv(params.skills).map((item) => item.toLowerCase());
  let filtered = MOCK_JOBS.filter((j) => {
    const hitQ = !q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q) || j.company.name.toLowerCase().includes(q);
    const hitLoc = locationMatches(j.location, loc);
    const normalizedCat = normalizeJob(j).category.name.toLowerCase();
    const hitCat = !cat || normalizedCat === cat || j.categoryId.toLowerCase() === cat || j.category.name.toLowerCase() === cat;
    const hitType = matchesEmployment(String(j.employmentType || ""), types);
    const hitLevel = matchesExperience(String(j.experienceLevel || ""), levels);
    const jobSkills = (j.skills ?? []).map((item) => item.toLowerCase());
    const hitSkills = skills.length === 0 || (params.skillOp === "or"
      ? skills.some((skill) => jobSkills.some((item) => item.includes(skill)))
      : skills.every((skill) => jobSkills.some((item) => item.includes(skill))));
    const hitMin = params.minSalary == null || (j.salaryMax || j.salaryMin) >= params.minSalary;
    const hitMax = params.maxSalary == null || (j.salaryMin || j.salaryMax) <= params.maxSalary;
    const hitCurrency = !params.salaryCurrency || !j.salaryCurrency || j.salaryCurrency === params.salaryCurrency || params.salaryCurrency === "VND";
    return hitQ && hitLoc && hitCat && hitType && hitLevel && hitSkills && hitMin && hitMax && hitCurrency;
  });

  const sortBy = params.sortBy || "relevance";
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "salary_desc") return (b.salaryMax || 0) - (a.salaryMax || 0);
    if (sortBy === "salary_asc") return (a.salaryMin || 0) - (b.salaryMin || 0);
    if (sortBy === "created_at_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (q) return 0;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const page = Math.max(0, params.page ?? 0);
  const size = Math.min(100, Math.max(1, params.size ?? 10));
  const total = filtered.length;
  const totalPages = Math.ceil(total / size) || 1;
  const items = filtered.slice(page * size, page * size + size).map(normalizeJob);
  return { items, total, page, size, totalPages, facets: countFacets(filtered) };
}

function compactParams(params: JobSearchParams) {
  const next: Record<string, string | number> = {};
  if (params.q) next.q = params.q;
  if (params.location) next.location = params.location;
  if (params.category) next.category = params.category;
  if (params.employmentType) next.employmentType = params.employmentType;
  if (params.experienceLevel) next.experienceLevel = params.experienceLevel;
  if (params.minSalary != null) next.minSalary = params.minSalary;
  if (params.maxSalary != null) next.maxSalary = params.maxSalary;
  if (params.skills) next.skills = params.skills;
  if (params.skillOp && params.skillOp !== "and") next.skillOp = params.skillOp;
  if (params.sortBy && params.sortBy !== "relevance") next.sortBy = params.sortBy;
  next.page = params.page ?? 0;
  next.size = params.size ?? 20;
  return next;
}

function advancedParams(params: JobSearchParams) {
  const next: Record<string, string | number> = {
    page: params.page ?? 0,
    size: params.size ?? 20,
  };
  if (params.q) next.q = params.q;
  if (params.location) next.location = params.location;
  if (params.category) next.category = params.category;
  if (params.minSalary != null) next.salary_min = params.minSalary;
  if (params.maxSalary != null) next.salary_max = params.maxSalary;
  if (params.skills) next.skills = params.skills;
  if (params.employmentType) next.employment_type = params.employmentType;
  if (params.experienceLevel) next.experience_level = params.experienceLevel;
  if (params.sortBy && params.sortBy !== "relevance") next.sort = params.sortBy;
  return next;
}

function unwrapSearch(data: unknown, params: JobSearchParams): PaginatedJobs | null {
  const normalized = normalizePaginated(data, params);
  if (normalized) return withFacets(normalized, data);
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const items = Array.isArray(rec.items) ? rec.items.map(normalizeJob) : [];
    if (items.length || rec.total !== undefined) {
      return withFacets({
        items,
        total: typeof rec.total === "number" ? rec.total : items.length,
        page: typeof rec.page === "number" ? rec.page : params.page ?? 0,
        size: typeof rec.size === "number" ? rec.size : params.size ?? 10,
        totalPages: typeof rec.totalPages === "number" ? rec.totalPages : 1,
      }, data);
    }
  }
  return null;
}

let advancedAvailable: boolean | null = null;

export async function fetchJobs(params: JobSearchParams): Promise<PaginatedJobs> {
  if (advancedAvailable !== false) {
    try {
      const advanced = await api.get("/search/advanced", { params: advancedParams(params) });
      advancedAvailable = true;
      const page = unwrapSearch(advanced.data, params);
      if (page) return page;
    } catch {
      advancedAvailable = false;
    }
  }
  try {
    const { data } = await api.get("/search/jobs", { params: compactParams(params) });
    const page = unwrapSearch(data, params);
    if (page) return page;
    return data as PaginatedJobs;
  } catch {
    await new Promise((r) => setTimeout(r, 280));
    return mockSearch(params);
  }
}

export async function fetchSuggestions(q: string, limit = 8): Promise<string[]> {
  const keyword = q.trim();
  if (!keyword) return [];
  try {
    const { data } = await api.get("/search/suggest", { params: { q: keyword, limit } });
    // API returns a bare array; tolerate { items: [...] } envelope too.
    if (Array.isArray(data)) return data as string[];
    const items = (data as any)?.items;
    return Array.isArray(items) ? (items as string[]) : [];
  } catch {
    return [];
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

export type NamedCount = { id: string; name: string; count: number };

function unwrapNamed(data: unknown): NamedCount[] {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.items)
      ? (data as any).items
      : Array.isArray((data as any)?.data)
        ? (data as any).data
        : [];
  return rows
    .map((row: any, index: number) => {
      if (typeof row === "string") return { id: row, name: row, count: 0 };
      const name = String(row?.name ?? row?.value ?? row?.key ?? "");
      if (!name) return null;
      return { id: String(row?.id ?? name), name, count: Number(row?.count ?? 0) };
    })
    .filter(Boolean) as NamedCount[];
}

const MOCK_SKILLS = [...new Set(MOCK_JOBS.flatMap((job) => job.skills ?? []))];
const MOCK_LOCATIONS = [...new Set([...MOCK_JOBS.map((job) => job.location), "Remote"])];

export async function fetchSkills(q = ""): Promise<NamedCount[]> {
  const keyword = q.trim().toLowerCase();
  try {
    const { data } = await api.get("/search/skills", { params: keyword ? { q: keyword } : {} });
    const rows = unwrapNamed(data);
    if (rows.length) return rows;
  } catch { /* mock */ }
  const counts = new Map<string, number>();
  for (const job of MOCK_JOBS) for (const skill of job.skills ?? []) counts.set(skill, (counts.get(skill) ?? 0) + 1);
  return MOCK_SKILLS
    .filter((name) => !keyword || name.toLowerCase().includes(keyword))
    .map((name) => ({ id: name, name, count: counts.get(name) ?? 0 }));
}

export async function fetchLocations(q = ""): Promise<NamedCount[]> {
  const keyword = q.trim().toLowerCase();
  try {
    const { data } = await api.get("/search/locations", { params: keyword ? { q: keyword } : {} });
    const rows = unwrapNamed(data);
    if (rows.length) return rows;
  } catch { /* mock */ }
  const counts = new Map<string, number>();
  for (const job of MOCK_JOBS) counts.set(job.location, (counts.get(job.location) ?? 0) + 1);
  return MOCK_LOCATIONS
    .filter((name) => !keyword || name.toLowerCase().includes(keyword))
    .map((name) => ({ id: name, name, count: counts.get(name) ?? 0 }));
}

const COMPANY_PREFIX = /^(c[oô]ng ty|t[aậ]p [dđ]o[aà]n|doanh nghi[eệ]p|tnhh|cp|cổ phần|co\.?|ltd\.?|jsc)$/i;

export function companyInitials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  let rest = words;
  while (rest.length > 1) {
    const two = `${rest[0]} ${rest[1] ?? ""}`;
    if (COMPANY_PREFIX.test(two)) rest = rest.slice(2);
    else if (COMPANY_PREFIX.test(rest[0])) rest = rest.slice(1);
    else break;
  }
  const picked = rest.length ? rest : words;
  const letters = picked.length > 1 ? picked.slice(0, 2).map((w) => w[0]).join("") : picked[0].slice(0, 2);
  return letters.toUpperCase();
}

export function formatSalaryShort(min: number, max: number, currency = "VND") {
  if (!min && !max) return "Thỏa thuận";
  if (currency === "VND") {
    const a = min ? Math.round(min / 1_000_000) : null;
    const b = max ? Math.round(max / 1_000_000) : null;
    if (a && b) return `${a} - ${b} triệu`;
    return `${a || b} triệu`;
  }
  return formatSalary(min, max, currency);
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
