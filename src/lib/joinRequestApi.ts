import { api } from "./api";

/**
 * Company join requests (SRS AUTH-01-12 to AUTH-01-14): a work-email sign-up whose domain already
 * belongs to a verified Company asks to join it instead of creating a second Company.
 *
 * The status is the stored enum; the read endpoints also apply the waiting period, so a Pending or
 * Rejected request whose `expiresAt` has passed is already returned as Expired (AUTH-01-13). The
 * client shows the status it gets and never derives one from the clock.
 */
export const JOIN_REQUEST_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Expired",
  "Escalated",
  "SupportApproved",
  "SupportRejected",
] as const;

export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

/** `GET /api/companies/me/join-request` (the requester). 404 means this account has no request. */
export type MyJoinRequest = {
  id: string;
  companyId: string;
  status: JoinRequestStatus;
  expiresAt: string;
  createdAt: string;
  /** True only when the status is Expired; the server decides, the button follows this flag. */
  canEscalate: boolean;
};

/** One row of `GET /api/companies/{id}/join-requests`. The view carries no name or email. */
export type JoinRequestSummary = {
  id: string;
  companyId: string;
  userId: string;
  status: JoinRequestStatus;
  expiresAt: string;
  createdAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
};

export type JoinRequestPage = { items: JoinRequestSummary[]; total: number; page: number; size: number };

/** Admin list: the page numbers from 1, like the job-svc admin APIs. */
export async function fetchJoinRequests(
  companyId: string,
  params: { page: number; size: number },
): Promise<JoinRequestPage> {
  const { data } = await api.get(`/companies/${companyId}/join-requests`, { params });
  return data as JoinRequestPage;
}

/**
 * Admin decision. 404 = unknown request, 409 = no longer Pending or already expired,
 * 503 = auth-svc could not link the account (the request stays Pending, so the admin can retry).
 */
export async function approveJoinRequest(companyId: string, requestId: string): Promise<{ status: JoinRequestStatus }> {
  const { data } = await api.post(`/companies/${companyId}/join-requests/${requestId}/approve`);
  return data as { status: JoinRequestStatus };
}

/** Rejection is final; the reason is optional and only shown back to the admin. */
export async function rejectJoinRequest(
  companyId: string,
  requestId: string,
  reason?: string,
): Promise<{ status: JoinRequestStatus }> {
  const { data } = await api.post(
    `/companies/${companyId}/join-requests/${requestId}/reject`,
    reason ? { reason } : {},
  );
  return data as { status: JoinRequestStatus };
}

/** Requester view. A 404 is the normal answer for an account that never asked to join a Company. */
export async function fetchMyJoinRequest(): Promise<MyJoinRequest> {
  const { data } = await api.get("/companies/me/join-request");
  return data as MyJoinRequest;
}

/** Requester escalation to support: allowed once, only while the status is Expired (409 otherwise). */
export async function escalateMyJoinRequest(): Promise<{ id: string; status: JoinRequestStatus }> {
  const { data } = await api.post("/companies/me/join-request/escalate");
  return data as { id: string; status: JoinRequestStatus };
}
