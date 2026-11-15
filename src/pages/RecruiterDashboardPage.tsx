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

const TILES: { status: RecruiterJobStatus; label: string }[] = [
  { status: "Active", label: "Tin đang mở" },
  { status: "Pending", label: "Chờ duyệt" },
  { status: "Closed", label: "Đã đóng" },
];

/** Real counts only: each tile is the `total` of a one-row request, and each row's applicant count is one too. */
export default function RecruiterDashboardPage() {
  useDocumentTitle("Nhà tuyển dụng: Tổng quan");
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
    <RecruiterShell
      title="Tổng quan tuyển dụng"
      lead="Đang mở · Chờ duyệt · Đã đóng"
    >
      {countError && (
        <Alert tone="error">{loadErrorMessage(countError.error, "số liệu tin tuyển dụng")}</Alert>
      )}

      <div className="jp-recruiter-tiles" role="list" aria-label="Số liệu tin tuyển dụng">
        {TILES.map((tile, i) => {
          const q = counts[i];
          return (
            <div className="jp-recruiter-tile" role="listitem" key={tile.status}>
              <span className="jp-recruiter-tile-label">{tile.label}</span>
              <strong className="jp-recruiter-tile-value">
                {q.isError ? "—" : q.data ? q.data.total.toLocaleString("vi-VN") : "…"}
              </strong>
            </div>
          );
        })}
      </div>

      <Panel
        title="Tin đăng gần đây"
        actions={<Link className="jp-link" to="/recruiter/jobs">Xem tất cả</Link>}
      >
        {recent.isPending && <SkeletonRows rows={3} label="Đang tải tin đăng" />}
        {recent.isError && (
          <Alert tone="error">{loadErrorMessage(recent.error, "danh sách tin đăng")}</Alert>
        )}
        {recent.data && recentJobs.length === 0 && (
          <EmptyState title="Bạn chưa có tin tuyển dụng nào." />
        )}
        {recentJobs.length > 0 && (
          <div className="jp-table-wrap">
            <table className="jp-table">
              <thead>
                <tr>
                  <th scope="col">Tin tuyển dụng</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Ngày đăng</th>
                  <th scope="col">Hồ sơ</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job, i) => {
                  const a = applicants[i];
                  return (
                    <tr key={job.id}>
                      <td><Link to={`/jobs/${job.id}`}>{job.title}</Link></td>
                      <td>{jobStatusLabel(job.status)}</td>
                      <td>{formatDate(job.createdAt)}</td>
                      <td>
                        {a?.isError ? "Chưa tải được" : a?.data ? `${a.data.total.toLocaleString("vi-VN")} hồ sơ` : "…"}
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
