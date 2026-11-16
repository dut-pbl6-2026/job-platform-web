import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, EmptyState, Panel, SkeletonRows } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fetchApplicationsByJob } from "../lib/applicationsApi";
import { formatDate } from "../lib/dates";
import { loadErrorMessage } from "../lib/http";
import { jobStatusLabel } from "../lib/labels";
import { fetchRecruiterJobs, type RecruiterJobStatus } from "../lib/jobsApi";

const TILES: {
  status: RecruiterJobStatus;
  labelKey: "recruiter.dashboard.tiles.active" | "recruiter.dashboard.tiles.closed";
}[] = [
  { status: "Active", labelKey: "recruiter.dashboard.tiles.active" },
  { status: "Closed", labelKey: "recruiter.dashboard.tiles.closed" },
];

/** Real counts only: each tile is the `total` of a one-row request, and each row's applicant count is one too. */
export default function RecruiterDashboardPage() {
  const { t } = useTranslation();
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
    queryFn: () => fetchRecruiterJobs({ page: 1, size: 5 }),
    staleTime: 0,
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

  return (
    <RecruiterShell title={t("recruiter.dashboard.title")} lead={t("recruiter.dashboard.lead")}>
      {countError && (
        <Alert tone="error">{loadErrorMessage(countError.error, t("recruiter.dashboard.countWhat"))}</Alert>
      )}

      <div className="jp-recruiter-tiles" role="list" aria-label={t("recruiter.dashboard.tilesLabel")}>
        {TILES.map((tile, i) => {
          const q = counts[i];
          return (
            <div className="jp-recruiter-tile" role="listitem" key={tile.status}>
              <span className="jp-recruiter-tile-label">{t(tile.labelKey)}</span>
              <strong className="jp-recruiter-tile-value">
                {q.isError ? "—" : q.data ? q.data.total.toLocaleString("vi-VN") : "…"}
              </strong>
            </div>
          );
        })}
      </div>

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
                  <th scope="col">{t("recruiter.dashboard.colApplicants")}</th>
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
                      <td data-label={t("recruiter.dashboard.colStatus")}>{jobStatusLabel(job.status)}</td>
                      <td data-label={t("recruiter.dashboard.colPosted")}>{formatDate(job.createdAt)}</td>
                      <td data-label={t("recruiter.dashboard.colApplicants")}>
                        {a?.isError
                          ? t("recruiter.dashboard.applicantsFailed")
                          : a?.data
                            ? t("recruiter.dashboard.applicantsCount", { total: a.data.total.toLocaleString("vi-VN") })
                            : "…"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </RecruiterShell>
  );
}
