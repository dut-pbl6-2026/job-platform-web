import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { Pagination } from "../components/Pagination";
import { decideJob, fetchPendingJobs } from "../lib/adminApi";
import { formatSalary, timeAgo } from "../lib/jobsApi";
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

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      setData(await fetchPendingJobs({ page, size: PAGE_SIZE }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (e as { message?: string })?.message
        || "Không tải được tin chờ duyệt";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function decide(jobId: string, approved: boolean) {
    setBusyId(jobId);
    setErr(null);
    try {
      const message = await decideJob(jobId, approved, approved ? undefined : reason.trim());
      setOk(message);
      setRejectId(null);
      setReason("");
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Không cập nhật được tin";
      setErr(msg);
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
                  <p className="hint">{job.company.name} • {job.location} • {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</p>
                  <p className="hint">{job.recruiterName ? `Người đăng: ${job.recruiterName} • ` : ""}{timeAgo(job.createdAt)} • {job.category.name}</p>
                </div>
                <span className="status-badge status-badge--pending">Chờ duyệt</span>
              </div>
              <p className="job-desc">{job.description.slice(0, 220)}{job.description.length > 220 ? "…" : ""}</p>
              <div className="dash-actions">
                <Link className="btn btn-ghost btn-sm" to={`/jobs/${job.id}`}>Xem tin</Link>
                <button className="btn btn-primary btn-sm" type="button" disabled={busyId === job.id} onClick={() => decide(job.id, true)}>Duyệt</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setRejectId(job.id); setReason(""); }}>Từ chối</button>
              </div>
              {rejectId === job.id && (
                <form className="mini-form" onSubmit={(e) => { e.preventDefault(); decide(job.id, false); }}>
                  <label className="label" htmlFor={`reason-${job.id}`}>Lý do (không bắt buộc)</label>
                  <textarea id={`reason-${job.id}`} className="textarea" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: thiếu mô tả công việc" />
                  <div className="dash-actions">
                    <button className="btn btn-primary btn-sm" disabled={busyId === job.id}>{busyId === job.id ? "Đang gửi..." : "Xác nhận từ chối"}</button>
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
