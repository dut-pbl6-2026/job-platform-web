import type { Job } from "./job";

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

/**
 * GET /api/admin/stats (auth-svc AdminStatsResponse). Each section can be "unavailable"
 * when job-svc / app-svc does not answer: those numbers are null and the section is listed
 * in `unavailable`. No time series or per-period filter on the backend yet.
 */
export interface AdminStatistics {
  totalUsers: number | null;
  activeUsers: number | null;
  newUsersThisMonth: number | null;
  totalRecruiters: number | null;
  totalJobSeekers: number | null;
  totalJobs: number | null;
  activeJobs: number | null;
  pendingJobs: number | null;
  totalApplications: number | null;
  applicationStatus: { pending: number; accepted: number; rejected: number } | null;
  unavailable: Array<"users" | "jobs" | "applications">;
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
