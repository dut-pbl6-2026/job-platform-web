import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  BackLink,
  Board,
  Button,
  ButtonLink,
  Checkbox,
  EmptyState,
  Field,
  Icon,
  JobRow,
  PageHead,
  Panel,
  SkeletonBlock,
  StatusMark,
  Textarea,
  WizardSteps,
  cx,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { fetchJobById } from "../lib/jobsApi";
import { CV_ACCEPT, submitApplication, validateCvFile } from "../lib/applicationsApi";
import { fetchMyProfile } from "../lib/profileApi";
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
const LAST_STEP = 2;

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("vi-VN")} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} MB`;
}

type SubmitError = { message: string; duplicate: boolean };

/**
 * Applying is three short steps instead of one long form: check the profile that recruiters receive,
 * attach a CV and an optional note, then review and send. The profile step is explicit because the
 * application carries the candidate's profile into the recruiter's pipeline; it is not optional data.
 */
export default function ApplyPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const pickRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [profileReviewed, setProfileReviewed] = useState(false);
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

  const profile = useQuery({
    queryKey: queryKeys.profile(user?.id ?? ""),
    queryFn: () => fetchMyProfile(user!.id, user!.fullName),
    enabled: !!user && isUser(user.role),
    staleTime: 30_000,
  });

  useDocumentTitle(job ? t("apply.documentTitleWithJob", { title: job.title }) : t("apply.documentTitle"));

  // The success screen replaces the form: move focus to its heading so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  // Each step is a new screen: move focus to its heading rather than leaving it on the button just pressed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: step is the trigger; the effect only moves focus.
  useEffect(() => {
    if (!sent) stepRef.current?.focus();
  }, [step, sent]);

  if (!isAuthenticated) return null;

  const jobHref = `/jobs/${id}`;

  if (!isUser(user?.role)) {
    return (
      <main className="jp-page jp-page--narrow">
        <BackLink to={jobHref}>{t("apply.backToJobShort")}</BackLink>
        <Alert tone="error">{t("apply.notCandidate")}</Alert>
      </main>
    );
  }

  if (jobQuery.isPending) {
    return (
      <main className="jp-page jp-apply">
        <BackLink to={jobHref}>{t("apply.backToJob")}</BackLink>
        <SkeletonBlock height={420} label={t("apply.loading")} />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="jp-page jp-page--narrow">
        <EmptyState
          title={t("jobs.detail.notFound")}
          action={<ButtonLink to="/jobs">{t("jobs.detail.viewBoard")}</ButtonLink>}
        />
      </main>
    );
  }

  if (loadErr || !job) {
    return (
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
    );
  }

  const currentJob = job;
  const steps = [
    { title: t("apply.wizard.profileTitle"), hint: t("apply.wizard.profileHint") },
    { title: t("apply.wizard.documentsTitle"), hint: t("apply.wizard.documentsHint") },
    { title: t("apply.wizard.reviewTitle"), hint: t("apply.wizard.reviewHint") },
  ];

  const profileValue = profile.data;
  const missing = profileValue
    ? [
        !(profileValue.headline ?? "").trim() && t("apply.profile.headline"),
        !(profileValue.summary ?? "").trim() && t("apply.profile.summary"),
        !(profileValue.phone ?? "").trim() && t("apply.profile.phone"),
        profileValue.skills.length === 0 && t("apply.profile.skills"),
      ].filter((value): value is string => Boolean(value))
    : [];

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

  function goNext() {
    if (step === 1) {
      const fe = validateCvFile(file);
      setFileErr(fe);
      if (fe) {
        dropRef.current?.focus();
        return;
      }
    }
    setStep((current) => Math.min(LAST_STEP, current + 1));
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitErr(null);
    if (step !== LAST_STEP) {
      goNext();
      return;
    }

    const fe = validateCvFile(file);
    setFileErr(fe);
    if (!profileReviewed) {
      setStep(0);
      return;
    }
    if (fe || !file || !user) {
      if (fe) {
        setStep(1);
        dropRef.current?.focus();
      }
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
    );
  }

  return (
    <main className="jp-page jp-apply">
      <PageHead
        back={<BackLink to={jobHref}>{t("apply.backToJob")}</BackLink>}
        title={t("apply.pageTitle")}
        lead={t("apply.lead")}
      />

      <Board label={t("apply.jobBoardLabel")} className="jp-apply-job">
        <JobRow job={currentJob} static />
      </Board>

      <WizardSteps steps={steps} current={step} label={t("apply.wizard.label")} />

      <form className="jp-panel jp-apply-form jp-wizard-card" onSubmit={onSubmit} noValidate>
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

        {step === 0 && (
          <section className="jp-wizard-pane" aria-labelledby="apply-step-profile">
            <h2 className="jp-wizard-title" id="apply-step-profile" ref={stepRef} tabIndex={-1}>
              {t("apply.profile.title")}
            </h2>
            <p className="jp-wizard-lead">{t("apply.profile.lead")}</p>

            <Alert tone="info">{t("apply.profile.requiredNote")}</Alert>

            {profile.isPending && <SkeletonBlock height={160} label={t("apply.profile.loading")} />}
            {profile.isError && (
              <Alert
                tone="warning"
                action={
                  <Button variant="secondary" loading={profile.isFetching} onClick={() => void profile.refetch()}>
                    {t("jobs.retry")}
                  </Button>
                }
              >
                {t("apply.profile.loadError")}
              </Alert>
            )}

            {profileValue && (
              <div className="jp-profile-review">
                <div className="jp-profile-review-head">
                  <span className="jp-profile-avatar" aria-hidden="true">
                    {profileValue.fullName.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="jp-profile-review-id">
                    <strong>{profileValue.fullName || user?.fullName}</strong>
                    <span>{profileValue.headline || t("apply.profile.noHeadline")}</span>
                  </div>
                  <Link className="jp-link jp-profile-review-edit" to="/profile">
                    <Icon name="pencil" size={15} />
                    {t("apply.profile.edit")}
                  </Link>
                </div>

                <dl className="jp-profile-facts">
                  <div>
                    <dt>{t("apply.profile.email")}</dt>
                    <dd>{user?.email}</dd>
                  </div>
                  <div>
                    <dt>{t("apply.profile.phone")}</dt>
                    <dd>{profileValue.phone || <span className="jp-muted">{t("apply.profile.empty")}</span>}</dd>
                  </div>
                  <div>
                    <dt>{t("apply.profile.skills")}</dt>
                    <dd>
                      {profileValue.skills.length > 0
                        ? profileValue.skills.map((skill) => skill.name).join(", ")
                        : t("apply.profile.empty")}
                    </dd>
                  </div>
                </dl>

                <div className="jp-profile-summary">
                  <p className="jp-profile-summary-label">{t("apply.profile.summary")}</p>
                  <p>{profileValue.summary || t("apply.profile.empty")}</p>
                </div>

                {missing.length > 0 ? (
                  <div className="jp-profile-missing">
                    <p>
                      <Icon name="alert" size={16} />
                      {t("apply.profile.missingTitle")}
                    </p>
                    <ul>
                      {missing.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                    <Link className="jp-link" to="/profile">
                      {t("apply.profile.completeNow")}
                    </Link>
                  </div>
                ) : (
                  <p className="jp-profile-complete">
                    <Icon name="checkCircle" size={16} />
                    {t("apply.profile.complete")}
                  </p>
                )}
              </div>
            )}

            <Checkbox
              label={t("apply.profile.confirm")}
              checked={profileReviewed}
              onChange={(e) => setProfileReviewed(e.target.checked)}
            />
          </section>
        )}

        {step === 1 && (
          <section className="jp-wizard-pane" aria-labelledby="apply-step-documents">
            <h2 className="jp-wizard-title" id="apply-step-documents" ref={stepRef} tabIndex={-1}>
              {t("apply.documents.title")}
            </h2>
            <p className="jp-wizard-lead">{t("apply.documents.lead")}</p>

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
                id="apply-cover"
                rows={6}
                maxLength={COVER_MAX}
                placeholder={t("apply.coverPlaceholder")}
                value={cover}
                onChange={(e) => setCover(e.target.value)}
              />
            </Field>
          </section>
        )}

        {step === 2 && (
          <section className="jp-wizard-pane" aria-labelledby="apply-step-review">
            <h2 className="jp-wizard-title" id="apply-step-review" ref={stepRef} tabIndex={-1}>
              {t("apply.review.title")}
            </h2>
            <p className="jp-wizard-lead">{t("apply.review.lead")}</p>

            <dl className="jp-review-list">
              <div>
                <dt>{t("apply.position")}</dt>
                <dd>{currentJob.title}</dd>
              </div>
              <div>
                <dt>{t("apply.company")}</dt>
                <dd>{currentJob.company.name}</dd>
              </div>
              <div>
                <dt>{t("apply.review.candidate")}</dt>
                <dd>{profileValue?.fullName || user?.fullName}</dd>
              </div>
              <div>
                <dt>{t("apply.profile.email")}</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>{t("apply.cvLabel")}</dt>
                <dd>{file?.name ?? <StatusMark tone="danger">{t("apply.review.cvMissing")}</StatusMark>}</dd>
              </div>
              <div>
                <dt>{t("apply.coverLabel")}</dt>
                <dd className="jp-review-cover">
                  {cover.trim() || <span className="jp-muted">{t("apply.review.coverEmpty")}</span>}
                </dd>
              </div>
            </dl>

            <p className="jp-review-note">
              <Icon name="info" size={16} />
              {t("apply.review.profileNote")}
            </p>

            {!profileReviewed && (
              <Alert tone="warning">
                {t("apply.profile.confirmMissing")}{" "}
                <button type="button" className="jp-link" onClick={() => setStep(0)}>
                  {t("apply.review.backToProfile")}
                </button>
              </Alert>
            )}
          </section>
        )}

        <div className="jp-wizard-actions">
          <Button
            variant="secondary"
            onClick={step === 0 ? undefined : goBack}
            disabled={step === 0 || sending}
            type="button"
            icon="arrowLeft"
          >
            {t("apply.back")}
          </Button>
          <span className="jp-wizard-progress">
            {t("apply.wizard.progress", { current: step + 1, total: steps.length })}
          </span>
          {step < LAST_STEP ? (
            <Button
              key="next"
              type="button"
              onClick={goNext}
              disabled={step === 0 && !profileReviewed}
              icon="arrowRight"
            >
              {t("apply.next")}
            </Button>
          ) : (
            <Button
              key="submit"
              type="submit"
              size="lg"
              loading={sending}
              className="jp-apply-submit"
              disabled={!profileReviewed}
            >
              {sending ? t("apply.submitting") : t("apply.submit")}
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}
