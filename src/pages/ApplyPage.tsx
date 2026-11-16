import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  BackLink,
  Board,
  Button,
  ButtonLink,
  EmptyState,
  Field,
  Icon,
  JobRow,
  PageHead,
  Panel,
  SkeletonBlock,
  Textarea,
  cx,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { fetchJobById } from "../lib/jobsApi";
import { CV_ACCEPT, submitApplication, validateCvFile } from "../lib/applicationsApi";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

// Internal signal only: the page renders its own translated copy for this case, so the message is not shown.
class JobNotFoundError extends Error {
  constructor() {
    super("Job not found or removed.");
  }
}

const COVER_MAX = 4000;

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("vi-VN")} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} MB`;
}

type SubmitError = { message: string; duplicate: boolean };

export default function ApplyPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const pickRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState("");
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<SubmitError | null>(null);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sent, setSent] = useState<{ fileName: string } | null>(null);

  // Same key as the detail page: arriving from there reuses the loaded job.
  // A failed load (network, 5xx) is not "job not found": fetchJobById returns null only on 404.
  const jobQuery = useQuery({
    queryKey: queryKeys.job(id || ""),
    queryFn: async () => {
      const found = await fetchJobById(id!);
      if (!found) throw new JobNotFoundError();
      return found;
    },
    enabled: !!id,
    retry: (count, e) => !(e instanceof JobNotFoundError) && count < 1,
  });
  const job = jobQuery.data;
  const notFound = jobQuery.error instanceof JobNotFoundError;
  const loadErr = !jobQuery.isError || notFound ? null : loadErrorMessage(jobQuery.error, t("apply.loadWhat"));

  useDocumentTitle(job ? t("apply.documentTitleWithJob", { title: job.title }) : t("apply.documentTitle"));

  // The success screen replaces the form: move focus to its heading so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  if (!isAuthenticated) return null;

  const jobHref = `/jobs/${id}`;

  if (!isUser(user?.role)) {
    return (
      <>
        <main className="jp-page jp-page--narrow">
          <BackLink to={jobHref}>{t("apply.backToJobShort")}</BackLink>
          <Alert tone="error">{t("apply.notCandidate")}</Alert>
        </main>
      </>
    );
  }

  if (jobQuery.isPending) {
    return (
      <>
        <main className="jp-page jp-apply">
          <BackLink to={jobHref}>{t("apply.backToJob")}</BackLink>
          <SkeletonBlock height={420} label={t("apply.loading")} />
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <main className="jp-page jp-page--narrow">
          <EmptyState
            title={t("jobs.detail.notFound")}
            action={<ButtonLink to="/jobs">{t("jobs.detail.viewBoard")}</ButtonLink>}
          />
        </main>
      </>
    );
  }

  if (loadErr || !job) {
    return (
      <>
        <main className="jp-page jp-page--narrow">
          <BackLink to={jobHref}>{t("apply.backToJob")}</BackLink>
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={jobQuery.isFetching} onClick={() => void jobQuery.refetch()}>
                {jobQuery.isFetching ? t("jobs.retrying") : t("jobs.retry")}
              </Button>
            }
          >
            {loadErr ?? t("apply.loadFallback")}
          </Alert>
        </main>
      </>
    );
  }

  const currentJob = job;

  function pick(f: File | null) {
    setFile(f);
    setFileErr(f ? validateCvFile(f) : null);
    setSubmitErr(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pick(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitErr(null);
    const fe = validateCvFile(file);
    setFileErr(fe);
    if (fe || !file || !user) {
      if (fe) dropRef.current?.focus();
      return;
    }
    setSending(true);
    try {
      await submitApplication({
        jobId: currentJob.id,
        coverLetter: cover.trim() || undefined,
        cvFile: file,
        applicantId: user.id,
      });
      setSent({ fileName: file.name });
    } catch (ex: unknown) {
      if (httpStatus(ex) === 409) {
        setSubmitErr({ message: t("apply.duplicate"), duplicate: true });
      } else {
        setSubmitErr({ message: apiErrorMessage(ex, t("apply.submitFailed")), duplicate: false });
      }
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <>
        <main className="jp-page jp-page--narrow">
          <Panel className="jp-apply-done">
            <Icon name="checkCircle" size={32} className="jp-apply-done-icon" />
            <h1 className="jp-h1" ref={doneRef} tabIndex={-1}>
              {t("apply.doneTitle")}
            </h1>
            <dl className="jp-apply-sent">
              <div>
                <dt>{t("apply.position")}</dt>
                <dd>{currentJob.title}</dd>
              </div>
              <div>
                <dt>{t("apply.company")}</dt>
                <dd>{currentJob.company.name}</dd>
              </div>
              <div>
                <dt>{t("apply.cvSent")}</dt>
                <dd>{sent.fileName}</dd>
              </div>
            </dl>
            <p className="jp-muted">{t("apply.doneNote")}</p>
            <div className="jp-apply-done-actions">
              <ButtonLink to="/applications">{t("apply.viewMyApplications")}</ButtonLink>
              <ButtonLink variant="secondary" to="/jobs">
                {t("apply.findOthers")}
              </ButtonLink>
            </div>
          </Panel>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="jp-page jp-apply">
        <PageHead
          back={<BackLink to={jobHref}>{t("apply.backToJob")}</BackLink>}
          title={t("apply.pageTitle")}
          lead={t("apply.lead")}
        />

        <Board label={t("apply.jobBoardLabel")} className="jp-apply-job">
          <JobRow job={currentJob} static />
        </Board>

        <form className="jp-panel jp-apply-form" onSubmit={onSubmit} noValidate>
          {submitErr && (
            <Alert
              tone="error"
              action={
                submitErr.duplicate ? (
                  <ButtonLink variant="secondary" to="/applications">
                    {t("apply.viewSubmitted")}
                  </ButtonLink>
                ) : undefined
              }
            >
              {submitErr.message}
            </Alert>
          )}

          <ol className="jp-steps">
            <li className="jp-step">
              <span className="jp-step-no" aria-hidden="true">
                1
              </span>
              <div className="jp-step-body">
                <Field id="apply-cv" label={t("apply.cvLabel")} required hint={t("apply.cvHint")} error={fileErr}>
                  <button
                    ref={dropRef}
                    type="button"
                    className={cx("jp-drop", dragging && "is-dragging", fileErr && "is-error", file && "has-file")}
                    onClick={() => pickRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                  >
                    {file ? (
                      <>
                        <Icon name="file" size={24} />
                        <span className="jp-drop-text">
                          <strong>{file.name}</strong>
                          <span>{t("apply.changeFile", { size: fileSize(file.size) })}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Icon name="upload" size={24} />
                        <span className="jp-drop-text">
                          <strong>{t("apply.chooseCv")}</strong>
                          <span>{t("apply.dropHint")}</span>
                        </span>
                      </>
                    )}
                  </button>
                </Field>
                <input
                  ref={pickRef}
                  type="file"
                  accept={CV_ACCEPT}
                  hidden
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    pick(e.target.files?.[0] ?? null);
                    // Picking the same file again after a rejection must still fire onChange.
                    e.target.value = "";
                  }}
                />
                {file && (
                  <Button variant="ghost" size="sm" icon="trash" onClick={() => pick(null)}>
                    {t("apply.removeFile")}
                  </Button>
                )}
              </div>
            </li>

            <li className="jp-step">
              <span className="jp-step-no" aria-hidden="true">
                2
              </span>
              <div className="jp-step-body">
                <Field
                  id="apply-cover"
                  label={t("apply.coverLabel")}
                  optional
                  hint={t("apply.coverCounter", {
                    length: cover.length.toLocaleString("vi-VN"),
                    max: COVER_MAX.toLocaleString("vi-VN"),
                  })}
                >
                  <Textarea
                    rows={6}
                    maxLength={COVER_MAX}
                    placeholder={t("apply.coverPlaceholder")}
                    value={cover}
                    onChange={(e) => setCover(e.target.value)}
                  />
                </Field>
              </div>
            </li>

            <li className="jp-step">
              <span className="jp-step-no" aria-hidden="true">
                3
              </span>
              <div className="jp-step-body">
                <p className="jp-step-title">{t("apply.submitStep")}</p>
                <Button type="submit" size="lg" loading={sending} className="jp-apply-submit">
                  {sending ? t("apply.submitting") : t("apply.submit")}
                </Button>
              </div>
            </li>
          </ol>
        </form>
      </main>
    </>
  );
}
