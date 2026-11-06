/**
 * Vietnamese display labels for backend enums. The only place that maps a backend value to user-facing
 * copy: never print a raw enum, an ID or a status code (CLAUDE.md hard rules).
 *
 * Lookups ignore case, spaces, "-" and "_" because the same value arrives in several spellings
 * (job-svc "FullTime", normalizeJob "Full-time", search-svc snake_case).
 */

function key(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}

function lookup(table: Readonly<Record<string, string>>, raw: string | null | undefined): string | undefined {
  const k = key(raw);
  return k ? table[k] : undefined;
}

/* Categories ------------------------------------------------------------------------------------ */

/**
 * The 9 predefined job-svc categories (SeedData.cs), in display order. `name` is the backend name,
 * which is also what GET /api/categories returns; `label` is its one and only Vietnamese label.
 */
export const JOB_CATEGORIES = [
  { name: "IT", label: "Công nghệ Thông tin" },
  { name: "Sales", label: "Kinh doanh/Bán hàng" },
  { name: "Marketing", label: "Marketing/PR/Quảng cáo" },
  { name: "Finance", label: "Tài chính/Kế toán/Ngân hàng" },
  { name: "Healthcare", label: "Y tế/Dược" },
  { name: "Education", label: "Giáo dục/Đào tạo" },
  { name: "Engineering", label: "Kỹ thuật/Sản xuất" },
  { name: "Hospitality", label: "Nhà hàng/Khách sạn/Du lịch" },
  { name: "Others", label: "Ngành nghề khác" },
] as const;

export type JobCategoryName = (typeof JOB_CATEGORIES)[number]["name"];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  JOB_CATEGORIES.map((c) => [key(c.name), c.label]),
);

/** Label for a backend category name. A name this client does not know is shown as the backend sent it. */
export function categoryLabel(name: string | null | undefined): string {
  return lookup(CATEGORY_LABELS, name) ?? (name?.trim() || "Chưa phân loại");
}

/* Employment type ------------------------------------------------------------------------------- */

const EMPLOYMENT_LABELS: Record<string, string> = {
  fulltime: "Toàn thời gian",
  parttime: "Bán thời gian",
  contract: "Hợp đồng",
  internship: "Thực tập",
};

export function employmentTypeLabel(raw: string | null | undefined, fallback = "Chưa cập nhật"): string {
  return lookup(EMPLOYMENT_LABELS, raw) ?? fallback;
}

/* Experience level ------------------------------------------------------------------------------ */

// normalizeJob turns Entry/Mid into Junior/Middle for display, so both spellings are listed.
const EXPERIENCE_LABELS: Record<string, string> = {
  entry: "Mới vào nghề",
  junior: "Mới vào nghề",
  mid: "Trung cấp",
  middle: "Trung cấp",
  senior: "Cấp cao",
  lead: "Trưởng nhóm",
};

export function experienceLevelLabel(raw: string | null | undefined, fallback = "Chưa cập nhật"): string {
  return lookup(EXPERIENCE_LABELS, raw) ?? fallback;
}

/* Job status ------------------------------------------------------------------------------------ */

const JOB_STATUS_LABELS: Record<string, string> = {
  active: "Đang tuyển",
  pending: "Chờ duyệt",
  closed: "Đã đóng",
  rejected: "Bị từ chối",
  deleted: "Đã xóa",
};

export function jobStatusLabel(raw: string | null | undefined): string {
  return lookup(JOB_STATUS_LABELS, raw) ?? "Chưa cập nhật";
}

/* Location -------------------------------------------------------------------------------------- */

/** job-svc stores remote jobs as the location "Remote". */
export function locationLabel(raw: string | null | undefined, fallback = "Chưa cập nhật"): string {
  const value = raw?.trim();
  if (!value) return fallback;
  return key(value) === "remote" ? "Làm từ xa" : value;
}