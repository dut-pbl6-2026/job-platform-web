import i18n from "../i18n";
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
  scoringStatus?: string | null;
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

export const APPLICATION_STATUSES: ApplicationStatus[] = ["pending", "reviewed", "shortlisted", "accepted", "rejected"];

// Getters, not values: each label is read through i18n when it is used, so the callers below
// (and the recruiter and admin screens) keep their `STATUS_LABEL[status]` form unchanged.
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  get pending() {
    return i18n.t("applications.status.pending");
  },
  get reviewed() {
    return i18n.t("applications.status.reviewed");
  },
  get shortlisted() {
    return i18n.t("applications.status.shortlisted");
  },
  get accepted() {
    return i18n.t("applications.status.accepted");
  },
  get rejected() {
    return i18n.t("applications.status.rejected");
  },
};
