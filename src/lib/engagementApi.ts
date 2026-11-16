import { api } from "./api";
import { pickNum, pickStr, unwrap } from "./http";

/** Recruiter-saved email template. Private to the recruiter who created it. */
export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type EmailTemplateInput = {
  name: string;
  subject: string;
  body: string;
};

function normalizeTemplate(raw: unknown): EmailTemplate {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    id: pickStr(o, "id") ?? "",
    name: pickStr(o, "name") ?? "",
    subject: pickStr(o, "subject") ?? "",
    body: pickStr(o, "body") ?? "",
    createdAt: pickStr(o, "createdAt", "created_at") ?? new Date().toISOString(),
    updatedAt: pickStr(o, "updatedAt", "updated_at") ?? new Date().toISOString(),
  };
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const { data } = await api.get("/email-templates");
  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return list.map(normalizeTemplate);
}

export async function createEmailTemplate(input: EmailTemplateInput): Promise<EmailTemplate> {
  const { data } = await api.post("/email-templates", input);
  return normalizeTemplate(unwrap(data));
}

export async function updateEmailTemplate(id: string, input: EmailTemplateInput): Promise<EmailTemplate> {
  const { data } = await api.put(`/email-templates/${encodeURIComponent(id)}`, input);
  return normalizeTemplate(unwrap(data));
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await api.delete(`/email-templates/${encodeURIComponent(id)}`);
}

/**
 * POST /api/applications/{id}/email. The backend resolves {{candidate_name}}, {{job_title}} and
 * {{recruiter_name}} in both subject and body before sending.
 */
export async function sendApplicationEmail(
  applicationId: string,
  input: { subject: string; body: string },
): Promise<{ recipient: string }> {
  const { data } = await api.post(`/applications/${encodeURIComponent(applicationId)}/email`, input);
  return { recipient: pickStr((data ?? {}) as Record<string, unknown>, "recipient") ?? "" };
}

export type InterviewMode = "online" | "onsite" | "phone";
export type InterviewStatus = "scheduled" | "cancelled";

export type Interview = {
  id: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  applicantId: string;
  applicantName: string | null;
  applicantEmail: string;
  recruiterId: string;
  recruiterName: string | null;
  recruiterEmail: string;
  /** UTC instant, ISO string. */
  startsAtUtc: string;
  endsAtUtc: string;
  durationMinutes: number;
  mode: InterviewMode;
  location: string | null;
  notes: string | null;
  status: InterviewStatus;
  calendarUid: string;
  createdAt: string;
};

function asMode(raw: unknown): InterviewMode {
  const value = String(raw ?? "online").toLowerCase();
  return value === "onsite" || value === "phone" ? value : "online";
}

function normalizeInterview(raw: unknown): Interview {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    id: pickStr(o, "id") ?? "",
    applicationId: pickStr(o, "applicationId", "application_id") ?? "",
    jobId: pickStr(o, "jobId", "job_id") ?? "",
    jobTitle: pickStr(o, "jobTitle", "job_title") ?? "",
    companyId: pickStr(o, "companyId", "company_id") ?? "",
    applicantId: pickStr(o, "applicantId", "applicant_id") ?? "",
    applicantName: pickStr(o, "applicantName", "applicant_name") ?? null,
    applicantEmail: pickStr(o, "applicantEmail", "applicant_email") ?? "",
    recruiterId: pickStr(o, "recruiterId", "recruiter_id") ?? "",
    recruiterName: pickStr(o, "recruiterName", "recruiter_name") ?? null,
    recruiterEmail: pickStr(o, "recruiterEmail", "recruiter_email") ?? "",
    startsAtUtc: pickStr(o, "startsAtUtc", "starts_at_utc") ?? new Date().toISOString(),
    endsAtUtc: pickStr(o, "endsAtUtc", "ends_at_utc") ?? new Date().toISOString(),
    durationMinutes: pickNum(o, "durationMinutes", "duration_minutes") ?? 45,
    mode: asMode(o.mode),
    location: pickStr(o, "location") ?? null,
    notes: pickStr(o, "notes") ?? null,
    status: String(o.status ?? "scheduled").toLowerCase() === "cancelled" ? "cancelled" : "scheduled",
    calendarUid: pickStr(o, "calendarUid", "calendar_uid") ?? "",
    createdAt: pickStr(o, "createdAt", "created_at") ?? new Date().toISOString(),
  };
}

export async function listInterviews(
  params: { from?: string; to?: string; jobId?: string } = {},
): Promise<Interview[]> {
  const { data } = await api.get("/interviews", {
    params: { from: params.from, to: params.to, jobId: params.jobId },
  });
  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return list.map(normalizeInterview);
}

export type CreateInterviewInput = {
  applicationId: string;
  /** ISO instant (UTC or with an offset); the backend stores UTC. */
  startsAtUtc: string;
  durationMinutes: number;
  mode: InterviewMode;
  location?: string | null;
  notes?: string | null;
  sendInvite: boolean;
};

export type InterviewMutation = {
  interview: Interview;
  inviteSent: boolean;
  inviteError: string | null;
};

function normalizeMutation(data: unknown): InterviewMutation {
  const o = (data ?? {}) as Record<string, unknown>;
  return {
    interview: normalizeInterview(o.interview),
    inviteSent: Boolean(o.inviteSent ?? o.invite_sent),
    inviteError: pickStr(o, "inviteError", "invite_error") ?? null,
  };
}

export async function createInterview(input: CreateInterviewInput): Promise<InterviewMutation> {
  const { data } = await api.post("/interviews", input);
  return normalizeMutation(unwrap(data));
}

export async function rescheduleInterview(
  id: string,
  input: { startsAtUtc: string; durationMinutes: number; sendUpdate: boolean },
): Promise<InterviewMutation> {
  const { data } = await api.put(`/interviews/${encodeURIComponent(id)}`, input);
  return normalizeMutation(unwrap(data));
}

export async function cancelInterview(id: string, sendUpdate = true): Promise<InterviewMutation> {
  const { data } = await api.post(`/interviews/${encodeURIComponent(id)}/cancel`, { sendUpdate });
  return normalizeMutation(unwrap(data));
}

/**
 * The .ics endpoint is behind the JWT, so a plain <a href> would 401. Fetch it through the API
 * client and save the blob, the same way CV downloads work.
 */
export async function downloadInterviewIcs(interview: Interview): Promise<void> {
  const { data } = await api.get<Blob>(`/interviews/${encodeURIComponent(interview.id)}/ics`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  const slug = interview.jobTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  link.href = url;
  link.download = `phong-van-${slug || interview.id}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
