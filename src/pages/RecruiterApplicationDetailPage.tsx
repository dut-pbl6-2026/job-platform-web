import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { ScoreReport } from "../components/ScoreReport";
import { CvViewer } from "../components/CvViewer";
import { EmailComposerDialog } from "../components/EmailComposerDialog";
import { InterviewDialog } from "../components/InterviewDialog";
import { Alert, BackLink, Button, Panel, SkeletonBlock, StatusMark } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fetchApplicationById, fetchStatusFlow, updateApplicationStatus } from "../lib/applicationsApi";
import { fetchJobById } from "../lib/jobsApi";
import { formatDate } from "../lib/dates";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import { STATUS_LABEL, type Application, type ApplicationStatus } from "../types/application";
import { showToast } from "../lib/toastBus";

/**
 * One application in full: the AI report behind the score, the cover letter, and the CV the candidate
 * submitted rendered by the browser's PDF viewer inside the page (no new tab). The table stays a
 * scanning surface; everything that needs reading lives here.
 */
export default function RecruiterApplicationDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [emailOpen, setEmailOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);

  const application = useQuery({
    queryKey: ["recruiter", "application", id],
    queryFn: () => fetchApplicationById(id, ""),
    enabled: !!id,
  });
  const job = useQuery({
    queryKey: ["job", application.data?.jobId ?? ""],
    queryFn: () => fetchJobById(application.data!.jobId),
    enabled: Boolean(application.data?.jobId),
    staleTime: 60_000,
  });
  const flow = useQuery({
    queryKey: ["applications", "status-flow"],
    queryFn: fetchStatusFlow,
    staleTime: 10 * 60_000,
  });

  const app = application.data;
  const name = app?.applicantName || app?.applicantEmail || t("recruiter.candidates.anonymous");
  useDocumentTitle(
    app
      ? `${name} — ${t("recruiter.applicationDetail.documentTitle")}`
      : t("recruiter.applicationDetail.documentTitle"),
  );

  const update = useMutation({
    mutationFn: ({ next }: { next: ApplicationStatus }) => updateApplicationStatus(id, next),
    onSuccess: (_data, vars) => {
      showToast({
        title: t("recruiter.applications.statusToast", { status: STATUS_LABEL[vars.next] }),
        kind: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "application", id] });
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "applications"] });
    },
  });

  const next = (flow.data?.[app?.status ?? "pending"] ?? []) as ApplicationStatus[];
  const scoreStatus = (app?.scoringStatus ?? "").toLowerCase();

  return (
    <RecruiterShell
      title={name}
      lead={
        app
          ? t("recruiter.applicationDetail.lead", {
              job: job.data?.title ?? t("recruiter.applicationDetail.jobFallback"),
              date: formatDate(app.createdAt),
            })
          : undefined
      }
      back={
        <BackLink to={app ? `/recruiter/jobs/${app.jobId}/applications` : "/recruiter/jobs"}>
          {t("recruiter.applicationDetail.back")}
        </BackLink>
      }
      actions={
        app ? (
          <>
            <Button variant="secondary" icon="mail" onClick={() => setEmailOpen(true)}>
              {t("recruiter.applications.email")}
            </Button>
            <Button variant="secondary" icon="calendar" onClick={() => setInterviewOpen(true)}>
              {t("recruiter.applications.schedule")}
            </Button>
          </>
        ) : undefined
      }
    >
      {application.isPending && <SkeletonBlock height={360} label={t("recruiter.applicationDetail.loading")} />}
      {application.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={application.isFetching} onClick={() => void application.refetch()}>
              {t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(application.error, t("recruiter.applicationDetail.loadWhat"))}
        </Alert>
      )}
      {app === null && !application.isError && (
        <Alert tone="warning">{t("recruiter.applicationDetail.notFound")}</Alert>
      )}

      {app && (
        <div className="jp-app-detail">
          <div className="jp-app-detail-bar">
            <StatusMark tone={app.status === "rejected" ? "danger" : app.status === "accepted" ? "success" : "info"}>
              {STATUS_LABEL[app.status]}
            </StatusMark>
            <span className="jp-apps-email">{app.applicantEmail ?? ""}</span>
            {next.length > 0 ? (
              <form
                className="jp-apps-status"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const value = String(form.get("next") ?? "") as ApplicationStatus;
                  if (value) update.mutate({ next: value });
                }}
              >
                <label className="jp-sr-only" htmlFor="detail-next">
                  {t("recruiter.applications.updateStatusLabel")}
                </label>
                <select id="detail-next" name="next" className="jp-input" defaultValue="" required>
                  <option value="" disabled>
                    {t("recruiter.applications.chooseNext")}
                  </option>
                  {next.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" loading={update.isPending}>
                  {t("recruiter.applications.update")}
                </Button>
              </form>
            ) : (
              <span className="jp-muted">{t("recruiter.applications.ended")}</span>
            )}
          </div>

          {update.isError && (
            <Alert tone="error">
              {httpStatus(update.error) === 409
                ? t("recruiter.applications.statusChanged")
                : apiErrorMessage(update.error, t("recruiter.applications.updateFailed"))}
            </Alert>
          )}

          <div className="jp-app-detail-grid">
            <div className="jp-app-detail-col">
              <Panel title={t("recruiter.applicationDetail.coverTitle")}>
                {app.coverLetter ? (
                  <p className="jp-app-cover">{app.coverLetter}</p>
                ) : (
                  <p className="jp-muted">{t("recruiter.applicationDetail.coverEmpty")}</p>
                )}
              </Panel>

              <Panel title={t("recruiter.applicationDetail.cvTitle")}>
                {app.cvUrl ? (
                  <CvViewer cvUrl={app.cvUrl} fileName={app.cvFileName} />
                ) : (
                  <p className="jp-muted">{t("recruiter.applicationDetail.cvEmpty")}</p>
                )}
              </Panel>
            </div>

            <div className="jp-app-detail-col">
              <Panel title={t("recruiter.applicationDetail.scoreTitle")}>
                <p className="jp-muted jp-score-note">{t("recruiter.applications.scoreNote")}</p>
                {app.scoreDetail ? (
                  <ScoreReport detail={app.scoreDetail} showSuggestions={false} />
                ) : scoreStatus === "failed" ? (
                  <Alert tone="warning">{t("recruiter.applicationDetail.scoreFailed")}</Alert>
                ) : (
                  <Alert tone="info">
                    {scoreStatus === "done"
                      ? t("recruiter.applicationDetail.scoreNoDetail")
                      : t("recruiter.applicationDetail.scorePending")}
                  </Alert>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}

      <EmailComposerDialog
        open={emailOpen}
        application={app as Application | null}
        onClose={() => setEmailOpen(false)}
        onSent={() => showToast({ title: t("recruiter.email.sent"), kind: "success" })}
      />
      <InterviewDialog
        open={interviewOpen}
        application={app as Application | null}
        onClose={() => setInterviewOpen(false)}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ["recruiter", "interviews"] })}
      />
    </RecruiterShell>
  );
}
