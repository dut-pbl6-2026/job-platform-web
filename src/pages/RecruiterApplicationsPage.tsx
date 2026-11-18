import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { EmailComposerDialog } from "../components/EmailComposerDialog";
import { InterviewDialog } from "../components/InterviewDialog";
import {
  Alert,
  BackLink,
  Button,
  ButtonLink,
  EmptyState,
  FilterChip,
  Pagination,
  SkeletonRows,
  StatusMark,
} from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fetchApplicationsByJob, fetchStatusFlow, updateApplicationStatus } from "../lib/applicationsApi";
import { formatDate } from "../lib/dates";
import { httpStatus, loadErrorMessage, apiErrorMessage } from "../lib/http";
import { fetchJobById } from "../lib/jobsApi";
import { queryKeys } from "../lib/queryClient";
import { showToast } from "../lib/toastBus";
import { APPLICATION_STATUSES, STATUS_LABEL, type Application, type ApplicationStatus } from "../types/application";

const PAGE_SIZE = 20;

function parseStatus(raw: string | null): ApplicationStatus | "" {
  return (APPLICATION_STATUSES as string[]).includes(raw ?? "") ? (raw as ApplicationStatus) : "";
}

/** Null scores read by scoringStatus; never invent a number for an applicant who has none yet. */
function scoreText(app: { score?: number | null; scoringStatus?: string | null }): {
  value: string;
  muted: boolean;
} {
  if (typeof app.score === "number" && Number.isFinite(app.score)) {
    return { value: String(Math.round(app.score)), muted: false };
  }
  const status = (app.scoringStatus ?? "").toLowerCase();
  if (status === "pending" || status === "processing")
    return { value: i18n.t("recruiter.applications.scorePending"), muted: true };
  if (status === "failed") return { value: i18n.t("recruiter.applications.scoreFailed"), muted: true };
  return { value: i18n.t("recruiter.applications.scoreNone"), muted: true };
}

/**
 * Applications for one job, as a table. A row carries the parts a recruiter scans (who, when, score,
 * status) and links to the application page for the cover letter, the submitted CV and the full AI
 * report. Ids are never shown.
 */
export default function RecruiterApplicationsPage() {
  const { t } = useTranslation();
  const { jobId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const status = parseStatus(params.get("status"));
  const page = Math.max(1, Number(params.get("page")) || 1);
  useDocumentTitle(t("recruiter.documentTitles.applications"));
  const [emailFor, setEmailFor] = useState<Application | null>(null);
  const [interviewFor, setInterviewFor] = useState<Application | null>(null);

  const job = useQuery({
    queryKey: queryKeys.job(jobId),
    queryFn: () => fetchJobById(jobId),
    enabled: !!jobId,
    staleTime: 60_000,
  });
  const flow = useQuery({
    queryKey: ["applications", "status-flow"],
    queryFn: fetchStatusFlow,
    staleTime: 10 * 60_000,
  });
  const list = useQuery({
    queryKey: ["recruiter", "applications", jobId, status, page],
    queryFn: () => fetchApplicationsByJob(jobId, { page, size: PAGE_SIZE, status: status || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ApplicationStatus }) => updateApplicationStatus(id, next),
    onSuccess: (_data, vars) => {
      showToast({
        title: t("recruiter.applications.statusToast", { status: STATUS_LABEL[vars.next] }),
        kind: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "applications", jobId] });
    },
  });

  function patch(next: { status?: ApplicationStatus | ""; page?: number }) {
    const merged = new URLSearchParams(params);
    if (next.status !== undefined) {
      if (next.status) merged.set("status", next.status);
      else merged.delete("status");
      merged.delete("page");
    }
    if (next.page !== undefined) {
      if (next.page > 1) merged.set("page", String(next.page));
      else merged.delete("page");
    }
    setParams(merged);
  }

  function errorFor(e: unknown): string {
    // 409: the status changed on the server since this list loaded. The backend message is English, so it is not shown.
    if (httpStatus(e) === 409) return t("recruiter.applications.statusChanged");
    return apiErrorMessage(e, t("recruiter.applications.updateFailed"));
  }

  const data = list.data;
  const flowMap = flow.data ?? {};
  const title = job.data?.title
    ? t("recruiter.applications.titleWithJob", { title: job.data.title })
    : t("recruiter.applications.title");

  return (
    <RecruiterShell
      title={title}
      lead={t("recruiter.applications.lead")}
      back={<BackLink to="/recruiter/jobs">{t("recruiter.applications.back")}</BackLink>}
    >
      <div className="jp-recruiter-filters" role="group" aria-label={t("recruiter.applications.filterGroup")}>
        <FilterChip pressed={status === ""} onClick={() => patch({ status: "" })}>
          {t("applications.all")}
        </FilterChip>
        {APPLICATION_STATUSES.map((s) => (
          <FilterChip key={s} pressed={status === s} onClick={() => patch({ status: s })}>
            {STATUS_LABEL[s]}
          </FilterChip>
        ))}
      </div>

      <p className="jp-muted jp-score-note">{t("recruiter.applications.scoreNote")}</p>

      {update.isError && <Alert tone="error">{errorFor(update.error)}</Alert>}

      {list.isPending && <SkeletonRows rows={5} label={t("recruiter.applications.loading")} />}

      {list.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={list.isFetching} onClick={() => void list.refetch()}>
              {list.isFetching ? t("jobs.retrying") : t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(list.error, t("recruiter.applications.loadWhat"))}
        </Alert>
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title={status ? t("recruiter.applications.emptyFiltered") : t("recruiter.applications.emptyNone")}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="jp-table-wrap jp-apps-wrap">
            <table className="jp-table jp-apps-table">
              <caption className="jp-sr-only">{t("recruiter.applications.tableLabel")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("recruiter.applications.colCandidate")}</th>
                  <th scope="col">{t("recruiter.applications.colDate")}</th>
                  <th scope="col">{t("recruiter.applications.colScore")}</th>
                  <th scope="col">{t("recruiter.applications.colStatus")}</th>
                  <th scope="col">
                    <span className="jp-sr-only">{t("recruiter.applications.colActions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((app) => {
                  const next = (flowMap[app.status] ?? []) as ApplicationStatus[];
                  const score = scoreText(app);
                  const name = app.applicantName || app.applicantEmail;
                  return (
                    <tr
                      key={app.id}
                      onClick={(event) => {
                        // The row opens the application; the identity cell and the controls keep their own targets.
                        if ((event.target as HTMLElement).closest("a,button,select,input,label")) return;
                        navigate(`/recruiter/applications/${app.id}`);
                      }}
                    >
                      <td className="jp-apps-candidate">
                        <div className="jp-apps-id">
                          <Link
                            className="jp-apps-avatar"
                            to={`/candidates/${app.applicantId}`}
                            aria-label={t("recruiter.applications.profileLink", { name: name || "" })}
                          >
                            {(name || "?").trim().charAt(0).toUpperCase()}
                          </Link>
                          <span className="jp-apps-id-text">
                            <Link className="jp-apps-name" to={`/candidates/${app.applicantId}`}>
                              {name || t("recruiter.candidates.anonymous")}
                            </Link>
                            {app.applicantName && app.applicantEmail && (
                              <span className="jp-apps-email">{app.applicantEmail}</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="jp-apps-date">{formatDate(app.createdAt)}</td>
                      <td>
                        <Link
                          className={score.muted ? "jp-match-score is-muted" : "jp-match-score"}
                          to={`/recruiter/applications/${app.id}`}
                          aria-label={t("recruiter.applications.scoreLink", { name: name || "" })}
                        >
                          <span className="jp-match-score-label">{t("recruiter.applications.scoreShort")}</span>
                          <span className={score.muted ? "jp-match-score-value is-muted" : "jp-match-score-value"}>
                            {score.value}
                          </span>
                        </Link>
                      </td>
                      <td>
                        {next.length > 0 ? (
                          <form
                            className="jp-apps-status"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = new FormData(e.currentTarget);
                              const value = String(form.get("next") ?? "") as ApplicationStatus;
                              if (value) update.mutate({ id: app.id, next: value });
                            }}
                          >
                            <label className="jp-sr-only" htmlFor={`next-${app.id}`}>
                              {t("recruiter.applications.updateStatusLabel")}
                            </label>
                            <select id={`next-${app.id}`} name="next" className="jp-input" defaultValue="" required>
                              <option value="" disabled>
                                {t("recruiter.applications.chooseNext")}
                              </option>
                              {next.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="submit"
                              size="sm"
                              loading={update.isPending && update.variables?.id === app.id}
                            >
                              {t("recruiter.applications.update")}
                            </Button>
                          </form>
                        ) : (
                          <StatusMark tone={app.status === "rejected" ? "danger" : "success"}>
                            {STATUS_LABEL[app.status]}
                          </StatusMark>
                        )}
                      </td>
                      <td className="jp-apps-actions">
                        <ButtonLink to={`/recruiter/applications/${app.id}`} variant="secondary" size="sm" icon="file">
                          {t("recruiter.applications.open")}
                        </ButtonLink>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="mail"
                          title={t("recruiter.applications.email")}
                          aria-label={t("recruiter.email.title")}
                          onClick={() => setEmailFor(app)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="calendar"
                          title={t("recruiter.applications.schedule")}
                          aria-label={t("recruiter.interview.title")}
                          onClick={() => setInterviewFor(app)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page - 1} totalPages={data.totalPages} onPage={(p) => patch({ page: p + 1 })} />
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
