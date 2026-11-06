import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  ApplicationStatusMark,
  Button,
  ButtonLink,
  EmptyState,
  FilterChip,
  PageHead,
  Pagination,
  SkeletonRows,
  TopBar,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { fetchMyApplications } from "../lib/applicationsApi";
import { formatDate } from "../lib/dates";
import { loadErrorMessage } from "../lib/http";
import { locationLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import type { Application, ApplicationStatus } from "../types/application";
import { APPLICATION_STATUSES, STATUS_LABEL } from "../types/application";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 8;

function parseStatus(raw: string | null): ApplicationStatus | "" {
  return APPLICATION_STATUSES.find((s) => s === raw) ?? "";
}

export default function ApplicationHistoryPage() {
  useDocumentTitle("Đơn ứng tuyển của tôi");
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const status = parseStatus(sp.get("status"));
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const candidate = isUser(user?.role);

  const query = useQuery({
    queryKey: queryKeys.applications({ userId: user?.id, status, page }),
    queryFn: () => fetchMyApplications({ status: status || undefined, page, size: PAGE_SIZE, userId: user!.id }),
    enabled: !!user && candidate,
    // A CV sent a minute ago must show up here, so this list is never served from the 5-minute cache.
    staleTime: 0,
  });

  if (!candidate) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <EmptyState
            title="Trang này dành cho người tìm việc."
            action={<ButtonLink to="/jobs">Xem bảng việc làm</ButtonLink>}
          />
        </main>
      </>
    );
  }

  function setFilter(next: ApplicationStatus | "") {
    const params = new URLSearchParams(sp);
    if (next) params.set("status", next);
    else params.delete("status");
    params.delete("page");
    setSp(params);
  }

  function setPage(next: number) {
    const params = new URLSearchParams(sp);
    if (next) params.set("page", String(next));
    else params.delete("page");
    setSp(params);
    window.scrollTo({ top: 0 });
  }

  const data = query.data;
  const failure = query.isError ? loadErrorMessage(query.error, "danh sách đơn ứng tuyển") : null;

  return (
    <>
      <TopBar />
      <main className="jp-page">
        <PageHead title="Đơn của tôi" lead="Theo dõi trạng thái từng lần ứng tuyển." />

        <div className="jp-filter-row" role="group" aria-label="Lọc theo trạng thái">
          <FilterChip pressed={!status} onClick={() => setFilter("")}>Tất cả</FilterChip>
          {APPLICATION_STATUSES.map((s) => (
            <FilterChip key={s} pressed={status === s} onClick={() => setFilter(s)}>
              {STATUS_LABEL[s]}
            </FilterChip>
          ))}
        </div>

        {failure && (
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
                {query.isFetching ? "Đang thử lại…" : "Thử lại"}
              </Button>
            }
          >
            {failure}
          </Alert>
        )}

        {query.isPending && <SkeletonRows rows={5} label="Đang tải đơn ứng tuyển" />}

        {data && data.items.length === 0 && (
          <EmptyState
            title={status ? `Không có đơn nào ở trạng thái “${STATUS_LABEL[status]}”` : "Chưa có đơn nào"}
            action={
              status ? (
                <Button variant="secondary" onClick={() => setFilter("")}>Xem tất cả đơn</Button>
              ) : (
                <ButtonLink to="/jobs">Xem bảng việc làm</ButtonLink>
              )
            }
          >
            {!status && <p>Ứng tuyển một việc làm để theo dõi tại đây.</p>}
          </EmptyState>
        )}

        {data && data.items.length > 0 && (
          <>
            <p className="jp-count" aria-live="polite">{data.total.toLocaleString("vi-VN")} đơn</p>
            <div className="jp-apps">
              <div className="jp-apps-head" aria-hidden="true">
                <span>Vị trí · Công ty</span>
                <span>Nơi làm</span>
                <span>Ngày nộp</span>
                <span>Trạng thái</span>
              </div>
              <ol className="jp-apps-rows" aria-label="Đơn ứng tuyển">
                {data.items.map((a) => <ApplicationRow key={a.id} app={a} />)}
              </ol>
            </div>
            <Pagination page={page} totalPages={data.totalPages} onPage={setPage} />
          </>
        )}
      </main>
    </>
  );
}

function ApplicationRow({ app }: { app: Application }) {
  const company = app.companyName?.trim() || "Chưa cập nhật";
  return (
    <li className="jp-app-row">
      <div className="jp-row-main">
        <h3 className="jp-row-title">
          <Link to={`/applications/${app.id}`} className="jp-row-link">{app.jobTitle || "Tin tuyển dụng"}</Link>
        </h3>
        <p className="jp-row-company" title={company}>{company}</p>
      </div>
      <span className="jp-cell">
        <span className="jp-sr">Nơi làm: </span>
        {locationLabel(app.location)}
      </span>
      <span className="jp-cell jp-cell--date">
        <span className="jp-sr">Ngày nộp: </span>
        {formatDate(app.createdAt) || "Chưa cập nhật"}
      </span>
      <span className="jp-cell jp-cell--status">
        <span className="jp-sr">Trạng thái: </span>
        <ApplicationStatusMark status={app.status} />
      </span>
    </li>
  );
}
