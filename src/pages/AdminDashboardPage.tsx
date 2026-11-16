import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "../components/AdminShell";
import { Alert, Button, Donut, Icon, MeterRow, Panel, SkeletonBlock } from "../components/ui";
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
  const maxLatency = Math.max(1, ...(health.data?.services.map((svc) => svc.latencyMs ?? 0) ?? [0]));

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

          <div className="jp-chart-grid">
            <Panel title={t("admin.dashboard.groupUsers")}>
              <p className="jp-dash-note">{t("admin.dashboard.usersLead")}</p>
              <Donut
                label={t("admin.dashboard.groupUsers")}
                centerValue={number(s.totalUsers, dash)}
                centerLabel={t("admin.dashboard.centerUsers")}
                slices={[
                  { label: t("admin.dashboard.seekers"), value: s.totalJobSeekers ?? 0, color: "var(--c-navy)" },
                  { label: t("admin.dashboard.recruiters"), value: s.totalRecruiters ?? 0, color: "var(--c-amber)" },
                  { label: t("admin.dashboard.other"), value: otherUsers, color: "var(--c-control)" },
                ]}
              />
              <p className="jp-chart-foot">
                {t("admin.dashboard.usersFoot", {
                  active: number(s.activeUsers, dash),
                  newUsers: number(s.newUsersThisMonth, dash),
                })}
              </p>
            </Panel>

            <Panel title={t("admin.dashboard.groupApplications")}>
              <p className="jp-dash-note">{t("admin.dashboard.appsLead")}</p>
              <Donut
                label={t("admin.dashboard.groupApplications")}
                centerValue={number(s.totalApplications, dash)}
                centerLabel={t("admin.dashboard.centerApps")}
                slices={[
                  {
                    label: t("admin.dashboard.statusPending"),
                    value: s.applicationStatus?.pending ?? 0,
                    color: "var(--c-amber)",
                  },
                  {
                    label: t("admin.dashboard.statusAccepted"),
                    value: s.applicationStatus?.accepted ?? 0,
                    color: "var(--c-success)",
                  },
                  {
                    label: t("admin.dashboard.statusRejected"),
                    value: s.applicationStatus?.rejected ?? 0,
                    color: "var(--c-danger)",
                  },
                  { label: t("admin.dashboard.other"), value: otherApps, color: "var(--c-control)" },
                ]}
              />
            </Panel>

            <Panel title={t("admin.dashboard.groupJobs")}>
              <p className="jp-dash-note">{t("admin.dashboard.jobsLead")}</p>
              <div className="jp-bignum">
                <strong>{number(s.totalJobs, dash)}</strong>
                <span>{t("admin.dashboard.tileJobsSub", { total: number(s.totalJobs, dash) })}</span>
              </div>
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
              <p className="jp-chart-foot">
                {t("admin.dashboard.jobsFoot", {
                  visible: number(s.activeJobs, dash),
                  total: number(s.totalJobs, dash),
                })}
              </p>
            </Panel>
          </div>

          <Panel title={t("admin.dashboard.healthTitle")}>
            <p className="jp-dash-note">{t("admin.dashboard.servicesLead")}</p>
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
              <div className="jp-service-charts">
                <Donut
                  size={132}
                  label={t("admin.dashboard.healthTitle")}
                  centerValue={online == null || serviceCount == null ? "…" : `${online}/${serviceCount}`}
                  centerLabel={t("admin.dashboard.centerServices")}
                  slices={[
                    { label: t("admin.dashboard.online"), value: online ?? 0, color: "var(--c-success)" },
                    {
                      label: t("admin.dashboard.offline"),
                      value: Math.max(0, (serviceCount ?? 0) - (online ?? 0)),
                      color: "var(--c-danger)",
                    },
                  ]}
                />
                <div className="jp-service-meters">
                  {health.data.services.map((svc) => (
                    <MeterRow
                      key={svc.name}
                      label={svc.name}
                      value={svc.latencyMs ?? 0}
                      max={maxLatency}
                      display={
                        svc.latencyMs == null
                          ? t("admin.dashboard.offline")
                          : t("admin.dashboard.latency", { ms: svc.latencyMs.toLocaleString("vi-VN") })
                      }
                      tone={svc.status === "online" ? "success" : "danger"}
                    />
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </>
      )}
    </AdminShell>
  );
}
