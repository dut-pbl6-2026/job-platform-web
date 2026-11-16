import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, ButtonLink, EmptyState, Icon, Panel, SkeletonRows, StatusMark, cx } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fetchApplicationsByJob } from "../lib/applicationsApi";
import { fetchMyCompany } from "../lib/companyApi";
import { formatDate } from "../lib/dates";
import { loadErrorMessage } from "../lib/http";
import { jobStatusLabel } from "../lib/labels";
import { fetchRecruiterJobs, type RecruiterJobStatus } from "../lib/jobsApi";

const TILES: {
  status: RecruiterJobStatus;
  labelKey: "recruiter.dashboard.tiles.active" | "recruiter.dashboard.tiles.closed";
  icon: "briefcase" | "checkCircle";
  tone: string;
}[] = [
  { status: "Active", labelKey: "recruiter.dashboard.tiles.active", icon: "briefcase", tone: "is-open" },
  { status: "Closed", labelKey: "recruiter.dashboard.tiles.closed", icon: "checkCircle", tone: "is-closed" },
];

/** Real counts only: each tile is the `total` of a one-row request, and each bar is one too. */
export default function RecruiterDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  useDocumentTitle(t("recruiter.documentTitles.dashboard"));

  const counts = useQueries({
    queries: TILES.map((tile) => ({
      queryKey: ["recruiter", "jobs", "count", tile.status],
      queryFn: () => fetchRecruiterJobs({ page: 1, size: 1, status: tile.status }),
      staleTime: 0,
    })),
  });
  const recent = useQuery({
    queryKey: ["recruiter", "jobs", "recent"],
    queryFn: () => fetchRecruiterJobs({ page: 1, size: 8 }),
    staleTime: 0,
  });
  const company = useQuery({
    queryKey: ["company", "mine", user?.id],
    queryFn: () => fetchMyCompany(user?.companyId),
    staleTime: 5 * 60_000,
  });
  const recentJobs = recent.data?.items ?? [];
  const applicants = useQueries({
    queries: recentJobs.map((job) => ({
      queryKey: ["recruiter", "applications", "count", job.id],
      queryFn: () => fetchApplicationsByJob(job.id, { page: 1, size: 1 }),
      staleTime: 0,
    })),
  });

  const countError = counts.find((q) => q.isError);
  const totalJobs =
    counts[0].data && counts[1].data ? counts[0].data.total + counts[1].data.total : null;
  const applicantTotals = applicants.map((a) => a.data?.total ?? 0);
  const maxApplicants = Math.max(1, ...applicantTotals);
  const isCompanyAdmin = company.data?.isCompanyAdmin === true;

  return (
    <RecruiterShell
      title={t("recruiter.dashboard.title")}
      lead={t("recruiter.dashboard.lead")}
      actions={
        <ButtonLink to="/recruiter/jobs/new" icon="plus">
          {t("recruiter.jobs.newJob")}
        </ButtonLink>
      }
    >
      {countError && (
        <Alert tone="error">{loadErrorMessage(countError.error, t("recruiter.dashboard.countWhat"))}</Alert>
      )}

      <div className="jp-dash-tiles" role="list" aria-label={t("recruiter.dashboard.tilesLabel")}>
        {TILES.map((tile, i) => {
          const q = counts[i];
          return (
            <Link
              key={tile.status}
              role="listitem"
              to={`/recruiter/jobs?status=${tile.status}`}
              className={cx("jp-dash-tile", tile.tone)}
            >
              <span className="jp-dash-tile-icon" aria-hidden="true">
                <Icon name={tile.icon} size={20} />
              </span>
              <span className="jp-dash-tile-body">
                <span className="jp-dash-tile-label">{t(tile.labelKey)}</span>
                <strong className="jp-dash-tile-value">
                  {q.isError ? "—" : q.data ? q.data.total.toLocaleString("vi-VN") : "…"}
                </strong>
              </span>
              <Icon name="arrowRight" size={16} className="jp-dash-tile-go" />
            </Link>
          );
        })}
        <div className="jp-dash-tile is-total" role="listitem">
          <span className="jp-dash-tile-icon" aria-hidden="true">
            <Icon name="file" size={20} />
          </span>
          <span className="jp-dash-tile-body">
            <span className="jp-dash-tile-label">{t("recruiter.dashboard.tiles.total")}</span>
            <strong className="jp-dash-tile-value">
              {totalJobs == null ? "…" : totalJobs.toLocaleString("vi-VN")}
            </strong>
          </span>
        </div>
      </div>

      <div className="jp-dash-grid">
        <Panel
          title={t("recruiter.dashboard.recent")}
          actions={
            <Link className="jp-link" to="/recruiter/jobs">
              {t("recruiter.dashboard.viewAll")}
            </Link>
          }
        >
          {recent.isPending && <SkeletonRows rows={3} label={t("recruiter.dashboard.loadingRecent")} />}
          {recent.isError && (
            <Alert tone="error">{loadErrorMessage(recent.error, t("recruiter.dashboard.recentWhat"))}</Alert>
          )}
          {recent.data && recentJobs.length === 0 && <EmptyState title={t("recruiter.dashboard.empty")} />}
          {recentJobs.length > 0 && (
            <div className="jp-table-wrap">
              <table className="jp-table jp-recruiter-table">
                <thead>
                  <tr>
                    <th scope="col">{t("recruiter.dashboard.colJob")}</th>
                    <th scope="col">{t("recruiter.dashboard.colStatus")}</th>
                    <th scope="col">{t("recruiter.dashboard.colPosted")}</th>
                    <th scope="col" className="jp-num">
                      {t("recruiter.dashboard.colApplicants")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job, i) => {
                    const a = applicants[i];
                    return (
                      <tr key={job.id}>
                        <td>
                          <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                        </td>
                        <td data-label={t("recruiter.dashboard.colStatus")}>
                          <StatusMark tone={job.status === "closed" ? "neutral" : "success"}>
                            {jobStatusLabel(job.status)}
                          </StatusMark>
                        </td>
                        <td data-label={t("recruiter.dashboard.colPosted")}>{formatDate(job.createdAt)}</td>
                        <td data-label={t("recruiter.dashboard.colApplicants")} className="jp-num">
                          {a?.isError ? (
                            t("recruiter.dashboard.applicantsFailed")
                          ) : a?.data ? (
                            <Link to={`/recruiter/jobs/${job.id}/applications`}>{a.data.total.toLocaleString("vi-VN")}</Link>
                          ) : (
                            "…"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="jp-dash-side">
          <Panel title={t("recruiter.dashboard.chartTitle")}>
            <p className="jp-muted jp-dash-note">{t("recruiter.dashboard.chartLead")}</p>
            {recentJobs.length === 0 || applicantTotals.every((v) => v === 0) ? (
              <p className="jp-muted">{t("recruiter.dashboard.chartNoData")}</p>
            ) : (
              <div className="jp-bars">
                {recentJobs.map((job, i) => {
                  const a = applicants[i];
                  const count = a?.data?.total ?? 0;
                  return (
                    <div className="jp-bar-row" key={job.id}>
                      <div className="jp-bar-main">
                        <Link className="jp-bar-label" to={`/recruiter/jobs/${job.id}/applications`}>
                          {job.title}
                        </Link>
                        <div className="jp-bar-track">
                          {count > 0 && (
                            <span
                              className="jp-bar-fill"
                              style={{ width: `${Math.round((count / maxApplicants) * 100)}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <span className="jp-bar-value">{a?.isError ? "—" : a?.data ? count : "…"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title={t("recruiter.dashboard.quickTitle")}>
            <ul className="jp-quick">
              <li>
                <Link to="/recruiter/jobs/new">
                  <Icon name="plus" size={18} />
                  <span>{t("recruiter.nav.post")}</span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              <li>
                <Link to="/recruiter/jobs">
                  <Icon name="briefcase" size={18} />
                  <span>{t("recruiter.nav.jobs")}</span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              <li>
                <Link to="/recruiter/company">
                  <Icon name="building" size={18} />
                  <span>{t("recruiter.nav.company")}</span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              {isCompanyAdmin && (
                <>
                  <li>
                    <Link to="/recruiter/invite-codes">
                      <Icon name="mail" size={18} />
                      <span>{t("invite.navLabel")}</span>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                  <li>
                    <Link to="/recruiter/join-requests">
                      <Icon name="inbox" size={18} />
                      <span>{t("joinRequest.admin.navLabel")}</span>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </Panel>

          {company.data && (
            <Panel title={t("recruiter.dashboard.companyTitle")}>
              <p className="jp-dash-company">{company.data.company.name}</p>
              <p className="jp-muted jp-dash-note">
                {[company.data.company.industry, company.data.company.size, company.data.company.address]
                  .filter(Boolean)
                  .join(" · ") || t("company.noFacts")}
              </p>
              <Link className="jp-link" to="/recruiter/company">
                {t("recruiter.dashboard.companyLink")}
              </Link>
            </Panel>
          )}
        </div>
      </div>
    </RecruiterShell>
  );
}
