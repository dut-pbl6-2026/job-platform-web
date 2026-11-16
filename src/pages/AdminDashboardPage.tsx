import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "../components/AdminShell";
import { Alert, Button, SkeletonBlock, StatusMark } from "../components/ui";
import { fetchAdminHealth, fetchAdminStatistics } from "../lib/adminApi";
import { loadErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";
import { STATUS_LABEL } from "../types/application";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const SECTION_KEY = {
  users: "admin.dashboard.sectionUsers",
  jobs: "admin.dashboard.sectionJobs",
  applications: "admin.dashboard.sectionApplications",
} as const;

type Cell = { label: string; value: number | null; to?: string };

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.documentTitles.dashboard"));
  // Two separate requests: a slow health check must not hold back the numbers, nor the reverse.
  const stats = useQuery({ queryKey: queryKeys.adminStats, queryFn: fetchAdminStatistics, staleTime: 0 });
  const health = useQuery({ queryKey: queryKeys.adminHealth, queryFn: fetchAdminHealth, staleTime: 0 });
  const s = stats.data;

  return (
    <AdminShell title={t("admin.dashboard.title")} lead={t("admin.dashboard.lead")}>
      {stats.isPending && <SkeletonBlock height={240} label={t("admin.dashboard.loading")} />}

      {stats.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={stats.isFetching} onClick={() => void stats.refetch()}>
              {stats.isFetching ? t("jobs.retrying") : t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(stats.error, t("admin.dashboard.statsWhat"))}
        </Alert>
      )}

      {s && (
        <>
          {s.unavailable.length > 0 && (
            <Alert tone="warning">
              {t("admin.dashboard.unavailable", {
                sections: s.unavailable.map((key) => t(SECTION_KEY[key])).join(", "),
              })}
            </Alert>
          )}
          <div className="jp-stat-groups">
            <StatGroup
              title={t("admin.dashboard.groupUsers")}
              className="jp-statgroup--wide"
              cells={[
                { label: t("admin.dashboard.total"), value: s.totalUsers },
                { label: t("admin.dashboard.seekers"), value: s.totalJobSeekers },
                { label: t("admin.dashboard.recruiters"), value: s.totalRecruiters },
                { label: t("admin.dashboard.activeUsers"), value: s.activeUsers },
                { label: t("admin.dashboard.newThisMonth"), value: s.newUsersThisMonth },
              ]}
            />
            <StatGroup
              title={t("admin.dashboard.groupJobs")}
              cells={[
                { label: t("admin.dashboard.total"), value: s.totalJobs },
                { label: t("admin.dashboard.visible"), value: s.activeJobs },
              ]}
            />
            <StatGroup
              title={t("admin.dashboard.groupApplications")}
              cells={[
                { label: t("admin.dashboard.total"), value: s.totalApplications },
                { label: STATUS_LABEL.pending, value: s.applicationStatus?.pending ?? null },
                { label: STATUS_LABEL.accepted, value: s.applicationStatus?.accepted ?? null },
                { label: STATUS_LABEL.rejected, value: s.applicationStatus?.rejected ?? null },
              ]}
            />
          </div>
        </>
      )}

      <section className="jp-health" aria-labelledby="health-title">
        <h2 className="jp-h2" id="health-title">
          {t("admin.dashboard.healthTitle")}
        </h2>
        {health.isPending && <SkeletonBlock height={120} label={t("admin.dashboard.checkingHealth")} />}
        {health.isError && (
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={health.isFetching} onClick={() => void health.refetch()}>
                {health.isFetching ? t("jobs.retrying") : t("jobs.retry")}
              </Button>
            }
          >
            {loadErrorMessage(health.error, t("admin.dashboard.healthWhat"))}
          </Alert>
        )}
        {health.data && (
          <div className="jp-table-wrap">
            <table className="jp-table">
              <thead>
                <tr>
                  <th scope="col">{t("admin.dashboard.colService")}</th>
                  <th scope="col">{t("admin.dashboard.colStatus")}</th>
                  <th scope="col" className="jp-num">
                    {t("admin.dashboard.colLatency")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {health.data.services.map((svc) => (
                  <tr key={svc.name}>
                    <th scope="row">{svc.name}</th>
                    <td>
                      <StatusMark tone={svc.status === "online" ? "success" : "danger"}>
                        {svc.status === "online" ? t("admin.dashboard.online") : t("admin.dashboard.offline")}
                      </StatusMark>
                    </td>
                    <td className="jp-num">
                      {svc.latencyMs == null ? (
                        <Dash />
                      ) : (
                        t("admin.dashboard.latency", { ms: svc.latencyMs.toLocaleString("vi-VN") })
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function Dash() {
  const { t } = useTranslation();
  return (
    <>
      <span aria-hidden="true" className="jp-missing">
        —
      </span>
      <span className="jp-sr">{t("admin.dashboard.noData")}</span>
    </>
  );
}

/** One topic of numbers under a navy header band, like a board: label above value, one row of cells. */
function StatGroup({ title, cells, className }: { title: string; cells: Cell[]; className?: string }) {
  return (
    <section className={["jp-statgroup", className].filter(Boolean).join(" ")}>
      <h2 className="jp-statgroup-title">{title}</h2>
      <dl className="jp-stats">
        {cells.map((c) => (
          <div key={c.label} className="jp-stat">
            <dt>{c.label}</dt>
            <dd>
              {c.value == null ? (
                <Dash />
              ) : c.to ? (
                <Link to={c.to} className="jp-link">
                  {c.value.toLocaleString("vi-VN")}
                </Link>
              ) : (
                c.value.toLocaleString("vi-VN")
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
