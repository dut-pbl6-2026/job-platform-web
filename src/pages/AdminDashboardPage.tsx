import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "../components/AdminShell";
import { Alert, Button, ButtonLink, SkeletonBlock, StatusMark } from "../components/ui";
import { fetchAdminHealth, fetchAdminStatistics } from "../lib/adminApi";
import { loadErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";
import type { AdminStatistics } from "../types/admin";
import { STATUS_LABEL } from "../types/application";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const SECTION_LABEL: Record<AdminStatistics["unavailable"][number], string> = {
  users: "người dùng",
  jobs: "tin đăng",
  applications: "đơn ứng tuyển",
};

type Cell = { label: string; value: number | null; to?: string };

export default function AdminDashboardPage() {
  useDocumentTitle("Quản trị: Tổng quan");
  // Two separate requests: a slow health check must not hold back the numbers, nor the reverse.
  const stats = useQuery({ queryKey: queryKeys.adminStats, queryFn: fetchAdminStatistics, staleTime: 0 });
  const health = useQuery({ queryKey: queryKeys.adminHealth, queryFn: fetchAdminHealth, staleTime: 0 });
  const s = stats.data;
  const pending = s?.pendingJobs ?? 0;

  return (
    <AdminShell
      title="Bảng quản trị"
      lead="Số liệu nền tảng và tình trạng các dịch vụ."
      actions={pending > 0 ? <ButtonLink to="/admin/jobs?status=Pending">Duyệt {pending.toLocaleString("vi-VN")} tin chờ duyệt</ButtonLink> : undefined}
    >
      {stats.isPending && <SkeletonBlock height={240} label="Đang tải số liệu" />}

      {stats.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={stats.isFetching} onClick={() => void stats.refetch()}>
              {stats.isFetching ? "Đang thử lại…" : "Thử lại"}
            </Button>
          }
        >
          {loadErrorMessage(stats.error, "số liệu thống kê")}
        </Alert>
      )}

      {s && (
        <>
          {s.unavailable.length > 0 && (
            <Alert tone="warning">
              Chưa lấy được số liệu {s.unavailable.map((key) => SECTION_LABEL[key]).join(", ")}: dịch vụ không phản hồi.
            </Alert>
          )}
          <div className="jp-stat-groups">
            <StatGroup
              title="Người dùng"
              className="jp-statgroup--wide"
              cells={[
                { label: "Tổng số", value: s.totalUsers },
                { label: "Người tìm việc", value: s.totalJobSeekers },
                { label: "Nhà tuyển dụng", value: s.totalRecruiters },
                { label: "Đang hoạt động", value: s.activeUsers },
                { label: "Mới tháng này", value: s.newUsersThisMonth },
              ]}
            />
            <StatGroup
              title="Tin đăng"
              cells={[
                { label: "Tổng số", value: s.totalJobs },
                { label: "Đang hiển thị", value: s.activeJobs },
                { label: "Chờ duyệt", value: s.pendingJobs, to: "/admin/jobs?status=Pending" },
              ]}
            />
            <StatGroup
              title="Đơn ứng tuyển"
              cells={[
                { label: "Tổng số", value: s.totalApplications },
                { label: STATUS_LABEL.pending, value: s.applicationStatus?.pending ?? null },
                { label: STATUS_LABEL.accepted, value: s.applicationStatus?.accepted ?? null },
                { label: STATUS_LABEL.rejected, value: s.applicationStatus?.rejected ?? null },
              ]}
            />
          </div>
        </>
      )}

      <section className="jp-health" aria-labelledby="health-title">
        <h2 className="jp-h2" id="health-title">Tình trạng dịch vụ</h2>
        {health.isPending && <SkeletonBlock height={120} label="Đang kiểm tra dịch vụ" />}
        {health.isError && (
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={health.isFetching} onClick={() => void health.refetch()}>
                {health.isFetching ? "Đang thử lại…" : "Thử lại"}
              </Button>
            }
          >
            {loadErrorMessage(health.error, "tình trạng dịch vụ")}
          </Alert>
        )}
        {health.data && (
          <div className="jp-table-wrap">
            <table className="jp-table">
              <thead>
                <tr>
                  <th scope="col">Dịch vụ</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" className="jp-num">Độ trễ</th>
                </tr>
              </thead>
              <tbody>
                {health.data.services.map((svc) => (
                  <tr key={svc.name}>
                    <th scope="row">{svc.name}</th>
                    <td>
                      <StatusMark tone={svc.status === "online" ? "success" : "danger"}>
                        {svc.status === "online" ? "Hoạt động" : "Không phản hồi"}
                      </StatusMark>
                    </td>
                    <td className="jp-num">{svc.latencyMs == null ? <Dash /> : `${svc.latencyMs.toLocaleString("vi-VN")} ms`}</td>
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
  return (
    <>
      <span aria-hidden="true" className="jp-missing">—</span>
      <span className="jp-sr">Chưa có số liệu</span>
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
                <Link to={c.to} className="jp-link">{c.value.toLocaleString("vi-VN")}</Link>
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
