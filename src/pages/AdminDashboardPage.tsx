import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "../components/AdminShell";
import { Alert, Button, Icon, Panel, SkeletonBlock, StatusMark } from "../components/ui";
import { fetchAdminHealth, fetchAdminStatistics } from "../lib/adminApi";
import { loadErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type Segment = { label: string; value: number; className: string };

/** A stacked proportion bar with a text legend; values are the real counts, never percentages alone. */
function StackBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  return (
    <div className="jp-mix">
      <div className="jp-stack" role="img" aria-label={label}>
        {total > 0 &&
          segments.map((s) =>
            s.value > 0 ? (
              <span
                key={s.label}
                className={s.className}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value.toLocaleString("vi-VN")}`}
              />
            ) : null,
          )}
      </div>
      <ul className="jp-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <i className={s.className} aria-hidden="true" />
            {s.label} <strong>{s.value.toLocaleString("vi-VN")}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function number(value: number | null | undefined, dash: string) {
  return value == null ? dash : value.toLocaleString("vi-VN");
}

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.documentTitles.dashboard"));
  // Two separate requests: a slow health check must not hold back the numbers, nor the reverse.
  const stats = useQuery({ queryKey: queryKeys.adminStats, queryFn: fetchAdminStatistics, staleTime: 0 });
  const health = useQuery({ queryKey: queryKeys.adminHealth, queryFn: fetchAdminHealth, staleTime: 0 });
  const s = stats.data;
  const online = health.data?.services.filter((svc) => svc.status === "online").length ?? null;
  const serviceCount = health.data?.services.length ?? null;
  const allOnline = online != null && serviceCount != null && online === serviceCount;

  const dash = t("admin.dashboard.noData");
  const sectionLabels: Record<string, string> = {
    users: t("admin.dashboard.sectionUsers"),
    jobs: t("admin.dashboard.sectionJobs"),
    applications: t("admin.dashboard.sectionApplications"),
  };
  const otherUsers =
    s == null ? 0 : Math.max(0, (s.totalUsers ?? 0) - (s.totalJobSeekers ?? 0) - (s.totalRecruiters ?? 0));
  const otherApps =
    s?.applicationStatus == null
      ? 0
      : Math.max(
          0,
          (s.totalApplications ?? 0) -
            s.applicationStatus.pending -
            s.applicationStatus.accepted -
            s.applicationStatus.rejected,
        );

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
                sections: s.unavailable.map((key) => sectionLabels[key] ?? key).join(", "),
              })}
            </Alert>
          )}

          <div className="jp-dash-tiles" role="list">
            <div className="jp-dash-tile is-total" role="listitem">
              <span className="jp-dash-tile-icon" aria-hidden="true">
                <Icon name="users" size={20} />
              </span>
              <span className="jp-dash-tile-body">
                <span className="jp-dash-tile-label">{t("admin.dashboard.tileUsers")}</span>
                <strong className="jp-dash-tile-value">{number(s.totalUsers, dash)}</strong>
                <span className="jp-dash-tile-sub">{t("admin.dashboard.tileUsersSub", {
                  seekers: number(s.totalJobSeekers, dash),
                  recruiters: number(s.totalRecruiters, dash),
                })}</span>
              </span>
            </div>
            <div className="jp-dash-tile is-open" role="listitem">
              <span className="jp-dash-tile-icon" aria-hidden="true">
                <Icon name="briefcase" size={20} />
              </span>
              <span className="jp-dash-tile-body">
                <span className="jp-dash-tile-label">{t("admin.dashboard.tileJobs")}</span>
                <strong className="jp-dash-tile-value">{number(s.activeJobs, dash)}</strong>
                <span className="jp-dash-tile-sub">{t("admin.dashboard.tileJobsSub", {
                  total: number(s.totalJobs, dash),
                })}</span>
              </span>
            </div>
            <div className="jp-dash-tile is-closed" role="listitem">
              <span className="jp-dash-tile-icon" aria-hidden="true">
                <Icon name="file" size={20} />
              </span>
              <span className="jp-dash-tile-body">
                <span className="jp-dash-tile-label">{t("admin.dashboard.tileApplications")}</span>
                <strong className="jp-dash-tile-value">{number(s.totalApplications, dash)}</strong>
                <span className="jp-dash-tile-sub">{t("admin.dashboard.tileApplicationsSub")}</span>
              </span>
            </div>
            <div className={`jp-dash-tile ${allOnline ? "is-open" : "is-warn"}`} role="listitem">
              <span className="jp-dash-tile-icon" aria-hidden="true">
                <Icon name={allOnline ? "checkCircle" : "alert"} size={20} />
              </span>
              <span className="jp-dash-tile-body">
                <span className="jp-dash-tile-label">{t("admin.dashboard.tileServices")}</span>
                <strong className="jp-dash-tile-value">
                  {online == null || serviceCount == null ? "…" : `${online}/${serviceCount}`}
                </strong>
                <span className="jp-dash-tile-sub">{t("admin.dashboard.tileServicesSub")}</span>
              </span>
            </div>
          </div>

          <div className="jp-dash-grid">
            <div className="jp-dash-col">
              <Panel title={t("admin.dashboard.groupUsers")}>
                <dl className="jp-metrics">
                  <div><dt>{t("admin.dashboard.total")}</dt><dd>{number(s.totalUsers, dash)}</dd></div>
                  <div><dt>{t("admin.dashboard.seekers")}</dt><dd>{number(s.totalJobSeekers, dash)}</dd></div>
                  <div><dt>{t("admin.dashboard.recruiters")}</dt><dd>{number(s.totalRecruiters, dash)}</dd></div>
                  <div><dt>{t("admin.dashboard.activeUsers")}</dt><dd>{number(s.activeUsers, dash)}</dd></div>
                  <div><dt>{t("admin.dashboard.newThisMonth")}</dt><dd>{number(s.newUsersThisMonth, dash)}</dd></div>
                </dl>
                <StackBar
                  label={t("admin.dashboard.groupUsers")}
                  segments={[
                    { label: t("admin.dashboard.seekers"), value: s.totalJobSeekers ?? 0, className: "seg-navy" },
                    { label: t("admin.dashboard.recruiters"), value: s.totalRecruiters ?? 0, className: "seg-amber" },
                    { label: t("admin.dashboard.other"), value: otherUsers, className: "seg-muted" },
                  ]}
                />
              </Panel>

              <Panel title={t("admin.dashboard.groupApplications")}>
                <dl className="jp-metrics">
                  <div><dt>{t("admin.dashboard.total")}</dt><dd>{number(s.totalApplications, dash)}</dd></div>
                  <div><dt>{t("admin.dashboard.statusPending")}</dt><dd>{number(s.applicationStatus?.pending ?? null, dash)}</dd></div>
                  <div><dt>{t("admin.dashboard.statusAccepted")}</dt><dd>{number(s.applicationStatus?.accepted ?? null, dash)}</dd></div>
                  <div><dt>{t("admin.dashboard.statusRejected")}</dt><dd>{number(s.applicationStatus?.rejected ?? null, dash)}</dd></div>
                </dl>
                <StackBar
                  label={t("admin.dashboard.groupApplications")}
                  segments={[
                    { label: t("admin.dashboard.statusPending"), value: s.applicationStatus?.pending ?? 0, className: "seg-amber" },
                    { label: t("admin.dashboard.statusAccepted"), value: s.applicationStatus?.accepted ?? 0, className: "seg-success" },
                    { label: t("admin.dashboard.statusRejected"), value: s.applicationStatus?.rejected ?? 0, className: "seg-danger" },
                    { label: t("admin.dashboard.other"), value: otherApps, className: "seg-muted" },
                  ]}
                />
              </Panel>
            </div>

            <div className="jp-dash-col">
              <Panel title={t("admin.dashboard.groupJobs")}>
                <dl className="jp-metrics">
                  <div><dt>{t("admin.dashboard.total")}</dt><dd>{number(s.totalJobs, dash)}</dd></div>
                  <div><dt>{t("admin.dashboard.visible")}</dt><dd>{number(s.activeJobs, dash)}</dd></div>
                </dl>
                <StackBar
                  label={t("admin.dashboard.groupJobs")}
                  segments={[
                    { label: t("admin.dashboard.visible"), value: s.activeJobs ?? 0, className: "seg-navy" },
                    {
                      label: t("admin.dashboard.notVisible"),
                      value: Math.max(0, (s.totalJobs ?? 0) - (s.activeJobs ?? 0)),
                      className: "seg-muted",
                    },
                  ]}
                />
              </Panel>

              <Panel title={t("admin.dashboard.healthTitle")}>
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
                  <ul className="jp-services">
                    {health.data.services.map((svc) => (
                      <li key={svc.name}>
                        <span className="jp-service-name">{svc.name}</span>
                        <StatusMark tone={svc.status === "online" ? "success" : "danger"}>
                          {svc.status === "online" ? t("admin.dashboard.online") : t("admin.dashboard.offline")}
                        </StatusMark>
                        <span className="jp-service-latency">
                          {svc.latencyMs == null ? dash : t("admin.dashboard.latency", { ms: svc.latencyMs.toLocaleString("vi-VN") })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
