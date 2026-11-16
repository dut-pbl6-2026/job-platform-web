import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchCompanies, fetchJobs, companyInitials } from "../lib/jobsApi";
import { queryKeys } from "../lib/queryClient";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, isRecruiter, isUser } from "../lib/roles";
import { JOB_CATEGORIES, categoryLabel } from "../lib/labels";
import { loadErrorMessage } from "../lib/http";
import { safeHttpUrl } from "../lib/safeUrl";
import { SearchBar } from "../components/SearchBar";
import { Alert, Board, ButtonLink, EmptyState, JobRow, SkeletonRows, StatusMark } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const HOME_JOB_COUNT = 6;
const HOME_COMPANY_COUNT = 6;

/** The public landing page: facts only — search, categories, the newest real jobs, real companies. */
export default function HomePage() {
  const { t } = useTranslation();
  useDocumentTitle(t("home.documentTitle"));
  const nav = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const jobs = useQuery({
    queryKey: queryKeys.jobs({ home: true, size: HOME_JOB_COUNT }),
    queryFn: () => fetchJobs({ page: 0, size: HOME_JOB_COUNT, sortBy: "created_at_desc" }),
  });
  const companies = useQuery({
    queryKey: ["companies", "home"],
    queryFn: () => fetchCompanies("", HOME_COMPANY_COUNT),
  });
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategories });

  const recruiterHref = isRecruiter(user?.role) ? "/recruiter" : "/register-company";
  const secondary =
    isAuthenticated && isRecruiter(user?.role)
      ? { to: "/recruiter", label: t("home.ctaRecruiterDashboard") }
      : isAuthenticated && isAdmin(user?.role)
        ? { to: "/admin", label: t("home.ctaAdmin") }
        : isAuthenticated && isUser(user?.role)
          ? { to: "/applications", label: t("home.ctaMyApplications") }
          : { to: "/register-company", label: t("home.ctaPostJob") };
  // The employer panel must not point a signed-in candidate at the guest-only company sign-up.
  const panel = isRecruiter(user?.role)
    ? { to: "/recruiter", label: t("home.ctaRecruiterDashboard") }
    : isAdmin(user?.role)
      ? { to: "/admin/jobs", label: t("home.ctaManageJobs") }
      : { to: "/register-company", label: t("home.ctaPostJob") };
  const candidateSignedIn = isAuthenticated && isUser(user?.role);

  return (
    <main className="jp-home">
      <section className="jp-home-hero">
        <div className="jp-home-hero-inner">
          <p className="jp-home-kicker">{t("home.kicker")}</p>
          <h1 className="jp-home-title">{t("home.title")}</h1>
          <p className="jp-home-lead">{t("home.lead")}</p>

          <div className="jp-home-search">
            <SearchBar
              onSearch={(q, location) => {
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (location) params.set("location", location);
                nav(params.size ? `/jobs?${params.toString()}` : "/jobs");
              }}
            />
          </div>

          <div className="jp-home-actions">
            <ButtonLink to="/jobs" variant="secondary">
              {t("home.ctaBrowse")}
            </ButtonLink>
            <ButtonLink to={isAuthenticated ? secondary.to : recruiterHref} variant="ghost">
              {isAuthenticated ? secondary.label : t("home.ctaPostJob")}
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="jp-home-body">
        <section className="jp-home-section" aria-labelledby="home-categories">
          <div className="jp-home-section-head">
            <h2 className="jp-h2" id="home-categories">
              {t("home.categories")}
            </h2>
          </div>
          <ul className="jp-home-cats">
            {JOB_CATEGORIES.map((cat) => {
              const found = (categories.data ?? []).find((c) => c.name.toLowerCase() === cat.name.toLowerCase());
              return (
                <li key={cat.name}>
                  <Link className="jp-chip" to={`/jobs?category=${encodeURIComponent(found?.id ?? cat.name)}`}>
                    {categoryLabel(cat.name)}
                  </Link>
                </li>
              );
            })}
          </ul>
          {categories.isError && (
            <p className="jp-home-note" role="status">
              {t("home.categoriesUnavailable")}
            </p>
          )}
        </section>

        <section className="jp-home-section" aria-labelledby="home-latest">
          <div className="jp-home-section-head">
            <h2 className="jp-h2" id="home-latest">
              {t("home.latest")}
            </h2>
            <Link className="jp-link" to="/jobs">
              {t("home.viewAll")}
            </Link>
          </div>

          {jobs.isPending && (
            <div className="jp-board">
              <SkeletonRows rows={HOME_JOB_COUNT} label={t("home.loadingJobs")} />
            </div>
          )}

          {jobs.isError && <Alert tone="error">{loadErrorMessage(jobs.error, t("home.jobsWhat"))}</Alert>}

          {jobs.data && jobs.data.items.length === 0 && (
            <div className="jp-board">
              <EmptyState
                title={t("home.emptyJobs")}
                action={<ButtonLink to="/jobs">{t("home.viewAll")}</ButtonLink>}
              />
            </div>
          )}

          {jobs.data && jobs.data.items.length > 0 && (
            <Board label={t("home.latestLabel")}>
              {jobs.data.items.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </Board>
          )}
        </section>

        <section className="jp-home-section" aria-labelledby="home-companies">
          <div className="jp-home-section-head">
            <h2 className="jp-h2" id="home-companies">
              {t("home.companies")}
            </h2>
          </div>
          {companies.isPending && <SkeletonRows rows={2} label={t("home.loadingCompanies")} />}
          {companies.isError && (
            <p className="jp-home-note" role="status">
              {t("home.companiesUnavailable")}
            </p>
          )}
          {companies.data && companies.data.length > 0 && (
            <ul className="jp-home-companies">
              {companies.data.map((company) => {
                const logo = safeHttpUrl(company.logoUrl);
                return (
                  <li key={company.id}>
                    <Link to={`/companies/${company.id}`} className="jp-home-company">
                      <span className="jp-company-logo jp-company-logo--sm" aria-hidden="true">
                        {logo ? <img src={logo} alt="" /> : companyInitials(company.name)}
                      </span>
                      <span className="jp-home-company-text">
                        <strong>{company.name}</strong>
                        <span>{company.industry || t("home.companyNoIndustry")}</span>
                      </span>
                      {company.verified && <StatusMark tone="success">{t("company.verified")}</StatusMark>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {companies.data && companies.data.length === 0 && <p className="jp-home-note">{t("home.emptyCompanies")}</p>}
        </section>

        <section className="jp-home-recruiter" aria-labelledby="home-recruiter">
          <div>
            <h2 className="jp-h2" id="home-recruiter">
              {t("home.recruiterTitle")}
            </h2>
            <p className="jp-home-recruiter-lead">{t("home.recruiterLead")}</p>
            <ul className="jp-home-facts">
              <li>{t("home.recruiterFactPost")}</li>
              <li>{t("home.recruiterFactApplicants")}</li>
              <li>{t("home.recruiterFactCompany")}</li>
            </ul>
          </div>
          {candidateSignedIn ? (
            <p className="jp-home-recruiter-note">{t("home.recruiterCandidateNote")}</p>
          ) : (
            <ButtonLink to={panel.to} size="lg">
              {panel.label}
            </ButtonLink>
          )}
        </section>
      </div>
    </main>
  );
}
