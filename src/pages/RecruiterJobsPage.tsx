import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, Button, ButtonLink, EmptyState, FilterChip, Pagination, SkeletonRows } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDate } from "../lib/dates";
import { loadErrorMessage } from "../lib/http";
import { jobStatusLabel, locationLabel } from "../lib/labels";
import { fetchRecruiterJobs, type RecruiterJobStatus } from "../lib/jobsApi";

const FILTERS: { value: RecruiterJobStatus | ""; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "Active", label: "Đang mở" },
  { value: "Pending", label: "Chờ duyệt" },
  { value: "Closed", label: "Đã đóng" },
];

const PAGE_SIZE = 10;

function parseStatus(raw: string | null): RecruiterJobStatus | "" {
  return FILTERS.some((f) => f.value === raw) ? (raw as RecruiterJobStatus | "") : "";
}

export default function RecruiterJobsPage() {
  useDocumentTitle("Nhà tuyển dụng: Tin tuyển dụng");
  const [params, setParams] = useSearchParams();
  const status = parseStatus(params.get("status"));
  // The URL is 1-based, like the API. The Pagination component counts from 0.
  const page = Math.max(1, Number(params.get("page")) || 1);

  const list = useQuery({
    queryKey: ["recruiter", "jobs", "list", status, page],
    queryFn: () => fetchRecruiterJobs({ page, size: PAGE_SIZE, status: status || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  function patch(next: { status?: RecruiterJobStatus | ""; page?: number }) {
    const merged = new URLSearchParams(params);
    if (next.status !== undefined) {
      if (next.status) merged.set("status", next.status);
      else merged.delete("status");
      merged.delete("page");
    }
    if (next.page !== undefined) {
      if (next.page > 1) merged.set("page", String(next.page));
      else merged.delete("page");
    }
    setParams(merged);
  }

  const data = list.data;

  return (
    <RecruiterShell
      title="Quản lý tin tuyển dụng"
      lead="Các tin bạn đã đăng, theo trạng thái."
      actions={<ButtonLink to="/recruiter/jobs/new">Đăng tin mới</ButtonLink>}
    >
      <div className="jp-recruiter-filters" role="group" aria-label="Lọc theo trạng thái">
        {FILTERS.map((f) => (
          <FilterChip key={f.value || "all"} pressed={status === f.value} onClick={() => patch({ status: f.value })}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      {list.isPending && <SkeletonRows rows={5} label="Đang tải tin tuyển dụng" />}

      {list.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={list.isFetching} onClick={() => void list.refetch()}>
              {list.isFetching ? "Đang thử lại…" : "Thử lại"}
            </Button>
          }
        >
          {loadErrorMessage(list.error, "danh sách tin tuyển dụng")}
        </Alert>
      )}

      {data && data.items.length === 0 && (
        <EmptyState title={status ? "Không có tin nào ở trạng thái này." : "Bạn chưa có tin tuyển dụng nào."} />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="jp-table-wrap">
            <table className="jp-table">
              <thead>
                <tr>
                  <th scope="col">Tin tuyển dụng</th>
                  <th scope="col">Địa điểm</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Ngày đăng</th>
                  <th scope="col"><span className="jp-sr-only">Hồ sơ</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((job) => (
                  <tr key={job.id}>
                    <td><Link to={`/jobs/${job.id}`}>{job.title}</Link></td>
                    <td>{locationLabel(job.location)}</td>
                    <td>{jobStatusLabel(job.status)}</td>
                    <td>{formatDate(job.createdAt)}</td>
                    <td><Link to={`/recruiter/jobs/${job.id}/applications`}>Xem ứng viên</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page - 1}
            totalPages={data.totalPages}
            onPage={(p) => patch({ page: p + 1 })}
          />
        </>
      )}
    </RecruiterShell>
  );
}
