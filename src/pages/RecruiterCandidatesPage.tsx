import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { EmailComposerDialog } from "../components/EmailComposerDialog";
import { InterviewDialog } from "../components/InterviewDialog";
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  Icon,
  Panel,
  SkeletonRows,
  SkeletonBlock,
  StatusMark,
  cx,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fetchApplicationsByJob, fetchStatusFlow, updateApplicationStatus } from "../lib/applicationsApi";
import { formatDate } from "../lib/dates";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import { fetchRecruiterJobs } from "../lib/jobsApi";
import { showToast } from "../lib/toastBus";
import { APPLICATION_STATUSES, STATUS_LABEL, type Application, type ApplicationStatus } from "../types/application";

const COLUMN_COLORS: Record<ApplicationStatus, string> = {
  pending: "var(--c-amber)",
  reviewed: "var(--c-navy)",
  shortlisted: "var(--c-navy-line)",
  accepted: "var(--c-success)",
  rejected: "var(--c-danger)",
};

const PAGE_SIZE = 100;

/**
 * The candidate pipeline for one job: five status columns, drag a card to a column (or use its move
 * menu) to advance it through the same state machine the backend enforces. Cards carry the actions a
 * recruiter needs next: email the candidate or schedule an interview.
 */
export default function RecruiterCandidatesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useDocumentTitle(t("recruiter.documentTitles.candidates"));
  const [params, setParams] = useSearchParams();
  const [emailFor, setEmailFor] = useState<Application | null>(null);
  const [interviewFor, setInterviewFor] = useState<Application | null>(null);
  const [dragging, setDragging] = useState<Application | null>(null);
  // A drag that ends over a column must not also count as a click on the card.
  const draggedRef = useRef(false);
  const [hover, setHover] = useState<ApplicationStatus | null>(null);

  const jobs = useQuery({
    queryKey: ["recruiter", "jobs", "pipeline", user?.id],
    queryFn: () => fetchRecruiterJobs({ page: 1, size: 100 }),
    staleTime: 30_000,
  });
  const jobList = jobs.data?.items ?? [];
  const requested = params.get("job");

  // With no explicit job in the URL, open the first job that actually has applicants instead of an
  // arbitrary newest one that may have an empty board. One tiny request per job, cached for 5 minutes.
  const jobIds = jobList.map((job) => job.id).join(",");
  const bestJob = useQuery({
    queryKey: ["recruiter", "pipeline", "best-job", jobIds],
    queryFn: async () => {
      for (const job of jobList) {
        const page = await fetchApplicationsByJob(job.id, { page: 1, size: 1 });
        if (page.total > 0) return job.id;
      }
      return jobList[0]?.id ?? "";
    },
    enabled: jobList.length > 0 && !requested,
    staleTime: 5 * 60_000,
  });

  const selectedJob =
    jobList.find((job) => job.id === requested) ?? jobList.find((job) => job.id === bestJob.data) ?? jobList[0];

  const flow = useQuery({
    queryKey: ["applications", "status-flow"],
    queryFn: fetchStatusFlow,
    staleTime: 10 * 60_000,
  });

  const list = useQuery({
    queryKey: ["recruiter", "pipeline", selectedJob?.id, "all"],
    queryFn: () => fetchApplicationsByJob(selectedJob!.id, { page: 1, size: PAGE_SIZE }),
    enabled: Boolean(selectedJob?.id),
    staleTime: 0,
  });

  const move = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ApplicationStatus }) => updateApplicationStatus(id, next),
    onSuccess: (_data, vars) => {
      showToast({
        title: t("recruiter.candidates.moved", { status: STATUS_LABEL[vars.next] }),
        kind: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "pipeline", selectedJob?.id] });
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "applications"] });
    },
    onError: (error: unknown) => {
      showToast({
        title:
          httpStatus(error) === 409
            ? t("recruiter.candidates.stale")
            : apiErrorMessage(error, t("recruiter.candidates.moveFailed")),
        kind: "error",
      });
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "pipeline", selectedJob?.id] });
    },
  });

  const applications = list.data?.items ?? [];
  const flowMap = flow.data ?? {};
  const grouped = useMemo(() => {
    const map: Record<ApplicationStatus, Application[]> = {
      pending: [],
      reviewed: [],
      shortlisted: [],
      accepted: [],
      rejected: [],
    };
    for (const application of applications) map[application.status].push(application);
    return map;
  }, [applications]);

  const total = applications.length;
  const recentCount = applications.filter((application) => {
    const day = new Date(application.createdAt).getTime();
    return Date.now() - day < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const interviewing = grouped.shortlisted.length + grouped.accepted.length;

  function selectJob(id: string) {
    const merged = new URLSearchParams(params);
    merged.set("job", id);
    setParams(merged, { replace: true });
  }

  function canMove(application: Application, next: ApplicationStatus): boolean {
    return (flowMap[application.status] ?? []).includes(next);
  }

  function drop(status: ApplicationStatus) {
    setHover(null);
    if (!dragging) return;
    const application = dragging;
    setDragging(null);
    if (application.status === status || !canMove(application, status)) return;
    move.mutate({ id: application.id, next: status });
  }

  return (
    <RecruiterShell
      title={t("recruiter.candidates.title")}
      lead={t("recruiter.candidates.lead")}
      actions={
        <ButtonLink to="/recruiter/jobs?new=1" icon="plus">
          {t("recruiter.jobs.newJob")}
        </ButtonLink>
      }
    >
      {jobs.isPending && <SkeletonBlock height={120} label={t("recruiter.candidates.loadingJobs")} />}
      {jobs.isError && <Alert tone="error">{loadErrorMessage(jobs.error, t("recruiter.candidates.loadWhat"))}</Alert>}

      {jobs.data && jobList.length === 0 && (
        <EmptyState
          title={t("recruiter.candidates.noJobs")}
          action={<ButtonLink to="/recruiter/jobs?new=1">{t("recruiter.jobs.newJob")}</ButtonLink>}
        >
          {t("recruiter.candidates.noJobsText")}
        </EmptyState>
      )}

      {jobList.length > 0 && (
        <>
          <div className="jp-pipeline-bar">
            <label className="jp-pipeline-select" htmlFor="pipeline-job">
              <span>{t("recruiter.candidates.jobLabel")}</span>
              <select
                id="pipeline-job"
                className="jp-input"
                value={selectedJob?.id ?? ""}
                onChange={(event) => selectJob(event.target.value)}
              >
                {jobList.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="jp-pipeline-stats">
              <span>
                <strong>{total}</strong> {t("recruiter.candidates.statTotal")}
              </span>
              <span>
                <strong>{recentCount}</strong> {t("recruiter.candidates.statNew")}
              </span>
              <span>
                <strong>{interviewing}</strong> {t("recruiter.candidates.statInterview")}
              </span>
            </div>
          </div>

          <Panel title={t("recruiter.candidates.pipelineTitle")}>
            <p className="jp-dash-note">{t("recruiter.candidates.pipelineLead")}</p>
            <div className="jp-pipe" role="img" aria-label={t("recruiter.candidates.pipelineAria", { total })}>
              {APPLICATION_STATUSES.map((status) => {
                const count = grouped[status].length;
                const width = total > 0 ? Math.max(count > 0 ? 4 : 0, Math.round((count / total) * 100)) : 0;
                return (
                  <span
                    key={status}
                    className="jp-pipe-seg"
                    style={{ width: `${width}%`, background: COLUMN_COLORS[status] }}
                    title={`${STATUS_LABEL[status]}: ${count}`}
                  />
                );
              })}
            </div>
            <ul className="jp-pipe-legend">
              {APPLICATION_STATUSES.map((status) => (
                <li key={status}>
                  <i style={{ background: COLUMN_COLORS[status] }} aria-hidden="true" />
                  {STATUS_LABEL[status]} <strong>{grouped[status].length}</strong>
                </li>
              ))}
            </ul>
          </Panel>

          {list.isPending && <SkeletonRows rows={4} label={t("recruiter.candidates.loading")} />}
          {list.isError && (
            <Alert
              tone="error"
              action={
                <Button variant="secondary" loading={list.isFetching} onClick={() => void list.refetch()}>
                  {list.isFetching ? t("jobs.retrying") : t("jobs.retry")}
                </Button>
              }
            >
              {loadErrorMessage(list.error, t("recruiter.candidates.loadWhat"))}
            </Alert>
          )}

          {list.data && total === 0 && (
            <EmptyState title={t("recruiter.candidates.empty")}>{t("recruiter.candidates.emptyText")}</EmptyState>
          )}

          {total > 0 && (
            <div className="jp-kanban" role="list" aria-label={t("recruiter.candidates.boardLabel")}>
              {APPLICATION_STATUSES.map((status) => (
                <section
                  key={status}
                  role="listitem"
                  className={cx("jp-kanban-col", hover === status && "is-hover", `is-${status}`)}
                  aria-label={t("recruiter.candidates.columnLabel", {
                    status: STATUS_LABEL[status],
                    count: grouped[status].length,
                  })}
                  onDragOver={(event) => {
                    if (!dragging) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setHover(status);
                  }}
                  onDragLeave={() => setHover((current) => (current === status ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    drop(status);
                  }}
                >
                  <header className="jp-kanban-head">
                    <span className="jp-kanban-dot" style={{ background: COLUMN_COLORS[status] }} aria-hidden="true" />
                    <h2>{STATUS_LABEL[status]}</h2>
                    <span className="jp-kanban-count">{grouped[status].length}</span>
                  </header>

                  <div className="jp-kanban-list">
                    {grouped[status].map((application) => {
                      const next = flowMap[application.status] ?? [];
                      const name = application.applicantName || application.applicantEmail;
                      return (
                        <article
                          key={application.id}
                          className={cx("jp-cand-card", dragging?.id === application.id && "is-dragging")}
                          draggable={next.length > 0}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", application.id);
                            draggedRef.current = true;
                            setDragging(application);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setHover(null);
                            // Some browsers emit a click just after a drag; keep suppressing it briefly.
                            window.setTimeout(() => {
                              draggedRef.current = false;
                            }, 300);
                          }}
                          onClick={(event) => {
                            // A card opens the application page; the identity links and its controls keep their own targets.
                            if (draggedRef.current) {
                              draggedRef.current = false;
                              return;
                            }
                            if ((event.target as HTMLElement).closest("a,button,select,input,label")) return;
                            navigate(`/recruiter/applications/${application.id}`);
                          }}
                        >
                          <div className="jp-cand-top">
                            <Link
                              className="jp-cand-avatar"
                              to={`/candidates/${application.applicantId}`}
                              aria-label={t("recruiter.candidates.profileLink", { name: name || "" })}
                            >
                              {(name || "?").trim().charAt(0).toUpperCase()}
                            </Link>
                            <div className="jp-cand-id">
                              <Link className="jp-cand-name" to={`/candidates/${application.applicantId}`}>
                                {name || t("recruiter.candidates.anonymous")}
                              </Link>
                              {application.applicantEmail && application.applicantName && (
                                <span>{application.applicantEmail}</span>
                              )}
                            </div>
                            {typeof application.score === "number" && (
                              <span className="jp-cand-score" title={t("recruiter.candidates.scoreTitle")}>
                                {Math.round(application.score)}
                              </span>
                            )}
                          </div>

                          <p className="jp-cand-meta">
                            <span>
                              <Icon name="clock" size={13} />
                              {formatDate(application.createdAt)}
                            </span>
                            {application.coverLetter && (
                              <span title={application.coverLetter}>
                                <Icon name="file" size={13} />
                                {t("recruiter.candidates.hasLetter")}
                              </span>
                            )}
                          </p>

                          <div className="jp-cand-actions">
                            <button
                              type="button"
                              className="jp-icon-btn"
                              title={t("recruiter.email.title")}
                              aria-label={t("recruiter.candidates.emailAria", { name: name || "" })}
                              onClick={() => setEmailFor(application)}
                            >
                              <Icon name="mail" size={16} />
                            </button>
                            <button
                              type="button"
                              className="jp-icon-btn"
                              title={t("recruiter.interview.title")}
                              aria-label={t("recruiter.candidates.scheduleAria", { name: name || "" })}
                              onClick={() => setInterviewFor(application)}
                            >
                              <Icon name="calendar" size={16} />
                            </button>
                            <Link
                              className="jp-icon-btn"
                              title={t("recruiter.candidates.openApplication")}
                              aria-label={t("recruiter.candidates.openApplication")}
                              to={`/recruiter/applications/${application.id}`}
                            >
                              <Icon name="file" size={16} />
                            </Link>
                            <Link
                              className="jp-icon-btn"
                              title={t("recruiter.candidates.openJob")}
                              aria-label={t("recruiter.candidates.openJob")}
                              to={`/recruiter/jobs/${application.jobId}/applications`}
                            >
                              <Icon name="external" size={16} />
                            </Link>
                          </div>

                          {next.length === 0 && (
                            <StatusMark tone={application.status === "rejected" ? "danger" : "success"}>
                              {t("recruiter.candidates.closed")}
                            </StatusMark>
                          )}
                        </article>
                      );
                    })}

                    {grouped[status].length === 0 && (
                      <p className="jp-kanban-empty">{t("recruiter.candidates.columnEmpty")}</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <EmailComposerDialog
        open={Boolean(emailFor)}
        application={emailFor}
        onClose={() => setEmailFor(null)}
        onSent={() => showToast({ title: t("recruiter.email.sent"), kind: "success" })}
      />
      <InterviewDialog
        open={Boolean(interviewFor)}
        application={interviewFor}
        onClose={() => setInterviewFor(null)}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ["recruiter", "interviews"] })}
      />
    </RecruiterShell>
  );
}
