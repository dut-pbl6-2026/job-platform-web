import { api } from "./api";
import { MOCK_JOBS } from "../mocks/jobsMock";
import { normalizeJob } from "./jobsApi";
import { httpStatus, pickStr, shouldUseMock, unwrap } from "./http";
import type { CompanyDetail, CompanyUpdate, MyCompany } from "../types/company";
import type { PaginatedJobs } from "../types/job";

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeCompany(raw: unknown): CompanyDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, "id");
  const name = pickStr(o, "name");
  if (!id || !name) return null;
  return {
    id,
    name,
    taxCode: textOrNull(o.taxCode ?? o.tax_code),
    verified: o.verified === true,
    logoUrl: textOrNull(o.logoUrl ?? o.logo_url),
    website: textOrNull(o.website),
    description: textOrNull(o.description),
    address: textOrNull(o.address),
    industry: textOrNull(o.industry),
    size: textOrNull(o.size),
    createdAt: textOrNull(o.createdAt ?? o.created_at),
    updatedAt: textOrNull(o.updatedAt ?? o.updated_at),
  };
}

/** The seed mock catalogue only has the company fields a job carries. */
function mockCompany(id: string): CompanyDetail | null {
  const job = MOCK_JOBS.find((j) => j.company.id === id);
  if (!job) return null;
  const c = job.company;
  return {
    id: c.id,
    name: c.name,
    verified: !!c.verified,
    logoUrl: c.logoUrl ?? null,
    website: c.website ?? null,
    description: null,
    address: c.address ?? null,
    industry: c.industry ?? null,
    size: null,
  };
}

/** job-svc GET /api/companies/{id} (public). A missing company is null, not an error. */
export async function fetchCompany(id: string): Promise<CompanyDetail | null> {
  try {
    const { data } = await api.get(`/companies/${encodeURIComponent(id)}`);
    return normalizeCompany(unwrap(data));
  } catch (e) {
    if (httpStatus(e) === 404) return null;
    if (!shouldUseMock(e, "GET /companies/{id}")) throw e;
    return mockCompany(id);
  }
}

/**
 * job-svc GET /api/companies/{id}/jobs?page=0&size=20 — Active jobs only.
 * The endpoint is being added on job-svc main; a 404 means "not available yet" and the public
 * company page then links to the job board instead of failing.
 */
export async function fetchCompanyJobs(
  id: string,
  params: { page?: number; size?: number } = {},
): Promise<PaginatedJobs | null> {
  const page = Math.max(0, params.page ?? 0);
  const size = Math.min(100, Math.max(1, params.size ?? 20));
  try {
    const { data } = await api.get(`/companies/${encodeURIComponent(id)}/jobs`, { params: { page, size } });
    const raw = (unwrap(data) ?? {}) as Record<string, unknown>;
    const items = Array.isArray(raw.items) ? raw.items.map((item) => normalizeJob(item as object)) : [];
    const total = Number(raw.total) || items.length;
    const pageSize = Number(raw.size) || size;
    return {
      items,
      total,
      page: Number(raw.page) || page,
      size: pageSize,
      totalPages: Math.max(1, Number(raw.totalPages) || Math.ceil(total / pageSize) || 1),
    };
  } catch (e) {
    if (httpStatus(e) === 404) return null;
    if (!shouldUseMock(e, "GET /companies/{id}/jobs")) throw e;
    const items = MOCK_JOBS.filter((j) => j.company.id === id).map((j) =>
      normalizeJob({
        ...j,
        companyId: j.company.id,
        companyName: j.company.name,
        categoryId: j.category.id,
        categoryName: j.category.name,
      }),
    );
    return { items, total: items.length, page: 0, size, totalPages: 1 };
  }
}

/**
 * job-svc GET /api/companies/mine — the signed-in recruiter's company and role.
 * Accepts either `{ company, isCompanyAdmin }` or a flat company detail with the role flag.
 */
export async function fetchMyCompany(companyId?: string | null): Promise<MyCompany | null> {
  try {
    const { data } = await api.get("/companies/mine");
    const body = (unwrap(data) ?? {}) as Record<string, unknown>;
    const nested = body.company && typeof body.company === "object" ? body.company : null;
    const company = normalizeCompany(nested ?? body);
    if (!company) return null;
    const role = String(body.companyRole ?? body.role ?? "").toLowerCase();
    const isCompanyAdmin =
      typeof body.isCompanyAdmin === "boolean"
        ? body.isCompanyAdmin
        : role === "companyadmin" || role === "company_admin" || role === "admin";
    return { company, isCompanyAdmin };
  } catch (e) {
    if (httpStatus(e) === 404) return null;
    if (!shouldUseMock(e, "GET /companies/mine")) throw e;
    const company = companyId ? mockCompany(companyId) : null;
    return company ? { company, isCompanyAdmin: true } : null;
  }
}

/** job-svc PUT /api/companies/{id} — Company Admin only on the backend. */
export async function updateCompany(id: string, input: CompanyUpdate): Promise<void> {
  await api.put(`/companies/${encodeURIComponent(id)}`, {
    name: input.name.trim(),
    taxCode: input.taxCode?.trim() || null,
    logoUrl: input.logoUrl?.trim() || null,
    website: input.website?.trim() || null,
    description: input.description?.trim() || null,
    address: input.address?.trim() || null,
    industry: input.industry?.trim() || null,
    size: input.size?.trim() || null,
  });
}
