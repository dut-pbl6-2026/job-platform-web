import type { Job } from "../types/job";
import type { IncomingNotification, ToastInput } from "../types/notification";

const JOB_EVENT_TYPES = new Set([
  "job.created",
  "job_created",
  "job.posted",
  "job_posted",
  "new_job",
  "jobposted",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function parseNotificationEnvelope(raw: unknown): { messageType: string; notification: IncomingNotification } | null {
  const msg = asRecord(raw);
  if (!msg) return null;

  const messageType = String(msg.type ?? msg.messageType ?? "");
  if (messageType === "ping" || messageType === "pong") return null;

  if (messageType === "error") {
    return {
      messageType,
      notification: {
        id: msg.code != null ? String(msg.code) : "ws-error",
        type: "error",
        title: "Thông báo",
        body: msg.message != null ? String(msg.message) : "Không nhận được thông báo",
      },
    };
  }

  const payload = asRecord(msg.payload) ?? msg;
  const data = asRecord(payload.data) ?? {};
  const nestedType = payload.type != null ? String(payload.type) : "";
  const type = payload.notificationType != null
    ? String(payload.notificationType)
    : payload.event != null
      ? String(payload.event)
      : nestedType && nestedType !== "notification"
        ? nestedType
        : messageType !== "notification"
          ? messageType
          : "";

  return {
    messageType: messageType || "notification",
    notification: {
      id: payload.id != null ? String(payload.id) : undefined,
      type: type || undefined,
      title: payload.title != null ? String(payload.title) : undefined,
      body: payload.body != null ? String(payload.body) : undefined,
      data,
      timestamp: payload.timestamp != null ? String(payload.timestamp) : undefined,
    },
  };
}

function jobHeadline(jobTitle: string | undefined, company: string | undefined, fallback?: string) {
  if (jobTitle && company) return `Việc làm mới: ${jobTitle} tại ${company}`;
  if (jobTitle) return `Việc làm mới: ${jobTitle}`;
  return fallback?.trim() || "Có việc làm mới";
}

export function toToastInput(notification: IncomingNotification): ToastInput | null {
  const data = notification.data ?? {};
  const jobId = pickString(data, ["jobId", "job_id", "JobId"]);
  const jobTitle = pickString(data, ["title", "jobTitle", "job_title"]);
  const company = pickString(data, ["company", "companyName", "company_name", "CompanyName"]);
  const event = (notification.type ?? "").toLowerCase().replace(/\s+/g, "");
  const isJob = JOB_EVENT_TYPES.has(event) || event.includes("job.created") || event.includes("job_created") || (!!jobId && event.includes("job"));

  if (isJob) {
    return {
      id: notification.id ?? (jobId ? `job:${jobId}` : undefined),
      dedupeKey: jobId ? `job:${jobId}` : notification.id,
      kind: "job",
      title: jobHeadline(jobTitle, company, notification.title),
      body: notification.body,
      href: jobId ? `/jobs/${encodeURIComponent(jobId)}` : "/jobs",
    };
  }

  if (!notification.title && !notification.body) return null;
  const applicationId = pickString(data, ["applicationId", "application_id", "ApplicationId"]);
  const applicationHref = applicationId ? `/applications/${encodeURIComponent(applicationId)}` : undefined;
  const jobHref = jobId ? `/jobs/${encodeURIComponent(jobId)}` : undefined;
  return {
    id: notification.id,
    dedupeKey: notification.id,
    kind: event === "error" ? "error" : "info",
    title: notification.title ?? "Thông báo",
    body: notification.body,
    href: event.startsWith("application") ? applicationHref ?? jobHref : jobHref ?? applicationHref,
  };
}

export function toastFromSocketMessage(raw: string): ToastInput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const envelope = parseNotificationEnvelope(parsed);
  if (!envelope) return null;
  return toToastInput(envelope.notification);
}

export function toastFromJob(job: Job): ToastInput {
  const company = job.company?.name?.trim();
  return {
    id: `job:${job.id}`,
    dedupeKey: `job:${job.id}`,
    kind: "job",
    title: jobHeadline(job.title, company),
    body: job.location || undefined,
    href: `/jobs/${encodeURIComponent(job.id)}`,
  };
}
