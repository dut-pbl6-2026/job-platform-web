import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { Pagination } from "../components/Pagination";
import { decideJob, fetchAdminJob, fetchPendingJobs } from "../lib/adminApi";
import { formatSalary, timeAgo } from "../lib/jobsApi";
import { apiErrorMessage } from "../lib/http";
import type { Paginated, PendingJob } from "../types/admin";

const PAGE_SIZE = 6;

export default function AdminJobsPage() {
  const [sp, setSp] = useSearchParams();
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const [data, setData] = useState<Paginated<PendingJob> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
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
      else setDetailErr("Tin không còn tồn tại");
    } catch (e: unknown) {
      if (req === detailReq.current) setDetailErr(apiErrorMessage(e, "Không tải được nội dung tin"));
    }
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      setData(await fetchPendingJobs({ page, size: PAGE_SIZE }));
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, "Không tải được tin chờ duyệt"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function decide(jobId: string, approved: boolean) {
    // job-svc rejects without a reason (422); stop here instead of sending the request.
    if (!approved && !reason.trim()) {
      setErr("Hãy nhập lý do từ chối");
      return;
    }
    setBusyId(jobId);
    setErr(null);
    try {
      const message = await decideJob(jobId, approved, approved ? undefined : reason.trim());
      setOk(message);
      setRejectId(null);
      setReason("");
      setViewId(null);
      await load();
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, "Không cập nhật được tin"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Duyệt tin" lead="Tin đang chờ. Duyệt để công khai, hoặc từ chối kèm lý do gửi nhà tuyển dụng.">
      {err && <div className="alert alert-error">{err}</div>}
      {ok && <div className="alert alert-success">{ok}</div>}
      {loading && <div className="skeleton-detail" />}
      {!loading && data && data.items.length === 0 && (
        <div className="empty">
          <h3>Không còn tin chờ duyệt</h3>
          <p className="hint">Khi nhà tuyển dụng đăng tin mới, danh sách sẽ hiện ở đây.</p>
        </div>
      )}
      {!loading && data && data.items.length > 0 && (
        <div className="app-list">
          {data.items.map((job) => (
            <article key={job.id} className="card admin-job">
              <div className="app-detail-head">
                <div>
                  <h2 className="section-h">{job.title}</h2>
                  {/* The admin list returns title/company/category/createdAt only: skip empty parts. */}
                  <p className="hint">{[job.company.name, job.location, job.salaryMin || job.salaryMax ? formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency) : ""].filter(Boolean).join(" • ")}</p>
                  <p className="hint">{[job.recruiterName ? `Người đăng: ${job.recruiterName}` : "", timeAgo(job.createdAt), job.category.name].filter(Boolean).join(" • ")}</p>
                </div>
                <span className="status-badge status-badge--pending">Chờ duyệt</span>
              </div>
              {job.description && <p className="job-desc">{job.description.slice(0, 220)}{job.description.length > 220 ? "…" : ""}</p>}
              <div className="dash-actions">
                <button className="btn btn-ghost btn-sm" type="button" aria-expanded={viewId === job.id} onClick={() => toggleDetail(job.id)}>
                  {viewId === job.id ? "Ẩn nội dung" : "Xem nội dung"}
                </button>
                <button className="btn btn-primary btn-sm" type="button" disabled={busyId === job.id} onClick={() => decide(job.id, true)}>Duyệt</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setRejectId(job.id); setReason(""); }}>Từ chối</button>
              </div>
              {viewId === job.id && (
                <div className="detail-section">
                  {!detail && !detailErr && <div className="skeleton-detail" />}
                  {detailErr && <div className="alert alert-error">{detailErr}</div>}
                  {detail && (
                    <>
                      <p className="hint">{[
                        detail.location,
                        detail.salaryMin || detail.salaryMax ? formatSalary(detail.salaryMin, detail.salaryMax, detail.salaryCurrency) : "Lương thỏa thuận",
                        detail.employmentType,
                        detail.experienceLevel,
                      ].filter(Boolean).join(" • ")}</p>
                      <h3>Mô tả công việc</h3>
                      <p className="detail-prewrap">{detail.description?.trim() ? detail.description : "Chưa cập nhật"}</p>
                      <h3>Yêu cầu</h3>
                      <p className="detail-prewrap">{detail.requirements?.trim() ? detail.requirements : "Chưa cập nhật"}</p>
                      <h3>Quyền lợi</h3>
                      <p className="detail-prewrap">{detail.benefits?.trim() ? detail.benefits : "Chưa cập nhật"}</p>
                    </>
                  )}
                </div>
              )}
              {rejectId === job.id && (
                <form className="mini-form" onSubmit={(e) => { e.preventDefault(); decide(job.id, false); }}>
                  <label className="label" htmlFor={`reason-${job.id}`}>Lý do (bắt buộc, gửi cho nhà tuyển dụng)</label>
                  <textarea id={`reason-${job.id}`} className="textarea" rows={3} maxLength={500} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: thiếu mô tả công việc" />
                  <div className="dash-actions">
                    <button className="btn btn-primary btn-sm" disabled={busyId === job.id || !reason.trim()}>{busyId === job.id ? "Đang gửi..." : "Xác nhận từ chối"}</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRejectId(null)}>Hủy</button>
                  </div>
                </form>
              )}
            </article>
          ))}
          <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => {
            const next = new URLSearchParams(sp);
            if (p) next.set("page", String(p)); else next.delete("page");
            setSp(next);
          }} />
        </div>
      )}
    </AdminShell>
  );
}
