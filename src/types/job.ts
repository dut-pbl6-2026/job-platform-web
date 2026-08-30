// Backend (Job.Core) uses PascalCase without hyphen: "FullTime" | "PartTime" | "Contract" | "Internship"
// Frontend display uses hyphenated: "Full-time" | "Part-time"
// Keep union to support both raw API and normalized display values.
export type BackendEmploymentType = "FullTime" | "PartTime" | "Contract" | "Internship";
export type DisplayEmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";
export type EmploymentType = BackendEmploymentType | DisplayEmploymentType;

// Backend uses "Entry" | "Mid" | "Senior" | "Lead"; frontend historically used "Junior" | "Middle"
export type BackendExperienceLevel = "Entry" | "Mid" | "Senior" | "Lead";
export type DisplayExperienceLevel = "Junior" | "Middle" | "Senior" | "Lead";
export type ExperienceLevel = BackendExperienceLevel | DisplayExperienceLevel;

export type JobStatus = "active" | "pending" | "closed";

// Normalization maps: backend -> display (used for UI tags / filters)
export const EMPLOYMENT_TYPE_DISPLAY: Record<string, DisplayEmploymentType> = {
  FullTime: "Full-time",
  "Full-time": "Full-time",
  PartTime: "Part-time",
  "Part-time": "Part-time",
  Contract: "Contract",
  Internship: "Internship",
};

export const EXPERIENCE_LEVEL_DISPLAY: Record<string, DisplayExperienceLevel> = {
  Entry: "Junior",
  Junior: "Junior",
  Mid: "Middle",
  Middle: "Middle",
  Senior: "Senior",
  Lead: "Lead",
};

export function normalizeEmploymentType(raw: string): DisplayEmploymentType {
  return EMPLOYMENT_TYPE_DISPLAY[raw] ?? (raw as DisplayEmploymentType);
}

export function normalizeExperienceLevel(raw: string): DisplayExperienceLevel {
  return EXPERIENCE_LEVEL_DISPLAY[raw] ?? (raw as DisplayExperienceLevel);
}

export interface Company {
  id: string;
  name: string;
  logoUrl?: string;
  website?: string;
  address?: string;
  industry?: string;
  verified?: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  company: Company;
  companyId: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: string;
  category: Category;
  categoryId: string;
  requirements: string | null;
  benefits: string | null;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  status: JobStatus;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  recruiterId?: string;
}

export interface PaginatedJobs {
  items: Job[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface JobSearchParams {
  q?: string;
  location?: string;
  category?: string;
  page?: number; // 0-based
  size?: number;
  employmentType?: string;
}
