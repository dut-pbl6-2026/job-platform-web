import { api } from "./api";
import type { Job, JobSearchParams, PaginatedJobs, SearchFacets } from "../types/job";
import { MOCK_JOBS, MOCK_CATEGORIES } from "../mocks/jobsMock";
import { normalizeEmploymentType, normalizeExperienceLevel } from "../types/job";
import { splitCsv, locationMatches } from "./searchFilters";
import { pickNum, pickStr, shouldUseMock, httpStatus } from "./http";
import i18n from "../i18n";
import { categoryLabel } from "./labels";

/**
 * job-svc (JobDetailDto, and the lists built from it) and search-svc both return camelCase, flat job fields
 * (`companyName`, `categoryName`), so `normalizeJob` reads them directly. The one exception is `currency`
 * in search-svc, which `fromSearchDocument` maps to `salaryCurrency` before calling `normalizeJob`.
 */
export function normalizeJob(raw: object): Job {
  const o = raw as Record<string, unknown>;
  const s = (key: string) => pickStr(o, key);
  const n = (key: string) => pickNum(o, key);
  const companyId = s("companyId") ?? "";
  const categoryId = s("categoryId") ?? "";
  const employment = s("employmentType");
  const experience = s("experienceLevel");
  return {
    ...o,
    id: String(o.id ?? ""),
    title: s("title") ?? "",
    description: s("description") ?? "",
    location: s("location") ?? "",
    requirements: s("requirements") ?? null,
    benefits: s("benefits") ?? null,
    companyId,
    company: { id: companyId, name: s("companyName") ?? "—" },
    categoryId,
    category: { id: categoryId, name: s("categoryName") ?? "" },
    salaryMin: n("salaryMin") ?? 0,
    salaryMax: n("salaryMax") ?? 0,
    salaryCurrency: s("salaryCurrency") ?? "VND",
    employmentType: employment ? normalizeEmploymentType(employment) : undefined,
    experienceLevel: experience ? normalizeExperienceLevel(experience) : undefined,
    status: (s("status") ?? "active").toLowerCase(),
    viewCount: n("viewCount") ?? 0,
    recruiterId: s("recruiterId"),
    createdAt: s("createdAt") ?? "",
    updatedAt: s("updatedAt") ?? "",
    skills: Array.isArray(o.skills) ? o.skills.map(String) : [],
  } as Job;
}

/** search-svc job item (camelCase) → the job-svc keys that `normalizeJob` reads. */
function fromSearchDocument(doc: unknown): Job {
  const d = doc as Record<string, unknown>;
  return normalizeJob({
    id: d.id,
    title: d.title,
    description: d.description,
    location: d.location,
    companyId: d.companyId,
    companyName: d.companyName,
    salaryMin: d.salaryMin,
    salaryMax: d.salaryMax,
    salaryCurrency: d.currency,
    categoryId: d.categoryId,
    categoryName: d.categoryName,
    employmentType: d.employmentType,
    experienceLevel: d.experienceLevel,
    status: d.status,
    recruiterId: d.recruiterId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    requirements: d.requirements,
    benefits: d.benefits,
    skills: d.skills,
  });
}

/** Mock catalogue entries nest `company` and `category`; flatten them into the job-svc keys first. */
function fromMockCatalogue(job: Job): Job {
  return normalizeJob({
    ...job,
    companyId: job.company.id,
    companyName: job.company.name,
    categoryId: job.category.id,
    categoryName: job.category.name,
  });
}

/** search-svc GET /api/search/jobs answers { items, total, page, size, totalPages, message? }; pages from 0. */
function toSearchPage(data: unknown, params: JobSearchParams): PaginatedJobs {
  const body = (data ?? {}) as Record<string, unknown>;
  const items = Array.isArray(body.items) ? body.items.map(fromSearchDocument) : [];
  const total = pickNum(body, "total") ?? items.length;
  const size = pickNum(body, "size") ?? params.size ?? 10;
  return {
    items,
    total,
    page: pickNum(body, "page") ?? params.page ?? 0,
    size,
    totalPages: pickNum(body, "totalPages") ?? (Math.ceil(total / size) || 1),
  };
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
    const hitQ =
      !q ||
      j.title.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q) ||
      j.company.name.toLowerCase().includes(q);
    const hitLoc = locationMatches(j.location, loc);
    const normalizedCat = j.category.name.toLowerCase();
    const hitCat =
      !cat || normalizedCat === cat || j.categoryId.toLowerCase() === cat || j.category.name.toLowerCase() === cat;
    const hitType = matchesEmployment(String(j.employmentType || ""), types);
    const hitLevel = matchesExperience(String(j.experienceLevel || ""), levels);
    const jobSkills = (j.skills ?? []).map((item) => item.toLowerCase());
    const hitSkills =
      skills.length === 0 ||
      (params.skillOp === "and"
        ? skills.every((skill) => jobSkills.some((item) => item.includes(skill)))
        : skills.some((skill) => jobSkills.some((item) => item.includes(skill))));
    const hitMin = params.minSalary == null || (j.salaryMax || j.salaryMin) >= params.minSalary;
    const hitMax = params.maxSalary == null || (j.salaryMin || j.salaryMax) <= params.maxSalary;
    const hitCurrency =
      !params.salaryCurrency ||
      !j.salaryCurrency ||
      j.salaryCurrency === params.salaryCurrency ||
      params.salaryCurrency === "VND";
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
  const items = filtered.slice(page * size, page * size + size).map(fromMockCatalogue);
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
  if (params.skills) {
    next.skills = params.skills;
    next.skillOp = params.skillOp ?? "or"; // always explicit (api-conventions §4)
  }
  if (params.sortBy && params.sortBy !== "relevance") next.sortBy = params.sortBy;
  next.page = params.page ?? 0;
  next.size = params.size ?? 20;
  return next;
}

/** search-svc GET /api/search/jobs: the only search endpoint (no /search/advanced). */
export async function fetchJobs(params: JobSearchParams): Promise<PaginatedJobs> {
  try {
    const { data } = await api.get("/search/jobs", { params: compactParams(params) });
    return toSearchPage(data, params);
  } catch (e) {
    if (!shouldUseMock(e, "GET /search/jobs")) throw e;
    await new Promise((r) => setTimeout(r, 280));
    return mockSearch(params);
  }
}

export async function fetchJobById(id: string): Promise<Job | null> {
  try {
    const { data } = await api.get(`/jobs/${id}`);
    return normalizeJob(data as object);
  } catch (e) {
    if (httpStatus(e) === 404) return null;
    if (!shouldUseMock(e, "GET /jobs/{id}")) throw e;
    await new Promise((r) => setTimeout(r, 200));
    const found = MOCK_JOBS.find((j) => j.id === id) ?? null;
    return found ? fromMockCatalogue(found) : null;
  }
}

/** job-svc GET /api/categories: a plain array of { id, name }. */
export async function fetchCategories(): Promise<{ id: string; name: string }[]> {
  try {
    const { data } = await api.get("/categories");
    return data as { id: string; name: string }[];
  } catch (e) {
    if (!shouldUseMock(e, "GET /categories")) throw e;
    return MOCK_CATEGORIES;
  }
}

/** What the recruiter sign-up needs from a company: an id to send, and a name plus a line to tell similar names apart. */
export type CompanyOption = {
  id: string;
  name: string;
  industry?: string;
  address?: string;
  logoUrl?: string;
  verified?: boolean;
};

function toCompanyOption(raw: unknown): CompanyOption | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, "id");
  const name = pickStr(o, "name");
  if (!id || !name) return null;
  return {
    id,
    name,
    industry: pickStr(o, "industry"),
    address: pickStr(o, "address"),
    logoUrl: pickStr(o, "logoUrl", "logo_url"),
    verified: o.verified === true,
  };
}

const MOCK_COMPANIES: CompanyOption[] = [
  ...new Map(MOCK_JOBS.map((job) => [job.company.id, job.company] as const)).values(),
]
  // The mock catalogue stores the backend category name as `industry`; show its Vietnamese label.
  .map((c) =>
    toCompanyOption({ id: c.id, name: c.name, industry: c.industry && categoryLabel(c.industry), address: c.address }),
  )
  .filter((c): c is CompanyOption => c !== null);

/**
 * Companies by name for the recruiter sign-up. job-svc `GET /api/companies` is public, pages from 1 and
 * returns `{ items, total, page, size, totalPages }`; only the first page is read, the user narrows by typing.
 */
export async function fetchCompanies(q: string, size = 8): Promise<CompanyOption[]> {
  return (await fetchCompaniesWithTotal(q, size)).items;
}

/** The same list plus the backend's `total`, so a page can state a real company count in one request. */
export async function fetchCompaniesWithTotal(q: string, size = 8): Promise<{ items: CompanyOption[]; total: number }> {
  try {
    const { data } = await api.get("/companies", { params: { q: q.trim(), page: 1, size } });
    const body = data as { items?: unknown; total?: unknown } | null;
    const items = (Array.isArray(body?.items) ? body.items : [])
      .map(toCompanyOption)
      .filter((c): c is CompanyOption => c !== null);
    const total = typeof body?.total === "number" ? body.total : items.length;
    return { items, total };
  } catch (e) {
    if (!shouldUseMock(e, "GET /companies")) throw e;
    await new Promise((r) => setTimeout(r, 200));
    const keyword = q.trim().toLowerCase();
    const matches = MOCK_COMPANIES.filter((c) => c.name.toLowerCase().includes(keyword));
    return { items: matches.slice(0, size), total: matches.length };
  }
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
  const letters =
    picked.length > 1
      ? picked
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
      : picked[0].slice(0, 2);
  return letters.toUpperCase();
}

const viNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const viInteger = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/**
 * The one salary format, shared by the board row, the detail page and the apply page so the same job
 * never reads differently in two places. A missing bound means "open ended", and no bound at all means
 * the employer did not publish a salary.
 *   VND, whole millions   range, from-only, to-only and single amounts, in millions (triệu)
 *   VND, below 1 million  amounts in dong (đ), grouped with dots
 *   other currency        grouped amounts followed by the currency code
 */
/** True when the employer published no salary bound at all: formatSalary then reads "negotiable". */
export function isSalaryNegotiable(min: number, max: number) {
  return !(Number.isFinite(min) && min > 0) && !(Number.isFinite(max) && max > 0);
}

export function formatSalary(min: number, max: number, currency = "VND") {
  const lo = Number.isFinite(min) && min > 0 ? min : 0;
  const hi = Number.isFinite(max) && max > 0 ? max : 0;
  if (isSalaryNegotiable(min, max)) return i18n.t("salary.negotiable");

  let fmt: (n: number) => string;
  let unit: string;
  if (currency === "VND") {
    if ((!lo || lo >= 1_000_000) && (!hi || hi >= 1_000_000)) {
      fmt = (n) => viNumber.format(n / 1_000_000);
      unit = i18n.t("salary.millionUnit");
    } else {
      fmt = (n) => viInteger.format(n);
      unit = i18n.t("salary.dongUnit");
    }
  } else {
    fmt = (n) => viInteger.format(n);
    unit = currency;
  }

  if (lo && hi && lo !== hi) return i18n.t("salary.range", { from: fmt(lo), to: fmt(hi), unit });
  if (lo && hi) return i18n.t("salary.exact", { amount: fmt(lo), unit });
  return lo ? i18n.t("salary.from", { amount: fmt(lo), unit }) : i18n.t("salary.to", { amount: fmt(hi), unit });
}

/** "New" marker rule (plan §3.1): posted less than 24 hours ago. */
export function isNewJob(iso: string, now = Date.now()) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && now - t >= 0 && now - t < 86_400_000;
}

export function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return i18n.t("time.justNow");
  if (diff < 3600) return i18n.t("time.minutesAgo", { minutes: Math.floor(diff / 60) });
  if (diff < 86400) return i18n.t("time.hoursAgo", { hours: Math.floor(diff / 3600) });
  return i18n.t("time.daysAgo", { days: Math.floor(diff / 86400) });
}

/**
 * The job statuses a recruiter can filter by. Jobs publish instantly, so there is no Pending filter;
 * legacy Pending/Rejected values are still rendered read-only if the API returns them.
 */
export type RecruiterJobStatus = "Active" | "Closed";

/**
 * job-svc GET /api/jobs/recruiter: the signed-in recruiter's own jobs, newest first. Pages start at 1
 * and the response carries the real `total`. No mock fallback: recruiter screens show real data or an error.
 */
export async function fetchRecruiterJobs(
  params: { page?: number; size?: number; status?: RecruiterJobStatus } = {},
): Promise<PaginatedJobs> {
  const size = params.size ?? 10;
  const { data } = await api.get("/jobs/recruiter", {
    params: { page: params.page ?? 1, size, status: params.status },
  });
  const items = Array.isArray(data?.items) ? data.items.map((item: object) => normalizeJob(item)) : [];
  const total = Number(data?.total) || 0;
  return {
    items,
    total,
    page: Number(data?.page) || 1,
    size: Number(data?.size) || size,
    totalPages: Math.max(1, Math.ceil(total / (Number(data?.size) || size))),
  };
}

/** Body of POST /api/jobs (job-svc JobCreateDto, camelCase). Optional fields are sent as null. */
export type JobCreatePayload = {
  title: string;
  description: string;
  companyId: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  categoryId: string | null;
  requirements: string | null;
  benefits: string | null;
  employmentType: string;
  experienceLevel: string;
};

/**
 * job-svc POST /api/jobs (Recruiter only). Not the admin endpoint: AdminJobForm uses /api/admin/jobs.
 * Jobs publish instantly: the response is the new Active job id.
 */
export async function createJob(payload: JobCreatePayload): Promise<{ id: string }> {
  const { data } = await api.post("/jobs", payload);
  return { id: String(data?.id ?? "") };
}

/** job-svc PUT /api/jobs/{id} (poster only, Recruiter). Body matches JobCreateDto. */
export async function updateJob(id: string, payload: JobCreatePayload): Promise<void> {
  await api.put(`/jobs/${encodeURIComponent(id)}`, payload);
}

/** job-svc DELETE /api/jobs/{id} (poster only, Recruiter): removes it from the public board. */
export async function deleteJob(id: string): Promise<void> {
  await api.delete(`/jobs/${encodeURIComponent(id)}`);
}

/** One recommendation: the job, the backend's Vietnamese rationale, and the strategy (Collaborative | Content | Popular). */
export type RecommendedJob = { job: Job; reason: string; strategy: string };

/**
 * job-svc GET /api/jobs/recommended (User only; the gateway returns 403 to other roles, so callers must
 * not request it for them). Bounded top-N, no paging. `refresh` bypasses the per-user cache.
 * Items are RecommendedJobDto: nested company/category, no description, no score.
 */
export async function fetchRecommendedJobs(params: { refresh?: boolean } = {}): Promise<RecommendedJob[]> {
  const { data } = await api.get("/jobs/recommended", { params: { refresh: params.refresh ? true : undefined } });
  const items: unknown[] = Array.isArray(data?.items) ? data.items : [];
  return items.map((raw) => {
    const r = raw as Record<string, any>;
    const job = normalizeJob({
      id: r.id,
      title: r.title,
      location: r.location,
      companyId: r.companyId,
      companyName: r.company?.name,
      categoryId: r.categoryId,
      categoryName: r.category?.name,
      salaryMin: r.salaryMin,
      salaryMax: r.salaryMax,
      salaryCurrency: r.salaryCurrency,
      employmentType: r.employmentType,
      experienceLevel: r.experienceLevel,
      createdAt: r.createdAt,
      status: "active",
    });
    return { job, reason: String(r.reason ?? ""), strategy: String(r.strategy ?? "") };
  });
}
