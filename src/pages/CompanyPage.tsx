import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCompany, fetchCompanyJobs } from "../lib/companyApi";
import { companyInitials } from "../lib/jobsApi";
import { loadErrorMessage } from "../lib/http";
import { safeHttpUrl } from "../lib/safeUrl";
import {
  Alert,
  Board,
  ButtonLink,
  EmptyState,
  JobRow,
  Panel,
  SkeletonBlock,
  SkeletonRows,
  StatusMark,
} from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 20;

/** Public, read-only company profile at /companies/:id. */
export default function CompanyPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();

  const companyQuery = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetchCompany(id),
    enabled: !!id,
    retry: (count) => count < 1,
  });
  const jobsQuery = useQuery({
    queryKey: ["company", id, "jobs"],
    queryFn: () => fetchCompanyJobs(id, { page: 0, size: PAGE_SIZE }),
    enabled: !!id && !!companyQuery.data,
  });

  const company = companyQuery.data;
  useDocumentTitle(company ? company.name : t("company.documentTitle"));

  if (companyQuery.isPending) {
    return (
      <main className="jp-page">
        <SkeletonBlock height={320} label={t("company.loading")} />
      </main>
    );
  }

  if (companyQuery.isError) {
    return (
      <main className="jp-page jp-page--narrow">
        <Alert
          tone="error"
          action={
            <ButtonLink to="/jobs" variant="secondary">
              {t("jobs.detail.viewBoard")}
            </ButtonLink>
          }
        >
          {loadErrorMessage(companyQuery.error, t("company.loadWhat"))}
        </Alert>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="jp-page jp-page--narrow">
        <EmptyState
          title={t("company.notFound")}
          action={<ButtonLink to="/jobs">{t("jobs.detail.viewBoard")}</ButtonLink>}
        />
      </main>
    );
  }

  const logo = safeHttpUrl(company.logoUrl);
  const website = safeHttpUrl(company.website);
  const jobs = jobsQuery.data;
  const boardHref = `/jobs?q=${encodeURIComponent(company.name)}`;
  const facts = [
    company.industry ? { label: t("company.industry"), value: company.industry } : null,
    company.size ? { label: t("company.size"), value: company.size } : null,
    company.address ? { label: t("company.address"), value: company.address } : null,
  ].filter((f): f is { label: string; value: string } => !!f);

  return (
    <main className="jp-page jp-company">
      <Link to="/jobs" className="jp-back">
        {t("company.backToBoard")}
      </Link>

      <header className="jp-company-head">
        <span className="jp-company-logo" aria-hidden="true">
          {logo ? <img src={logo} alt="" referrerPolicy="no-referrer" /> : companyInitials(company.name)}
        </span>
        <div className="jp-company-heading">
          <h1 className="jp-h1">{company.name}</h1>
          <p className="jp-company-marks">
            {company.verified && <StatusMark tone="success">{t("company.verified")}</StatusMark>}
            {company.industry && <span>{company.industry}</span>}
          </p>
        </div>
        <div className="jp-company-head-actions">
          <ButtonLink to={boardHref} variant="secondary">
            {t("company.findOnBoard")}
          </ButtonLink>
          {website && (
            <a className="jp-btn jp-btn--secondary" href={website} target="_blank" rel="noopener noreferrer">
              {t("company.website")}
            </a>
          )}
        </div>
      </header>

      <div className="jp-company-grid">
        <section className="jp-company-about" aria-labelledby="company-about">
          <Panel title={t("company.about")}>
            {company.description?.trim() ? (
              <p className="jp-prose">{company.description}</p>
            ) : (
              <p className="jp-muted">{t("company.noDescription")}</p>
            )}
          </Panel>

          <section className="jp-company-jobs" aria-labelledby="company-jobs">
            <h2 className="jp-h2" id="company-jobs">
              {t("company.jobsTitle")}
            </h2>
            {jobsQuery.isPending && <SkeletonRows rows={3} label={t("company.loadingJobs")} />}
            {jobsQuery.isError && (
              <Alert tone="error">
                {loadErrorMessage(jobsQuery.error, t("company.jobsWhat"))}{" "}
                <Link className="jp-link" to={boardHref}>
                  {t("company.findOnBoard")}
                </Link>
              </Alert>
            )}
            {jobs === null && !jobsQuery.isError && (
              <Alert tone="info">
                {t("company.jobsUnavailable")}{" "}
                <Link className="jp-link" to={boardHref}>
                  {t("company.findOnBoard")}
                </Link>
              </Alert>
            )}
            {jobs && jobs.items.length === 0 && (
              <EmptyState
                title={t("company.emptyJobs")}
                action={<ButtonLink to={boardHref}>{t("company.findOnBoard")}</ButtonLink>}
              />
            )}
            {jobs && jobs.items.length > 0 && (
              <Board label={t("company.jobsLabel")}>
                {jobs.items.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </Board>
            )}
          </section>
        </section>

        <aside className="jp-company-side">
          <Panel title={t("company.facts")}>
            <dl className="jp-kv">
              {facts.length > 0 ? (
                facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))
              ) : (
                <div>
                  <dt>{t("company.facts")}</dt>
                  <dd className="jp-muted">{t("common.notProvided")}</dd>
                </div>
              )}
              {website && (
                <div>
                  <dt>{t("company.website")}</dt>
                  <dd>
                    <a className="jp-link" href={website} target="_blank" rel="noopener noreferrer">
                      {company.website}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
