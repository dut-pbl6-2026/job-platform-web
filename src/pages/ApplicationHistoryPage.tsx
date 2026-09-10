import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Pagination } from "../components/Pagination";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { fetchMyApplications } from "../lib/applicationsApi";
import { timeAgo } from "../lib/jobsApi";
import type { Application, ApplicationStatus, PaginatedApplications } from "../types/application";
import { APPLICATION_STATUSES, STATUS_LABEL } from "../types/application";

const PAGE_SIZE = 8;

export default function ApplicationHistoryPage() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const status = (sp.get("status") || "") as ApplicationStatus | "";
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const [data, setData] = useState<PaginatedApplications | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    fetchMyApplications({ status: status || undefined, page, size: PAGE_SIZE, userId: user.id })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setErr(e?.message || "Không tải được danh sách"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user, status, page]);

  if (!isUser(user?.role)) {
    return (
      <>
        <AppHeader />
        <div className="container apply-wrap">
          <div className="alert alert-error">Trang này dành cho người tìm việc.</div>
          <Link to="/jobs" className="btn btn-ghost">← Việc làm</Link>
        </div>
      </>
    );
  }

  function setFilter(s: string) {
    const next = new URLSearchParams(sp);
    if (s) next.set("status", s); else next.delete("status");
    next.delete("page");
    setSp(next);
  }

  return (
    <>
      <AppHeader />
      <div className="container apply-wrap">
        <h1 className="page-h1">Đơn của tôi</h1>
        <p className="hint page-lead">Theo dõi trạng thái từng lần ứng tuyển.</p>

        <div className="status-pills" role="tablist">
          <button type="button" className={`status-pill ${!status ? "active" : ""}`} onClick={() => setFilter("")}>Tất cả</button>
          {APPLICATION_STATUSES.map((s) => (
            <button key={s} type="button" className={`status-pill status-pill--${s} ${status === s ? "active" : ""}`} onClick={() => setFilter(s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {err && <div className="alert alert-error">{err}</div>}
        {loading && <div className="skeleton-detail" />}
        {!loading && data && data.items.length === 0 && (
          <div className="empty">
            <h3>Chưa có đơn nào</h3>
            <p className="hint">Ứng tuyển một tin để theo dõi tại đây.</p>
            <Link className="btn btn-primary" to="/jobs">Tìm việc</Link>
          </div>
        )}
        {!loading && data && data.items.length > 0 && (
          <div className="app-list">
            {data.items.map((a) => <ApplicationRow key={a.id} app={a} />)}
            <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => {
              const next = new URLSearchParams(sp);
              if (p) next.set("page", String(p)); else next.delete("page");
              setSp(next);
            }} />
          </div>
        )}
      </div>
    </>
  );
}

function ApplicationRow({ app }: { app: Application }) {
  return (
    <Link to={`/applications/${app.id}`} className="app-row">
      <div>
        <strong>{app.jobTitle || "Tin tuyển dụng"}</strong>
        <div className="hint">{app.companyName || "—"} {app.location ? `• ${app.location}` : ""} • {timeAgo(app.createdAt)}</div>
      </div>
      <span className={`status-badge status-badge--${app.status}`}>{STATUS_LABEL[app.status]}</span>
    </Link>
  );
}
