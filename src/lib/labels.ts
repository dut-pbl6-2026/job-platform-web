import i18n from "../i18n";

/**
 * Display labels for backend enums. The only place that maps a backend value to user-facing copy:
 * never print a raw enum, an ID or a status code (CLAUDE.md hard rules). Each table maps a normalised
 * value to a translation key in locales/vi.json, and the text is resolved at call time.
 *
 * Lookups ignore case, spaces, "-" and "_" because the same value arrives in several spellings
 * (job-svc and search-svc "FullTime", normalizeJob "Full-time").
 */

function key(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}

function lookup<K extends string>(table: Readonly<Record<string, K>>, raw: string | null | undefined): K | undefined {
  const k = key(raw);
  return k ? table[k] : undefined;
}

/* Categories ------------------------------------------------------------------------------------ */

/**
 * The 9 predefined job-svc categories (SeedData.cs), in display order. `name` is the backend name,
 * which is also what GET /api/categories returns; `labelKey` is its one and only display label.
 */
export const JOB_CATEGORIES = [
  { name: "IT", labelKey: "labels.category.IT" },
  { name: "Sales", labelKey: "labels.category.Sales" },
  { name: "Marketing", labelKey: "labels.category.Marketing" },
  { name: "Finance", labelKey: "labels.category.Finance" },
  { name: "Healthcare", labelKey: "labels.category.Healthcare" },
  { name: "Education", labelKey: "labels.category.Education" },
  { name: "Engineering", labelKey: "labels.category.Engineering" },
  { name: "Hospitality", labelKey: "labels.category.Hospitality" },
  { name: "Others", labelKey: "labels.category.Others" },
] as const;

export type JobCategoryName = (typeof JOB_CATEGORIES)[number]["name"];

const CATEGORY_LABEL_KEYS = Object.fromEntries(JOB_CATEGORIES.map((c) => [key(c.name), c.labelKey])) as Record<
  string,
  (typeof JOB_CATEGORIES)[number]["labelKey"]
>;

/** Label for a backend category name. A name this client does not know is shown as the backend sent it. */
export function categoryLabel(name: string | null | undefined): string {
  const labelKey = lookup(CATEGORY_LABEL_KEYS, name);
  if (labelKey) return i18n.t(labelKey);
  return name?.trim() || i18n.t("labels.unassigned");
}

/* Employment type ------------------------------------------------------------------------------- */

const EMPLOYMENT_LABEL_KEYS = {
  fulltime: "labels.employmentType.fulltime",
  parttime: "labels.employmentType.parttime",
  contract: "labels.employmentType.contract",
  internship: "labels.employmentType.internship",
} as const;

export function employmentTypeLabel(raw: string | null | undefined, fallback?: string): string {
  const labelKey = lookup(EMPLOYMENT_LABEL_KEYS, raw);
  return labelKey ? i18n.t(labelKey) : (fallback ?? i18n.t("common.notProvided"));
}

/* Experience level ------------------------------------------------------------------------------ */

// normalizeJob turns Entry/Mid into Junior/Middle for display, so both spellings are listed.
const EXPERIENCE_LABEL_KEYS = {
  entry: "labels.experience.entry",
  junior: "labels.experience.junior",
  mid: "labels.experience.mid",
  middle: "labels.experience.middle",
  senior: "labels.experience.senior",
  lead: "labels.experience.lead",
} as const;

export function experienceLevelLabel(raw: string | null | undefined, fallback?: string): string {
  const labelKey = lookup(EXPERIENCE_LABEL_KEYS, raw);
  return labelKey ? i18n.t(labelKey) : (fallback ?? i18n.t("common.notProvided"));
}

/* Job status ------------------------------------------------------------------------------------ */

const JOB_STATUS_LABEL_KEYS = {
  active: "labels.jobStatus.active",
  pending: "labels.jobStatus.pending",
  closed: "labels.jobStatus.closed",
  rejected: "labels.jobStatus.rejected",
  deleted: "labels.jobStatus.deleted",
} as const;

export function jobStatusLabel(raw: string | null | undefined): string {
  const labelKey = lookup(JOB_STATUS_LABEL_KEYS, raw);
  return labelKey ? i18n.t(labelKey) : i18n.t("common.notProvided");
}

/* Location -------------------------------------------------------------------------------------- */

/** job-svc stores remote jobs as the location "Remote". */
export function locationLabel(raw: string | null | undefined, fallback?: string): string {
  const value = raw?.trim();
  if (!value) return fallback ?? i18n.t("common.notProvided");
  return key(value) === "remote" ? i18n.t("labels.remote") : value;
}

/* Account role ---------------------------------------------------------------------------------- */

const ROLE_LABEL_KEYS = {
  user: "labels.role.user",
  recruiter: "labels.role.recruiter",
  employer: "labels.role.employer",
  admin: "labels.role.admin",
} as const;

export function roleLabel(raw: string | null | undefined): string {
  const labelKey = lookup(ROLE_LABEL_KEYS, raw);
  return labelKey ? i18n.t(labelKey) : i18n.t("common.notProvided");
}
