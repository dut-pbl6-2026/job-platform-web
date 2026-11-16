import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Icon, type IconName } from "./ui/Icon";
import { cx } from "./ui/controls";
import { useAuth } from "../contexts/AuthContext";
import { fetchApplicationsByJob, fetchMyApplications } from "../lib/applicationsApi";
import { listInterviews } from "../lib/engagementApi";
import { fetchRecruiterJobs } from "../lib/jobsApi";
import { isRecruiter, isUser } from "../lib/roles";
import { STATUS_LABEL } from "../types/application";

type FeedItem = {
  id: string;
  icon: IconName;
  title: string;
  body?: string;
  href: string;
  at: string;
};

const SEEN_PREFIX = "jp.notifications.seen.";

function readSeen(userId: string): string {
  try {
    const stored = localStorage.getItem(SEEN_PREFIX + userId);
    if (stored) return stored;
  } catch {
    /* storage can be disabled */
  }
  // First visit: treat the last week as unread so the bell is not empty on a fresh demo account.
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The bell aggregates what the signed-in person can already read: their applications and interview
 * invites (candidate), or recent applications and scheduled interviews (recruiter). The last-opened
 * instant is kept per account in localStorage, so the badge counts only what changed since then.
 */
export function NotificationBell({ onNavy = false }: { onNavy?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string>(() => (user ? readSeen(user.id) : new Date().toISOString()));
  const wrapRef = useRef<HTMLDivElement>(null);

  const candidate = Boolean(user && isUser(user.role));
  const recruiter = Boolean(user && isRecruiter(user.role));

  const myApplications = useQuery({
    queryKey: ["bell", "applications", user?.id],
    queryFn: () => fetchMyApplications({ page: 0, size: 8, userId: user!.id }),
    enabled: candidate,
    staleTime: 60_000,
  });

  const jobs = useQuery({
    queryKey: ["bell", "jobs", user?.id],
    queryFn: () => fetchRecruiterJobs({ page: 1, size: 5 }),
    enabled: recruiter,
    staleTime: 60_000,
  });
  const jobApps = useQueries({
    queries: (jobs.data?.items ?? []).map((job) => ({
      queryKey: ["bell", "job-applications", job.id],
      queryFn: () => fetchApplicationsByJob(job.id, { page: 1, size: 5 }),
      staleTime: 60_000,
    })),
  });

  const interviews = useQuery({
    queryKey: ["bell", "interviews", user?.id],
    queryFn: () => listInterviews(),
    enabled: Boolean(user && (candidate || recruiter)),
    staleTime: 60_000,
  });

  const items = useMemo<FeedItem[]>(() => {
    const feed: FeedItem[] = [];

    if (candidate) {
      for (const application of myApplications.data?.items ?? []) {
        feed.push({
          id: `app-${application.id}-${application.updatedAt}`,
          icon: "file",
          title: t("bell.applicationStatus", { status: STATUS_LABEL[application.status] }),
          body: application.jobTitle ?? t("bell.applicationBody"),
          href: `/applications/${application.id}`,
          at: application.updatedAt,
        });
      }
    }

    if (recruiter) {
      (jobs.data?.items ?? []).forEach((job, index) => {
        for (const application of jobApps[index]?.data?.items ?? []) {
          feed.push({
            id: `cand-${application.id}-${application.createdAt}`,
            icon: "users",
            title: t("bell.newApplication", { job: job.title }),
            body: application.applicantName || application.applicantEmail || t("recruiter.candidates.anonymous"),
            href: `/recruiter/jobs/${job.id}/applications`,
            at: application.createdAt,
          });
        }
      });
    }

    for (const interview of interviews.data ?? []) {
      feed.push({
        id: `interview-${interview.id}-${interview.createdAt}`,
        icon: "calendar",
        title: t("bell.interview", { job: interview.jobTitle }),
        body: `${timeLabel(interview.startsAtUtc)} · ${t(`interviews.mode.${interview.mode}`)}${
          interview.status === "cancelled" ? ` · ${t("bell.cancelled")}` : ""
        }`,
        href: recruiter ? "/recruiter/interviews" : "/interviews",
        at: interview.createdAt,
      });
    }

    return feed.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 12);
  }, [candidate, recruiter, myApplications.data, jobs.data, jobApps, interviews.data, t]);

  const unread = items.filter((item) => new Date(item.at).getTime() > new Date(seenAt).getTime()).length;

  // Close on an outside pointer or Escape, like a menu.
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      if (next && user) {
        const now = new Date().toISOString();
        setSeenAt(now);
        try {
          localStorage.setItem(SEEN_PREFIX + user.id, now);
        } catch {
          /* storage can be disabled */
        }
      }
      return next;
    });
  }

  if (!user) return null;

  return (
    <div className="jp-bell" ref={wrapRef}>
      <button
        type="button"
        className={cx("jp-bell-btn", onNavy && "on-navy")}
        aria-label={t("bell.label")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="jp-bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="jp-bell-pop" role="dialog" aria-label={t("bell.label")}>
          <header className="jp-bell-head">
            <strong>{t("bell.title")}</strong>
            <span>{t("bell.count", { count: items.length })}</span>
          </header>

          {items.length === 0 ? (
            <p className="jp-bell-empty">{t("bell.empty")}</p>
          ) : (
            <ul className="jp-bell-list">
              {items.map((item) => (
                <li key={item.id}>
                  <Link to={item.href} onClick={() => setOpen(false)}>
                    <span className="jp-bell-icon" aria-hidden="true">
                      <Icon name={item.icon} size={16} />
                    </span>
                    <span className="jp-bell-text">
                      <strong>{item.title}</strong>
                      {item.body && <span>{item.body}</span>}
                    </span>
                    <time dateTime={item.at}>{timeLabel(item.at)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
