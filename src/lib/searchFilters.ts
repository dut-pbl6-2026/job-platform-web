import type { JobSearchParams } from "../types/job";

export const JOB_PAGE_SIZE = 9;

export const EMPLOYMENT_OPTIONS = [
  { value: "FullTime", label: "Toàn thời gian" },
  { value: "PartTime", label: "Bán thời gian" },
  { value: "Contract", label: "Hợp đồng" },
  { value: "Internship", label: "Thực tập" },
  { value: "Freelance", label: "Freelance" },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: "Entry", label: "Mới vào nghề" },
  { value: "Junior", label: "Junior" },
  { value: "Mid", label: "Trung cấp" },
  { value: "Senior", label: "Senior" },
  { value: "Lead", label: "Lead" },
] as const;

export const SORT_OPTIONS = [
  { value: "relevance", label: "Liên quan" },
  { value: "created_at_desc", label: "Mới nhất" },
  { value: "salary_desc", label: "Lương cao → thấp" },
  { value: "salary_asc", label: "Lương thấp → cao" },
] as const;

export const SALARY_BANDS_VND = [
  { label: "Dưới 5 triệu", min: 0, max: 5_000_000 },
  { label: "5–10 triệu", min: 5_000_000, max: 10_000_000 },
  { label: "10–20 triệu", min: 10_000_000, max: 20_000_000 },
  { label: "Trên 20 triệu", min: 20_000_000, max: undefined },
] as const;

export const SALARY_BANDS_USD = [
  { label: "Dưới $500", min: 0, max: 500 },
  { label: "$500–$1.000", min: 500, max: 1_000 },
  { label: "$1.000–$2.000", min: 1_000, max: 2_000 },
  { label: "Trên $2.000", min: 2_000, max: undefined },
] as const;

export const LOCATION_PILLS = [
  { label: "Ngẫu nhiên", value: "" },
  { label: "Hà Nội", value: "Hà Nội" },
  { label: "Thành phố Hồ Chí Minh (cũ)", value: "Hồ Chí Minh" },
  { label: "Miền Bắc", value: "Miền Bắc" },
  { label: "Miền Nam", value: "Miền Nam" },
] as const;

const NORTH = ["hà nội", "hải phòng", "bắc ninh", "quảng ninh", "hải dương", "nam định", "thanh hóa", "nghệ an", "ha noi"];
const SOUTH = ["hồ chí minh", "bình dương", "đồng nai", "long an", "cần thơ", "ho chi minh"];

export function locationMatches(jobLocation: string, filter: string) {
  const loc = jobLocation.toLowerCase();
  const want = filter.toLowerCase();
  if (!want) return true;
  if (want === "remote") return loc === "remote";
  if (want === "miền bắc") return NORTH.some((p) => loc.includes(p));
  if (want === "miền nam") return SOUTH.some((p) => loc.includes(p));
  if (want.includes("hồ chí minh") || want.includes("ho chi minh")) return loc.includes("hồ chí minh") || loc.includes("ho chi minh");
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
    skillOp: sp.get("skillOp") === "or" ? "or" : "and",
    salaryCurrency: sp.get("currency") === "USD" ? "USD" : "VND",
  };
}

export function hasActiveFilters(params: JobSearchParams) {
  return Boolean(
    params.q ||
    params.location ||
    params.category ||
    params.employmentType ||
    params.experienceLevel ||
    params.skills ||
    params.minSalary != null ||
    params.maxSalary != null ||
    (params.sortBy && params.sortBy !== "relevance")
  );
}

export function splitCsv(value?: string) {
  return (value || "").split(",").map((part) => part.trim()).filter(Boolean);
}

export function toggleCsv(current: string | undefined, value: string) {
  const set = new Set(splitCsv(current));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set].join(",");
}
