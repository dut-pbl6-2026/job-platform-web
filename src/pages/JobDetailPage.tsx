import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchJobById } from "../lib/jobsApi";
import {
  Alert,
  BackLink,
  Button,
  ButtonLink,
  DevTag,
  EmptyState,
  FactStrip,
  Icon,
  Panel,
  SkeletonBlock,
  StatusMark,
  TopBar,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, isRecruiter, isUser } from "../lib/roles";
import { queryKeys } from "../lib/queryClient";
import { safeHttpUrl } from "../lib/safeUrl";
import { loginUrl } from "../lib/redirect";
import { loadErrorMessage } from "../lib/http";
import { categoryLabel, jobStatusLabel } from "../lib/labels";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

// Internal signal only: the page renders its own translated copy for this case, so the message is not shown.
class JobNotFoundError extends Error {
  constructor() {
    super("Job not found or removed.");
  }
}

/** The three reading sections of a job. A section with no text is folded into one "not updated" line. */
function sectionText(value: string | null | undefined): string | null {
  return value?.trim() ? value : null;
}

export default function JobDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const jobQuery = useQuery({
    queryKey: queryKeys.job(id || ""),
    queryFn: async () => {
      const found = await fetchJobById(id!);
      if (!found) throw new JobNotFoundError();
      return found;
    },
    enabled: !!id,
    // A missing job will not appear on retry; real failures keep the default single retry.
    retry: (count, e) => !(e instanceof JobNotFoundError) && count < 1,
  });

  const job = jobQuery.data;
  const loading = jobQuery.isPending;
  const notFound = jobQuery.error instanceof JobNotFoundError;
  const err = !jobQuery.isError || notFound ? null : loadErrorMessage(jobQuery.error, t("jobs.detail.loadWhat"));
  // Title needs the loaded job; it must stay above the early returns below (rules of hooks).
  useDocumentTitle(job ? `${job.title} · ${job.company.name}` : t("jobs.title"));

  if (loading) {
    return (
      <>
        <TopBar />
        <main className="jp-page">
          <BackLink to="/jobs">{t("jobs.detail.backToBoard")}</BackLink>
          <SkeletonBlock height={440} label={t("jobs.detail.loading")} />
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <EmptyState
            title={t("jobs.detail.notFound")}
            action={<ButtonLink to="/jobs">{t("jobs.detail.viewBoard")}</ButtonLink>}
          />
        </main>
      </>
    );
  }

  if (err) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <BackLink to="/jobs">{t("jobs.detail.backToBoard")}</BackLink>
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={jobQuery.isFetching} onClick={() => void jobQuery.refetch()}>
                {jobQuery.isFetching ? t("jobs.retrying") : t("jobs.retry")}
              </Button>
            }
          >
            {err}
          </Alert>
        </main>
      </>
    );
  }

  if (!job) return null;

  const website = safeHttpUrl(job.company.website);
  const canApply = isAuthenticated && isUser(user?.role);
  const updated = new Date(job.updatedAt);
  const sections = [
    { title: t("jobs.detail.sectionDescription"), text: sectionText(job.description) },
    { title: t("jobs.detail.sectionRequirements"), text: sectionText(job.requirements) },
    { title: t("jobs.detail.sectionBenefits"), text: sectionText(job.benefits) },
  ];
  const filled = sections.filter((s) => s.text);
  const empty = sections.filter((s) => !s.text).map((s) => s.title);
  const companyFacts: [string, string][] = [
    [t("jobs.detail.industry"), job.company.industry?.trim() ?? ""],
    [t("jobs.detail.address"), job.company.address?.trim() ?? ""],
  ];

  return (
    <>
      <TopBar />
      <main className="jp-page jp-detail">
        <BackLink to="/jobs">{t("jobs.detail.backToBoard")}</BackLink>

        <header className="jp-detail-head">
          <h1 className="jp-h1">{job.title}</h1>
          <p className="jp-detail-company">
            <span>{job.company.name}</span>
            {job.company.verified && <StatusMark tone="success">{t("jobs.detail.verified")}</StatusMark>}
          </p>
        </header>

        {job.status !== "active" && (
          <Alert tone="warning" className="jp-detail-status">
            {t("jobs.detail.statusNote", { status: jobStatusLabel(job.status).toLowerCase() })}
          </Alert>
        )}

        <FactStrip job={job} />

        <div className="jp-detail-grid">
          <article className="jp-panel jp-detail-main" aria-label={t("jobs.detail.contentLabel")}>
            {filled.map((s) => (
              <section key={s.title} className="jp-detail-section">
                <h2 className="jp-h3">{s.title}</h2>
                <p className="jp-prose">{s.text}</p>
              </section>
            ))}
            {empty.length > 0 && (
              <p className="jp-detail-empty jp-muted">{t("jobs.detail.notUpdated", { fields: empty.join(", ") })}</p>
            )}
            <p className="jp-detail-meta jp-muted">
              {[
                t("jobs.detail.category", { name: categoryLabel(job.category?.name) }),
                Number.isNaN(updated.getTime())
                  ? null
                  : t("jobs.detail.updated", { date: updated.toLocaleDateString("vi-VN") }),
                t("jobs.detail.views", { views: job.viewCount }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </article>

          <aside className="jp-detail-side" aria-label={t("jobs.detail.sideLabel")}>
            <Panel title={t("jobs.detail.applyPanel")} className="jp-detail-apply">
              {canApply && (
                <div className="jp-detail-actions">
                  <ButtonLink size="lg" block to={`/jobs/${job.id}/apply`}>
                    {t("jobs.detail.applyNow")}
                  </ButtonLink>
                  <ButtonLink variant="secondary" block to={`/resume-score?jobId=${job.id}`}>
                    {t("jobs.detail.checkFit")}
                    <DevTag />
                  </ButtonLink>
                </div>
              )}
              {!isAuthenticated && (
                <div className="jp-detail-actions">
                  <ButtonLink size="lg" block to={loginUrl(`/jobs/${job.id}/apply`)}>
                    {t("jobs.detail.loginToApply")}
                  </ButtonLink>
                  <p className="jp-detail-note jp-muted">{t("jobs.detail.loginNote")}</p>
                </div>
              )}
              {isAuthenticated && !canApply && (
                <p className="jp-detail-note jp-detail-note--reason">
                  <Icon name="info" size={16} />
                  {isRecruiter(user?.role)
                    ? t("jobs.detail.recruiterCannotApply")
                    : isAdmin(user?.role)
                      ? t("jobs.detail.adminCannotApply")
                      : t("jobs.detail.otherCannotApply")}
                </p>
              )}
            </Panel>

            <Panel title={t("jobs.detail.companyPanel")} className="jp-detail-company-panel">
              <dl className="jp-detail-kv">
                <div>
                  <dt>{t("jobs.detail.companyName")}</dt>
                  <dd>{job.company.name}</dd>
                </div>
                {companyFacts.map(([term, value]) =>
                  value ? (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ) : null,
                )}
                {website && (
                  <div>
                    <dt>{t("jobs.detail.website")}</dt>
                    <dd>
                      <a className="jp-link" href={website} target="_blank" rel="noopener noreferrer">
                        {job.company.website}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </Panel>
          </aside>
        </div>
      </main>
    </>
  );
}
