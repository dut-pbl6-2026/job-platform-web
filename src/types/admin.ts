import type { Job } from "./job";

export type AdminPeriod = "daily" | "weekly" | "monthly";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: "User" | "Recruiter" | "Admin";
  isActive: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface StatPoint {
  label: string;
  users: number;
  jobs: number;
  applications: number;
}

export interface CategoryStat {
  name: string;
  count: number;
}

export interface AdminStatistics {
  period: AdminPeriod;
  totalUsers: number;
  totalRecruiters: number;
  totalJobSeekers: number;
  totalJobs: number;
  totalApplications: number;
  pendingJobs: number;
  series: StatPoint[];
  categories: CategoryStat[];
  applicationStatus: { pending: number; reviewed: number; accepted: number; rejected: number };
}

export interface HealthService {
  name: string;
  status: "online" | "offline";
  latencyMs: number | null;
}

export interface AdminHealth {
  services: HealthService[];
}

export type PendingJob = Job & { recruiterName?: string };
