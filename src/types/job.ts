export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";
export type ExperienceLevel = "Junior" | "Middle" | "Senior" | "Lead";
export type JobStatus = "active" | "pending" | "closed";

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
  requirements: string;
  benefits: string;
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
