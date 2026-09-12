export type ApplicationStatus = "pending" | "reviewed" | "shortlisted" | "accepted" | "rejected";

export interface StatusHistoryEntry {
  id: string;
  applicationId: string;
  status: ApplicationStatus;
  note?: string | null;
  changedBy?: string | null;
  changedAt: string;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle?: string;
  companyName?: string;
  location?: string;
  applicantId: string;
  coverLetter?: string | null;
  cvUrl?: string | null;
  cvFileName?: string | null;
  status: ApplicationStatus;
  recruiterNotes?: string | null;
  score?: number | null;
  createdAt: string;
  updatedAt: string;
  statusHistory?: StatusHistoryEntry[];
}

export interface PaginatedApplications {
  items: Application[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "pending",
  "reviewed",
  "shortlisted",
  "accepted",
  "rejected",
];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Chờ xem",
  reviewed: "Đã xem",
  shortlisted: "Vào vòng sau",
  accepted: "Nhận việc",
  rejected: "Không đậu",
};
