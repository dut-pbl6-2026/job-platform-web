import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "../components/AdminShell";
import { AdminJobForm } from "../components/AdminJobForm";
import {
  Alert,
  Button,
  EmptyState,
  FactStrip,
  Field,
  Input,
  Pagination,
  Panel,
  Select,
  SkeletonRows,
  StatusMark,
  Textarea,
  type StatusTone,
} from "../components/ui";
import {
  ADMIN_JOB_STATUSES,
  createAdminJob,
  decideJob,
  fetchAdminJob,
  fetchAdminJobs,
  hardDeleteAdminJob,
  isAdminJobStatus,
  softDeleteAdminJob,
  updateAdminJob,
  type AdminJobInput,
} from "../lib/adminApi";
import { timeAgo } from "../lib/jobsApi";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import { categoryLabel, jobStatusLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import type { PendingJob } from "../types/admin";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 8;
const MISSING = "Chưa cập nhật";

const STATUS_TONE: Record<string, StatusTone> = {
  active: "success",
  pending: "warning",
  rejected: "danger",
  closed: "neutral",
  deleted: "neutral",
};

/** What is open under a row. One at a time, so a row never stacks a form on top of another. */
type Open = { id: string; kind: "read" | "edit" | "reject" | "delete" | "purge" };

export default function AdminJobsPage() {
  useDocumentTitle("Quản trị: Quản lý tin");
  const queryClient = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const rawStatus = sp.get("status") || "";
  const status = isAdminJobStatus(rawStatus) ? rawStatus : "";
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const [draftQ, setDraftQ] = useState(q);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Open | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { setDraftQ(q); }, [q]);

  const query = useQuery({
    queryKey: queryKeys.adminJobs({ q, status, page }),
    queryFn: () => fetchAdminJobs({ q, status, page, size: PAGE_SIZE }),
    staleTime: 0,
  });
  const data = query.data;
  const filtered = !!(q || status);

  // Removing the last job of page N > 0 empties that page; step back to one that still has jobs.
  useEffect(() => {
    if (data && data.items.length === 0 && page > 0) patchQuery({ page: page > 1 ? String(page - 1) : "" });
  }, [data, page]);

  function patchQuery(next: Record<string, string>) {
    const params = new URLSearchParams(sp);
    for (const [k, value] of Object.entries(next)) {
      if (value) params.set(k, value); else params.delete(k);
    }
    if (!("page" in next)) params.delete("page");
    setSp(params);
    setOpen(null);
  }

  function search(e: FormEvent) {
    e.preventDefault();
    patchQuery({ q: draftQ.trim() });
  }

  function toggle(id: string, kind: Open["kind"]) {
    setOpen((cur) => (cur?.id === id && cur.kind === kind ? null : { id, kind }));
    setReason("");
    setReasonErr(null);
    setActionErr(null);
    setDone(null);
  }

  /**
   * After any change: the admin lists and counts, and the public board and job page, which would
   * otherwise keep showing a deleted or edited job from cache until it goes stale.
   */
  async function refresh(jobId?: string) {
    if (jobId) {
      queryClient.removeQueries({ queryKey: queryKeys.job(jobId) });
      queryClient.removeQueries({ queryKey: queryKeys.adminJob(jobId) });
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.allJobs });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
    await queryClient.invalidateQueries({ queryKey: queryKeys.allAdminJobs });
  }

  async function run(jobId: string, action: () => Promise<string>, fallback: string) {
    setBusyId(jobId);
    setActionErr(null);
    setDone(null);
    try {
      const message = await action();
      setOpen(null);
      setReason("");
      setDone(message);
      await refresh(jobId);
    } catch (e: unknown) {
      // Someone else removed or changed the job meanwhile: show why, and reload the list.
      if (httpStatus(e) === 404 || httpStatus(e) === 409) void refresh(jobId);
      setActionErr(apiErrorMessage(e, fallback));
    } finally {
      setBusyId(null);
    }
  }

  function decide(job: PendingJob, approved: boolean) {
    // job-svc rejects without a reason (422); stop here instead of sending the request.
    if (!approved && !reason.trim()) {
      setReasonErr("Nhập lý do từ chối để gửi cho nhà tuyển dụng.");
      return;
    }
    setReasonErr(null);
    void run(job.id, () => decideJob(job.id, approved, approved ? undefined : reason.trim()), "Chưa cập nhật được tin. Vui lòng thử lại.");
  }

  async function create(input: AdminJobInput) {
    await createAdminJob(input);
    setCreating(false);
    setActionErr(null);
    setDone(`Đã đăng tin “${input.title}”.`);
    await refresh();
  }

  async function save(jobId: string, input: AdminJobInput) {
    await updateAdminJob(jobId, input);
    setOpen(null);
    setActionErr(null);
    setDone(`Đã lưu thay đổi cho tin “${input.title}”.`);
    await refresh(jobId);
  }

  const showing = status ? jobStatusLabel(status).toLowerCase() : null;

  return (
    <AdminShell
      title="Quản lý tin"
      lead="Tìm, tạo, sửa và xóa tin tuyển dụng. Tin chờ duyệt được duyệt hoặc từ chối ngay tại đây."
      actions={!creating && (
        <Button icon="plus" onClick={() => { setCreating(true); setOpen(null); setDone(null); setActionErr(null); }}>
          Tạo tin
        </Button>
      )}
    >
      {creating && (
        <Panel title="Tạo tin mới" className="jp-jobform-panel">
          <p className="jp-muted jp-jobform-note">Tin do quản trị viên tạo được đăng ngay, không qua bước duyệt.</p>
          <AdminJobForm
            idPrefix="new-job"
            submitLabel="Đăng tin"
            busyLabel="Đang đăng…"
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </Panel>
      )}

      <form className="jp-user-filters jp-job-filters" onSubmit={search} role="search" aria-label="Tìm tin tuyển dụng">
        <Field id="job-q" label="Tiêu đề tin" className="jp-user-filters-q">
          <Input type="search" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} autoComplete="off" />
        </Field>
        <Field id="job-status" label="Trạng thái">
          <Select value={status} onChange={(e) => patchQuery({ status: e.target.value })}>
            <option value="">Tất cả (trừ tin đã xóa)</option>
            {ADMIN_JOB_STATUSES.map((s) => <option key={s} value={s}>{jobStatusLabel(s)}</option>)}
          </Select>
        </Field>
        <Button type="submit" className="jp-user-filters-go">Tìm</Button>
      </form>

      {actionErr && <Alert tone="error">{actionErr}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}

      {query.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
              {query.isFetching ? "Đang thử lại…" : "Thử lại"}
            </Button>
          }
        >
          {loadErrorMessage(query.error, "danh sách tin")}
        </Alert>
      )}

      {query.isPending && <SkeletonRows rows={4} label="Đang tải danh sách tin" />}

      {data && data.items.length === 0 && page === 0 && (
        <EmptyState
          title={q ? "Không có tin nào khớp tìm kiếm" : showing ? `Không có tin ${showing}` : "Chưa có tin tuyển dụng"}
          action={filtered ? <Button variant="secondary" onClick={() => patchQuery({ q: "", status: "" })}>Xóa bộ lọc</Button> : undefined}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="jp-count" aria-live="polite">
            {data.total.toLocaleString("vi-VN")} tin{showing ? ` ${showing}` : ""}
          </p>
          <div className="jp-queue jp-queue--manage">
            <div className="jp-queue-head" aria-hidden="true">
              <span>Vị trí · Công ty</span>
              <span>Trạng thái</span>
              <span>Danh mục</span>
              <span>Đăng</span>
              <span className="jp-queue-head-actions">Thao tác</span>
            </div>
            <ol className="jp-queue-rows" aria-label="Tin tuyển dụng">
              {data.items.map((job) => {
                const kind = open?.id === job.id ? open.kind : null;
                const busy = busyId === job.id;
                const deleted = job.status === "deleted";
                const pending = job.status === "pending";
                return (
                  <li key={job.id} className="jp-queue-item">
                    <div className="jp-queue-row">
                      <div className="jp-row-main">
                        <h3 className="jp-row-title">{job.title}</h3>
                        <p className="jp-row-company" title={job.company.name}>{job.company.name || MISSING}</p>
                        {job.recruiterName && <p className="jp-queue-by">Người đăng: {job.recruiterName}</p>}
                      </div>
                      <span className="jp-cell">
                        <span className="jp-sr">Trạng thái: </span>
                        <StatusMark tone={STATUS_TONE[job.status] ?? "neutral"}>{jobStatusLabel(job.status)}</StatusMark>
                      </span>
                      <span className="jp-cell">
                        <span className="jp-sr">Danh mục: </span>
                        {categoryLabel(job.category.name)}
                      </span>
                      <span className="jp-cell jp-cell--date">
                        <span className="jp-sr">Đăng: </span>
                        {timeAgo(job.createdAt) || MISSING}
                      </span>
                      <div className="jp-queue-actions">
                        <Button variant="secondary" aria-expanded={kind === "read"} onClick={() => toggle(job.id, "read")}>
                          {kind === "read" ? "Ẩn nội dung" : "Xem nội dung"}
                        </Button>
                        {pending && (
                          <>
                            <Button loading={busy && kind !== "reject"} disabled={busy} aria-label={`Duyệt tin ${job.title}`} onClick={() => decide(job, true)}>
                              Duyệt
                            </Button>
                            <Button variant="danger" aria-expanded={kind === "reject"} aria-label={`Từ chối tin ${job.title}`} disabled={busy} onClick={() => toggle(job.id, "reject")}>
                              Từ chối
                            </Button>
                          </>
                        )}
                        {!pending && !deleted && (
                          <>
                            <Button variant="secondary" icon="pencil" aria-expanded={kind === "edit"} aria-label={`Sửa tin ${job.title}`} onClick={() => toggle(job.id, "edit")}>
                              Sửa
                            </Button>
                            <Button variant="danger" icon="trash" aria-expanded={kind === "delete"} aria-label={`Xóa tin ${job.title}`} onClick={() => toggle(job.id, "delete")}>
                              Xóa
                            </Button>
                          </>
                        )}
                        {deleted && (
                          <Button variant="danger" icon="trash" aria-expanded={kind === "purge"} aria-label={`Xóa vĩnh viễn tin ${job.title}`} onClick={() => toggle(job.id, "purge")}>
                            Xóa vĩnh viễn
                          </Button>
                        )}
                      </div>
                    </div>

                    {kind === "read" && (
                      <JobDetail jobId={job.id}>
                        {pending && (
                          <div className="jp-form-actions jp-queue-more">
                            <Button variant="secondary" icon="pencil" onClick={() => toggle(job.id, "edit")}>Sửa tin</Button>
                            <Button variant="danger" icon="trash" onClick={() => toggle(job.id, "delete")}>Xóa tin</Button>
                          </div>
                        )}
                      </JobDetail>
                    )}

                    {kind === "edit" && (
                      <EditJob job={job} onSave={(input) => save(job.id, input)} onCancel={() => setOpen(null)} />
                    )}

                    {kind === "reject" && (
                      <form className="jp-queue-reject" noValidate onSubmit={(e) => { e.preventDefault(); decide(job, false); }}>
                        <Field id={`reason-${job.id}`} label="Lý do từ chối" required hint="Nhà tuyển dụng sẽ nhận được nội dung này." error={reasonErr}>
                          <Textarea rows={3} maxLength={500} value={reason} placeholder="Ví dụ: thiếu mô tả công việc" onChange={(e) => setReason(e.target.value)} />
                        </Field>
                        <div className="jp-form-actions">
                          <Button variant="secondary" onClick={() => setOpen(null)} disabled={busy}>Hủy</Button>
                          <Button type="submit" variant="danger" loading={busy}>{busy ? "Đang gửi…" : "Xác nhận từ chối"}</Button>
                        </div>
                      </form>
                    )}

                    {kind === "delete" && (
                      <ConfirmBlock
                        label={`Xác nhận xóa tin ${job.title}`}
                        title="Xóa tin này?"
                        text="Tin sẽ ẩn khỏi bảng việc làm và ứng viên không mở được nữa. Bạn vẫn xem lại được trong bộ lọc “Đã xóa”."
                        confirm={busy ? "Đang xóa…" : "Xác nhận xóa"}
                        busy={busy}
                        onConfirm={() => void run(job.id, async () => { await softDeleteAdminJob(job.id); return `Đã xóa tin “${job.title}”.`; }, "Chưa xóa được tin. Vui lòng thử lại.")}
                        onCancel={() => setOpen(null)}
                      />
                    )}

                    {kind === "purge" && (
                      <ConfirmBlock
                        strong
                        label={`Xác nhận xóa vĩnh viễn tin ${job.title}`}
                        title="Xóa vĩnh viễn tin này?"
                        text="Tin sẽ bị xóa hẳn khỏi cơ sở dữ liệu. Thao tác này không thể hoàn tác."
                        confirm={busy ? "Đang xóa…" : "Xóa vĩnh viễn"}
                        busy={busy}
                        onConfirm={() => void run(job.id, async () => { await hardDeleteAdminJob(job.id); return `Đã xóa vĩnh viễn tin “${job.title}”.`; }, "Chưa xóa được tin. Vui lòng thử lại.")}
                        onCancel={() => setOpen(null)}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <Pagination page={page} totalPages={data.totalPages} onPage={(p) => patchQuery({ page: p ? String(p) : "" })} />
        </>
      )}
    </AdminShell>
  );
}

/** Full content of a job in any status: the list has no description, and /jobs/:id hides non-active jobs. */
function useAdminJob(jobId: string) {
  return useQuery({
    queryKey: queryKeys.adminJob(jobId),
    queryFn: async () => {
      const job = await fetchAdminJob(jobId);
      if (!job) throw Object.assign(new Error("Tin không còn tồn tại."), { status: 404 });
      return job;
    },
    staleTime: 0,
    retry: false,
  });
}

function JobDetail({ jobId, children }: { jobId: string; children?: ReactNode }) {
  const detail = useAdminJob(jobId);
  const job = detail.data;
  return (
    <div className="jp-queue-detail">
      {detail.isPending && <p className="jp-muted" role="status">Đang tải nội dung…</p>}
      {detail.isError && <Alert tone="error">{loadErrorMessage(detail.error, "nội dung tin")}</Alert>}
      {job && (
        <>
          {job.status === "rejected" && job.rejectionReason?.trim() && (
            <Alert tone="warning" title="Lý do từ chối">{job.rejectionReason}</Alert>
          )}
          <FactStrip job={job} />
          <JobText title="Mô tả công việc" text={job.description} />
          <JobText title="Yêu cầu" text={job.requirements} />
          <JobText title="Quyền lợi" text={job.benefits} />
          {children}
        </>
      )}
    </div>
  );
}

function EditJob({ job, onSave, onCancel }: { job: PendingJob; onSave: (input: AdminJobInput) => Promise<void>; onCancel: () => void }) {
  const detail = useAdminJob(job.id);
  return (
    <div className="jp-queue-detail jp-queue-edit">
      <h4 className="jp-h3">Sửa tin</h4>
      {detail.isPending && <p className="jp-muted" role="status">Đang tải nội dung tin…</p>}
      {detail.isError && <Alert tone="error">{loadErrorMessage(detail.error, "nội dung tin")}</Alert>}
      {detail.data && (
        <AdminJobForm
          idPrefix={`edit-${job.id}`}
          initial={detail.data}
          submitLabel="Lưu thay đổi"
          busyLabel="Đang lưu…"
          onSubmit={onSave}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

function ConfirmBlock({ label, title, text, confirm, busy, strong, onConfirm, onCancel }: {
  label: string;
  title: string;
  text: string;
  confirm: string;
  busy: boolean;
  strong?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={strong ? "jp-queue-confirm jp-queue-confirm--strong" : "jp-queue-confirm"} role="group" aria-label={label}>
      <div>
        <p className="jp-queue-confirm-title">{title}</p>
        <p className="jp-queue-confirm-text">{text}</p>
      </div>
      <div className="jp-form-actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>Hủy</Button>
        <Button variant="danger" loading={busy} onClick={onConfirm}>{confirm}</Button>
      </div>
    </div>
  );
}

function JobText({ title, text }: { title: string; text: string | null | undefined }) {
  return (
    <section className="jp-detail-section">
      <h4 className="jp-h3">{title}</h4>
      {text?.trim() ? <p className="jp-prose">{text}</p> : <p className="jp-muted">{MISSING}</p>}
    </section>
  );
}
