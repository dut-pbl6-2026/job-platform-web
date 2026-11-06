import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import {
  Alert,
  Button,
  EmptyState,
  FactStrip,
  Field,
  Pagination,
  SkeletonRows,
  Textarea,
} from "../components/ui";
import { decideJob, fetchAdminJob, fetchPendingJobs } from "../lib/adminApi";
import { timeAgo } from "../lib/jobsApi";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { categoryLabel } from "../lib/labels";
import type { Paginated, PendingJob } from "../types/admin";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 6;
const MISSING = "Chưa cập nhật";

export default function AdminJobsPage() {
  useDocumentTitle("Quản trị: Duyệt tin");
  const [sp, setSp] = useSearchParams();
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const [data, setData] = useState<Paginated<PendingJob> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState<string | null>(null);
  // Content of the job being read: the list has no description, and /jobs/:id hides Pending jobs.
  const [viewId, setViewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PendingJob | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const detailReq = useRef(0);

  async function toggleDetail(jobId: string) {
    const req = ++detailReq.current;
    if (viewId === jobId) { setViewId(null); return; }
    setViewId(jobId);
    setDetail(null);
    setDetailErr(null);
    try {
      const job = await fetchAdminJob(jobId);
      if (req !== detailReq.current) return;
      if (job) setDetail(job);
      else setDetailErr("Tin không còn tồn tại.");
    } catch (e: unknown) {
      if (req === detailReq.current) setDetailErr(loadErrorMessage(e, "nội dung tin"));
    }
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(sp);
    if (p) next.set("page", String(p)); else next.delete("page");
    setSp(next);
  }

  async function load() {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetchPendingJobs({ page, size: PAGE_SIZE });
      // Deciding the last job on page N > 0 empties that page; earlier pages may still have jobs.
      if (res.items.length === 0 && page > 0) {
        goToPage(page - 1);
        return;
      }
      setData(res);
    } catch (e: unknown) {
      setLoadErr(loadErrorMessage(e, "danh sách tin chờ duyệt"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [page]);

  async function decide(jobId: string, approved: boolean) {
    // job-svc rejects without a reason (422); stop here instead of sending the request.
    if (!approved && !reason.trim()) {
      setReasonErr("Nhập lý do từ chối để gửi cho nhà tuyển dụng.");
      return;
    }
    setBusyId(jobId);
    setActionErr(null);
    setReasonErr(null);
    setOk(null);
    try {
      const message = await decideJob(jobId, approved, approved ? undefined : reason.trim());
      setOk(message);
      setRejectId(null);
      setReason("");
      setViewId(null);
      await load();
    } catch (e: unknown) {
      setActionErr(apiErrorMessage(e, "Chưa cập nhật được tin. Vui lòng thử lại."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Duyệt tin" lead="Tin đang chờ. Duyệt để công khai, hoặc từ chối kèm lý do gửi nhà tuyển dụng.">
      {actionErr && <Alert tone="error">{actionErr}</Alert>}
      {ok && <Alert tone="success">{ok}</Alert>}

      {loadErr && (
        <Alert
          tone="error"
          action={<Button variant="secondary" loading={loading} onClick={() => void load()}>{loading ? "Đang thử lại…" : "Thử lại"}</Button>}
        >
          {loadErr}
        </Alert>
      )}

      {loading && !data && !loadErr && <SkeletonRows rows={4} label="Đang tải tin chờ duyệt" />}

      {data && data.items.length === 0 && (
        <EmptyState title="Không còn tin chờ duyệt">
          <p>Khi nhà tuyển dụng đăng tin mới, danh sách sẽ hiện ở đây.</p>
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="jp-count" aria-live="polite">{data.total.toLocaleString("vi-VN")} tin chờ duyệt</p>
          <div className="jp-queue">
            <div className="jp-queue-head" aria-hidden="true">
              <span>Vị trí · Công ty</span>
              <span>Danh mục</span>
              <span>Đăng</span>
              <span className="jp-queue-head-actions">Thao tác</span>
            </div>
            <ol className="jp-queue-rows" aria-label="Tin chờ duyệt">
              {data.items.map((job) => {
                const reading = viewId === job.id;
                const rejecting = rejectId === job.id;
                const busy = busyId === job.id;
                return (
                  <li key={job.id} className="jp-queue-item">
                    <div className="jp-queue-row">
                      <div className="jp-row-main">
                        <h3 className="jp-row-title">{job.title}</h3>
                        <p className="jp-row-company" title={job.company.name}>{job.company.name || MISSING}</p>
                        {job.recruiterName && <p className="jp-queue-by">Người đăng: {job.recruiterName}</p>}
                      </div>
                      <span className="jp-cell">
                        <span className="jp-sr">Danh mục: </span>
                        {categoryLabel(job.category.name)}
                      </span>
                      <span className="jp-cell jp-cell--date">
                        <span className="jp-sr">Đăng: </span>
                        {timeAgo(job.createdAt) || MISSING}
                      </span>
                      <div className="jp-queue-actions">
                        <Button variant="secondary" aria-expanded={reading} onClick={() => void toggleDetail(job.id)}>
                          {reading ? "Ẩn nội dung" : "Xem nội dung"}
                        </Button>
                        <Button loading={busy && !rejecting} disabled={busy} aria-label={`Duyệt tin ${job.title}`} onClick={() => void decide(job.id, true)}>
                          Duyệt
                        </Button>
                        <Button
                          variant="danger"
                          aria-expanded={rejecting}
                          aria-label={`Từ chối tin ${job.title}`}
                          disabled={busy}
                          onClick={() => { setRejectId(rejecting ? null : job.id); setReason(""); setReasonErr(null); }}
                        >
                          Từ chối
                        </Button>
                      </div>
                    </div>

                    {reading && (
                      <div className="jp-queue-detail">
                        {!detail && !detailErr && <p className="jp-muted" role="status">Đang tải nội dung…</p>}
                        {detailErr && <Alert tone="error">{detailErr}</Alert>}
                        {detail && (
                          <>
                            <FactStrip job={detail} />
                            <JobText title="Mô tả công việc" text={detail.description} />
                            <JobText title="Yêu cầu" text={detail.requirements} />
                            <JobText title="Quyền lợi" text={detail.benefits} />
                          </>
                        )}
                      </div>
                    )}

                    {rejecting && (
                      <form
                        className="jp-queue-reject"
                        noValidate
                        onSubmit={(e) => { e.preventDefault(); void decide(job.id, false); }}
                      >
                        <Field id={`reason-${job.id}`} label="Lý do từ chối" required hint="Nhà tuyển dụng sẽ nhận được nội dung này." error={reasonErr}>
                          <Textarea rows={3} maxLength={500} value={reason} placeholder="Ví dụ: thiếu mô tả công việc" onChange={(e) => setReason(e.target.value)} />
                        </Field>
                        <div className="jp-form-actions">
                          <Button variant="secondary" onClick={() => setRejectId(null)} disabled={busy}>Hủy</Button>
                          <Button type="submit" variant="danger" loading={busy}>{busy ? "Đang gửi…" : "Xác nhận từ chối"}</Button>
                        </div>
                      </form>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <Pagination page={page} totalPages={data.totalPages} onPage={goToPage} />
        </>
      )}
    </AdminShell>
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
