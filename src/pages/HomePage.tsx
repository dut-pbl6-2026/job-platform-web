import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  companyInitials,
  fetchCategories,
  fetchCompaniesWithTotal,
  fetchJobs,
  formatSalary,
  isNewJob,
} from "../lib/jobsApi";
import { queryKeys } from "../lib/queryClient";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, isRecruiter, isUser } from "../lib/roles";
import { JOB_CATEGORIES, categoryLabel, employmentTypeLabel, locationLabel } from "../lib/labels";
import { loadErrorMessage } from "../lib/http";
import { safeHttpUrl } from "../lib/safeUrl";
import { SearchBar } from "../components/SearchBar";
import { Alert, ButtonLink, EmptyState, Icon, SkeletonRows, cx } from "../components/ui";
import type { IconName } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { JobCategoryName } from "../lib/labels";

const HOME_JOB_COUNT = 6;
const HOME_COMPANY_COUNT = 6;

/** Category icons and one-line descriptions: the home grid reads as a map of the market, not a chip list. */
const CATEGORY_ICONS: Record<JobCategoryName, IconName> = {
  IT: "code",
  Sales: "trendUp",
  Marketing: "megaphone",
  Finance: "wallet",
  Healthcare: "heart",
  Education: "book",
  Engineering: "gear",
  Hospitality: "coffee",
  Others: "dashboard",
};

type CategoryDescriptionKey =
  | "home.categoryIT"
  | "home.categorySales"
  | "home.categoryMarketing"
  | "home.categoryFinance"
  | "home.categoryHealthcare"
  | "home.categoryEducation"
  | "home.categoryEngineering"
  | "home.categoryHospitality"
  | "home.categoryOthers";

const CATEGORY_DESCRIPTIONS: Record<JobCategoryName, CategoryDescriptionKey> = {
  IT: "home.categoryIT",
  Sales: "home.categorySales",
  Marketing: "home.categoryMarketing",
  Finance: "home.categoryFinance",
  Healthcare: "home.categoryHealthcare",
  Education: "home.categoryEducation",
  Engineering: "home.categoryEngineering",
  Hospitality: "home.categoryHospitality",
  Others: "home.categoryOthers",
};

const POPULAR_SEARCHES = [
  { key: "home.popularReact", q: "React" },
  { key: "home.popularMarketing", q: "Marketing" },
  { key: "home.popularTesting", q: "Kiểm thử" },
  { key: "home.popularData", q: "Phân tích dữ liệu" },
] as const;

/** The public landing page: search, the newest real jobs, real companies and a recruiter entry point. */
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
    queryFn: () => fetchCompaniesWithTotal("", HOME_COMPANY_COUNT),
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

  const featured = jobs.data?.items.slice(0, 3) ?? [];
  const jobTotal = jobs.data?.total;
  const companyTotal = companies.data?.total;
  const heroMore = Math.max(0, (jobTotal ?? 0) - featured.length);

  return (
    <main className="jp-home">
      <section className="jp-home-hero">
        <div className="jp-home-hero-inner">
          <div className="jp-home-hero-copy">
            <p className="jp-home-kicker">{t("home.kicker")}</p>
            <h1 className="jp-home-title">
              {t("home.titleLead")} <span className="jp-home-title-accent">{t("home.titleAccent")}</span>
            </h1>
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

            <div className="jp-home-popular">
              <span>{t("home.popular")}</span>
              {POPULAR_SEARCHES.map((item) => (
                <Link key={item.q} to={`/jobs?q=${encodeURIComponent(item.q)}`} className="jp-home-popular-chip">
                  {t(item.key)}
                </Link>
              ))}
            </div>

            <div className="jp-home-actions">
              <ButtonLink to="/jobs">{t("home.ctaBrowse")}</ButtonLink>
              <ButtonLink to={isAuthenticated ? secondary.to : recruiterHref} variant="secondary">
                {isAuthenticated ? secondary.label : t("home.ctaPostJob")}
              </ButtonLink>
            </div>

            <ul className="jp-home-trust">
              <li>
                <Icon name="checkCircle" size={16} /> {t("home.trustFree")}
              </li>
              <li>
                <Icon name="shieldCheck" size={16} /> {t("home.trustNoCard")}
              </li>
              <li>
                <Icon name="clock" size={16} /> {t("home.trustDaily")}
              </li>
            </ul>
          </div>

          <div className="jp-home-art" aria-hidden="true">
            <div className="jp-hero-board">
              <div className="jp-hero-board-head">
                <span className="jp-hero-board-title">{t("home.heroBoardTitle")}</span>
                <span className="jp-hero-board-live">
                  <i /> {t("home.heroBoardLive")}
                </span>
              </div>
              <ul className="jp-hero-board-rows">
                {featured.map((job) => {
                  const logo = safeHttpUrl(job.company.logoUrl);
                  return (
                    <li key={job.id} className="jp-hero-board-row">
                      <span className="jp-hero-board-logo">
                        {logo ? <img src={logo} alt="" /> : companyInitials(job.company.name)}
                      </span>
                      <span className="jp-hero-board-job">
                        <strong>{job.title}</strong>
                        <span>{job.company.name}</span>
                      </span>
                      {isNewJob(job.createdAt) ? <span className="jp-new">{t("common.new")}</span> : null}
                    </li>
                  );
                })}
                {featured.length === 0 && (
                  <li className="jp-hero-board-row is-empty">
                    <span className="jp-hero-board-logo">JP</span>
                    <span className="jp-hero-board-job">
                      <strong>{t("home.heroBoardEmpty")}</strong>
                      <span>{t("home.heroBoardEmptySub")}</span>
                    </span>
                  </li>
                )}
              </ul>
              <div className="jp-hero-board-foot">
                <span>{heroMore > 0 ? t("home.heroBoardMore", { count: heroMore }) : t("home.viewAll")}</span>
                <Icon name="arrowRight" size={16} />
              </div>
            </div>
            <span className="jp-hero-float is-jobs">
              <Icon name="briefcase" size={16} />
              <strong>{jobTotal == null ? "…" : jobTotal.toLocaleString("vi-VN")}</strong> {t("home.statJobs")}
            </span>
            <span className="jp-hero-float is-companies">
              <Icon name="building" size={16} />
              <strong>{companyTotal == null ? "…" : companyTotal.toLocaleString("vi-VN")}</strong>{" "}
              {t("home.statCompanies")}
            </span>
          </div>
        </div>

        <div className="jp-home-stats">
          <div className="jp-home-stat">
            <Icon name="briefcase" size={20} />
            <strong>{jobTotal == null ? "…" : jobTotal.toLocaleString("vi-VN")}</strong>
            <span>{t("home.statJobs")}</span>
          </div>
          <div className="jp-home-stat">
            <Icon name="building" size={20} />
            <strong>{companyTotal == null ? "…" : companyTotal.toLocaleString("vi-VN")}</strong>
            <span>{t("home.statCompanies")}</span>
          </div>
          <div className="jp-home-stat">
            <Icon name="dashboard" size={20} />
            <strong>{JOB_CATEGORIES.length}</strong>
            <span>{t("home.statCategories")}</span>
          </div>
          <div className="jp-home-stat">
            <Icon name="shieldCheck" size={20} />
            <strong>{t("home.statFreeValue")}</strong>
            <span>{t("home.statFreeSub")}</span>
          </div>
        </div>
      </section>

      <div className="jp-home-body">
        <section className="jp-home-section" aria-labelledby="home-categories">
          <div className="jp-home-section-head">
            <div>
              <h2 className="jp-h2" id="home-categories">
                {t("home.categories")}
              </h2>
              <p className="jp-home-section-lead">{t("home.categoriesLead")}</p>
            </div>
          </div>
          <ul className="jp-home-cats">
            {JOB_CATEGORIES.map((cat) => {
              const found = (categories.data ?? []).find((c) => c.name.toLowerCase() === cat.name.toLowerCase());
              return (
                <li key={cat.name}>
                  <Link className="jp-cattile" to={`/jobs?category=${encodeURIComponent(found?.id ?? cat.name)}`}>
                    <span className="jp-cattile-icon">
                      <Icon name={CATEGORY_ICONS[cat.name]} size={22} />
                    </span>
                    <span className="jp-cattile-body">
                      <strong>{categoryLabel(cat.name)}</strong>
                      <span>{t(CATEGORY_DESCRIPTIONS[cat.name])}</span>
                    </span>
                    <Icon name="chevronRight" size={16} className="jp-cattile-go" />
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
            <div>
              <h2 className="jp-h2" id="home-latest">
                {t("home.latest")}
              </h2>
              <p className="jp-home-section-lead">{t("home.latestLead")}</p>
            </div>
            <Link className="jp-link" to="/jobs">
              {t("home.viewAll")}
            </Link>
          </div>

          {jobs.isPending && <SkeletonRows rows={2} label={t("home.loadingJobs")} />}

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
            <ul className="jp-jobgrid" aria-label={t("home.latestLabel")}>
              {jobs.data.items.map((job) => {
                const logo = safeHttpUrl(job.company.logoUrl);
                return (
                  <li key={job.id}>
                    <Link to={`/jobs/${job.id}`} className="jp-jobcard">
                      <span className="jp-jobcard-top">
                        <span className="jp-jobcard-logo">
                          {logo ? <img src={logo} alt="" /> : companyInitials(job.company.name)}
                        </span>
                        <span className="jp-jobcard-company">{job.company.name}</span>
                        {isNewJob(job.createdAt) ? <span className="jp-new">{t("common.new")}</span> : null}
                      </span>
                      <span className="jp-jobcard-title">{job.title}</span>
                      <span className="jp-jobcard-salary">
                        {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                      </span>
                      <span className="jp-jobcard-meta">
                        <span>
                          <Icon name="pin" size={14} /> {locationLabel(job.location)}
                        </span>
                        <span>
                          <Icon name="briefcase" size={14} /> {employmentTypeLabel(job.employmentType)}
                        </span>
                      </span>
                      <span className="jp-jobcard-foot">
                        {categoryLabel(job.category?.name)}
                        <Icon name="arrowRight" size={16} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="jp-home-section jp-home-how" aria-labelledby="home-how">
          <h2 className="jp-h2" id="home-how">
            {t("home.howTitle")}
          </h2>
          <ol className="jp-steps">
            <li>
              <span className="jp-step-icon">
                <Icon name="search" size={22} />
              </span>
              <strong>{t("home.how1Title")}</strong>
              <span>{t("home.how1Text")}</span>
            </li>
            <li>
              <span className="jp-step-icon">
                <Icon name="upload" size={22} />
              </span>
              <strong>{t("home.how2Title")}</strong>
              <span>{t("home.how2Text")}</span>
            </li>
            <li>
              <span className="jp-step-icon">
                <Icon name="chart" size={22} />
              </span>
              <strong>{t("home.how3Title")}</strong>
              <span>{t("home.how3Text")}</span>
            </li>
          </ol>
        </section>

        <section className="jp-home-section" aria-labelledby="home-companies">
          <div className="jp-home-section-head">
            <div>
              <h2 className="jp-h2" id="home-companies">
                {t("home.companies")}
              </h2>
              <p className="jp-home-section-lead">{t("home.companiesLead")}</p>
            </div>
          </div>
          {companies.isPending && <SkeletonRows rows={2} label={t("home.loadingCompanies")} />}
          {companies.isError && (
            <p className="jp-home-note" role="status">
              {t("home.companiesUnavailable")}
            </p>
          )}
          {companies.data && companies.data.items.length > 0 && (
            <ul className="jp-home-companies">
              {companies.data.items.map((company) => {
                const logo = safeHttpUrl(company.logoUrl);
                return (
                  <li key={company.id}>
                    <Link to={`/companies/${company.id}`} className="jp-home-company">
                      <span className="jp-company-logo jp-company-logo--sm" aria-hidden="true">
                        {logo ? <img src={logo} alt="" /> : companyInitials(company.name)}
                      </span>
                      <span className="jp-home-company-text">
                        <strong>
                          <span>{company.name}</span>
                          {company.verified && (
                            <>
                              <Icon name="checkCircle" size={15} />
                              <span className="jp-sr">{t("company.verified")}</span>
                            </>
                          )}
                        </strong>
                        <span>{company.industry || t("home.companyNoIndustry")}</span>
                      </span>
                      <span className="jp-home-company-go">
                        <span className="jp-home-company-go-text">{t("home.companyView")}</span>
                        <Icon name="arrowRight" size={16} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {companies.data && companies.data.items.length === 0 && (
            <p className="jp-home-note">{t("home.emptyCompanies")}</p>
          )}
        </section>

        <section className={cx("jp-home-recruiter", candidateSignedIn && "is-note")} aria-labelledby="home-recruiter">
          <div className="jp-home-recruiter-copy">
            <h2 className="jp-h2" id="home-recruiter">
              {t("home.recruiterTitle")}
            </h2>
            <p className="jp-home-recruiter-lead">{t("home.recruiterLead")}</p>
            <ul className="jp-home-facts">
              <li>
                <Icon name="plus" size={16} /> {t("home.recruiterFactPost")}
              </li>
              <li>
                <Icon name="users" size={16} /> {t("home.recruiterFactApplicants")}
              </li>
              <li>
                <Icon name="building" size={16} /> {t("home.recruiterFactCompany")}
              </li>
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
