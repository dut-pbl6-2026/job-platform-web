import type { JobSearchParams } from "../types/job";

export const JOB_PAGE_SIZE = 9;

// Only values job-svc accepts (api-conventions §6). Freelance / Junior are an open decision there.
// These are API values; their display labels come from labels.ts at render time.
export const EMPLOYMENT_OPTIONS = ["FullTime", "PartTime", "Contract", "Internship"] as const;

export const EXPERIENCE_OPTIONS = ["Entry", "Mid", "Senior", "Lead"] as const;

export const SORT_OPTIONS = [
  { value: "relevance", labelKey: "jobs.sort.relevance" },
  { value: "created_at_desc", labelKey: "jobs.sort.newest" },
  { value: "salary_desc", labelKey: "jobs.sort.salaryDesc" },
  { value: "salary_asc", labelKey: "jobs.sort.salaryAsc" },
] as const;

export const SALARY_BANDS_VND = [
  { labelKey: "jobs.filters.bands.under5m", min: 0, max: 5_000_000 },
  { labelKey: "jobs.filters.bands.from5to10m", min: 5_000_000, max: 10_000_000 },
  { labelKey: "jobs.filters.bands.from10to20m", min: 10_000_000, max: 20_000_000 },
  { labelKey: "jobs.filters.bands.over20m", min: 20_000_000, max: undefined },
] as const;

export const SALARY_BANDS_USD = [
  { labelKey: "jobs.filters.bands.underUsd500", min: 0, max: 500 },
  { labelKey: "jobs.filters.bands.usd500to1000", min: 500, max: 1_000 },
  { labelKey: "jobs.filters.bands.usd1000to2000", min: 1_000, max: 2_000 },
  { labelKey: "jobs.filters.bands.overUsd2000", min: 2_000, max: undefined },
] as const;

/** Suggestions under the place field; the visitor can still type any place. */
export const LOCATION_SUGGESTIONS = [
  "Hà Nội",
  "Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Bình Dương",
  "Đồng Nai",
  "Bắc Ninh",
] as const;

const NORTH = [
  "hà nội",
  "hải phòng",
  "bắc ninh",
  "quảng ninh",
  "hải dương",
  "nam định",
  "thanh hóa",
  "nghệ an",
  "ha noi",
];
const SOUTH = ["hồ chí minh", "bình dương", "đồng nai", "long an", "cần thơ", "ho chi minh"];

export function locationMatches(jobLocation: string, filter: string) {
  const loc = jobLocation.toLowerCase();
  const want = filter.toLowerCase();
  if (!want) return true;
  if (want === "remote") return loc === "remote";
  if (want === "miền bắc") return NORTH.some((p) => loc.includes(p));
  if (want === "miền nam") return SOUTH.some((p) => loc.includes(p));
  if (want.includes("hồ chí minh") || want.includes("ho chi minh"))
    return loc.includes("hồ chí minh") || loc.includes("ho chi minh");
  return loc.includes(want) || want.includes(loc);
}

function csv(raw: string | null): string {
  return (raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(",");
}

function num(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function parseSearchParams(sp: URLSearchParams): JobSearchParams {
  const pageParam = Number(sp.get("page"));
  return {
    q: sp.get("q") || undefined,
    location: sp.get("location") || undefined,
    category: sp.get("category") || undefined,
    page: Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0,
    size: JOB_PAGE_SIZE,
    employmentType: csv(sp.get("employmentType")) || undefined,
    experienceLevel: csv(sp.get("experienceLevel")) || undefined,
    minSalary: num(sp.get("minSalary")),
    maxSalary: num(sp.get("maxSalary")),
    sortBy: sp.get("sort") || undefined,
    skills: csv(sp.get("skills")) || undefined,
    // api-conventions §4: default is "or" (any skill), "and" only when asked for.
    skillOp: sp.get("skillOp") === "and" ? "and" : "or",
    salaryCurrency: sp.get("currency") === "USD" ? "USD" : "VND",
  };
}

/** `q` belongs to the search bar and survives "clear filters", so it is not a filter here. */
export function hasActiveFilters(params: JobSearchParams) {
  return Boolean(
    params.location ||
      params.category ||
      params.employmentType ||
      params.experienceLevel ||
      params.skills ||
      params.minSalary != null ||
      params.maxSalary != null ||
      (params.sortBy && params.sortBy !== "relevance"),
  );
}

export function splitCsv(value?: string) {
  return (value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function toggleCsv(current: string | undefined, value: string) {
  const set = new Set(splitCsv(current));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set].join(",");
}
