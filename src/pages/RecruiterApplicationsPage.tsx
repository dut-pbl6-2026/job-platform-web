import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, BackLink, Button, EmptyState, FilterChip, Pagination, SkeletonRows } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { downloadCv, fetchApplicationsByJob, fetchStatusFlow, updateApplicationStatus } from "../lib/applicationsApi";
import { formatDate } from "../lib/dates";
import { httpStatus, loadErrorMessage, apiErrorMessage } from "../lib/http";
import { fetchJobById } from "../lib/jobsApi";
import { queryKeys } from "../lib/queryClient";
import { showToast } from "../lib/toastBus";
import { APPLICATION_STATUSES, STATUS_LABEL, type ApplicationStatus } from "../types/application";

const PAGE_SIZE = 20;

function parseStatus(raw: string | null): ApplicationStatus | "" {
  return (APPLICATION_STATUSES as string[]).includes(raw ?? "") ? (raw as ApplicationStatus) : "";
}

/**
 * Applications for one job. The API has no candidate name (ApplicationSummaryDto carries only
 * applicantId), so rows show the application date, status, cover letter and CV. Ids are never shown.
 */
export default function RecruiterApplicationsPage() {
  const { jobId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const status = parseStatus(params.get("status"));
  const page = Math.max(1, Number(params.get("page")) || 1);
  useDocumentTitle("Nhà tuyển dụng: Hồ sơ ứng viên");
  const [cvError, setCvError] = useState<string | null>(null);

  const job = useQuery({
    queryKey: queryKeys.job(jobId),
    queryFn: () => fetchJobById(jobId),
    enabled: !!jobId,
    staleTime: 60_000,
  });
  const flow = useQuery({
    queryKey: ["applications", "status-flow"],
    queryFn: fetchStatusFlow,
    staleTime: 10 * 60_000,
  });
  const list = useQuery({
    queryKey: ["recruiter", "applications", jobId, status, page],
    queryFn: () => fetchApplicationsByJob(jobId, { page, size: PAGE_SIZE, status: status || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ApplicationStatus }) => updateApplicationStatus(id, next),
    onSuccess: (_data, vars) => {
      showToast({ title: `Đã cập nhật trạng thái ứng viên thành: ${STATUS_LABEL[vars.next]}`, kind: "success" });
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "applications", jobId] });
    },
  });

  function patch(next: { status?: ApplicationStatus | ""; page?: number }) {
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

  function errorFor(e: unknown): string {
    // 409: the status changed on the server since this list loaded. The backend message is English, so it is not shown.
    if (httpStatus(e) === 409) return "Trạng thái hồ sơ đã thay đổi. Danh sách vừa được làm mới, hãy thử lại.";
    return apiErrorMessage(e, "Không cập nhật được trạng thái. Vui lòng thử lại.");
  }

  const data = list.data;
  const flowMap = flow.data ?? {};
  const title = job.data?.title ? `Hồ sơ ứng viên: ${job.data.title}` : "Hồ sơ ứng viên";

  return (
    <RecruiterShell
      title={title}
      lead="Xem hồ sơ, tải CV và cập nhật trạng thái theo quy trình."
      back={<BackLink to="/recruiter/jobs">Tin tuyển dụng</BackLink>}
    >
      <div className="jp-recruiter-filters" role="group" aria-label="Lọc theo trạng thái hồ sơ">
        <FilterChip pressed={status === ""} onClick={() => patch({ status: "" })}>
          Tất cả
        </FilterChip>
        {APPLICATION_STATUSES.map((s) => (
          <FilterChip key={s} pressed={status === s} onClick={() => patch({ status: s })}>
            {STATUS_LABEL[s]}
          </FilterChip>
        ))}
      </div>

      {cvError && <Alert tone="error">{cvError}</Alert>}
      {update.isError && <Alert tone="error">{errorFor(update.error)}</Alert>}

      {list.isPending && <SkeletonRows rows={4} label="Đang tải hồ sơ" />}

      {list.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={list.isFetching} onClick={() => void list.refetch()}>
              {list.isFetching ? "Đang thử lại…" : "Thử lại"}
            </Button>
          }
        >
          {loadErrorMessage(list.error, "danh sách hồ sơ")}
        </Alert>
      )}

      {data && data.items.length === 0 && (
        <EmptyState title={status ? "Không có hồ sơ ở trạng thái này." : "Tin này chưa có hồ sơ ứng tuyển."} />
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="jp-recruiter-apps" aria-label="Danh sách hồ sơ ứng tuyển">
            {data.items.map((app) => {
              const next = (flowMap[app.status] ?? []) as ApplicationStatus[];
              return (
                <li className="jp-recruiter-app" key={app.id}>
                  <div className="jp-recruiter-app-head">
                    <span className="jp-recruiter-app-date">Ứng tuyển: {formatDate(app.createdAt)}</span>
                    <span className="jp-recruiter-app-status">{STATUS_LABEL[app.status]}</span>
                  </div>
                  {app.coverLetter && (
                    <details className="jp-recruiter-app-letter">
                      <summary>Thư ứng tuyển</summary>
                      <p>{app.coverLetter}</p>
                    </details>
                  )}
                  <div className="jp-recruiter-app-actions">
                    {app.cvUrl && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const cv = app.cvUrl ?? "";
                          setCvError(null);
                          downloadCv(cv).catch(() => setCvError("Không tải được CV. Vui lòng thử lại."));
                        }}
                      >
                        Xem CV
                      </Button>
                    )}
                    {next.length > 0 ? (
                      <form
                        className="jp-recruiter-app-status-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = new FormData(e.currentTarget);
                          const value = String(form.get("next") ?? "") as ApplicationStatus;
                          if (value) update.mutate({ id: app.id, next: value });
                        }}
                      >
                        <label className="jp-sr-only" htmlFor={`next-${app.id}`}>
                          Cập nhật trạng thái
                        </label>
                        <select id={`next-${app.id}`} name="next" className="jp-input" defaultValue="" required>
                          <option value="" disabled>
                            Chọn trạng thái mới
                          </option>
                          {next.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" loading={update.isPending && update.variables?.id === app.id}>
                          Cập nhật
                        </Button>
                      </form>
                    ) : (
                      <span className="jp-muted">Đã kết thúc quy trình</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page - 1} totalPages={data.totalPages} onPage={(p) => patch({ page: p + 1 })} />
        </>
      )}
    </RecruiterShell>
  );
}
