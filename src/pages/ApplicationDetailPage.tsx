import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { fetchApplicationById } from "../lib/applicationsApi";
import { timeAgo } from "../lib/jobsApi";
import type { Application } from "../types/application";
import { STATUS_LABEL } from "../types/application";

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    let alive = true;
    setLoading(true);
    fetchApplicationById(id, user.id)
      .then((a) => { if (!alive) return; if (!a) setErr("Không tìm thấy đơn"); else setApp(a); })
      .catch(() => { if (alive) setErr("Không tải được đơn"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, user]);

  return (
    <>
      <AppHeader />
      <div className="container apply-wrap">
        <Link to="/applications" className="hint detail-back">← Đơn của tôi</Link>
        {loading && <div className="skeleton-detail" />}
        {err && <div className="alert alert-error">{err}</div>}
        {app && (
          <div className="card">
            <div className="app-detail-head">
              <div>
                <h1 className="page-h1">{app.jobTitle || "Đơn ứng tuyển"}</h1>
                <p className="hint">{app.companyName} {app.location ? `• ${app.location}` : ""} • {timeAgo(app.createdAt)}</p>
              </div>
              <span className={`status-badge status-badge--${app.status}`}>{STATUS_LABEL[app.status]}</span>
            </div>
            {app.jobId && <Link className="btn btn-ghost btn-sm" to={`/jobs/${app.jobId}`}>Xem tin tuyển dụng</Link>}

            <div className="detail-section" style={{ marginTop: 16 }}>
              <h3>CV đã gửi</h3>
              {app.cvUrl ? (
                <a href={app.cvUrl} target="_blank" rel="noreferrer">{app.cvFileName || "Tải CV"}</a>
              ) : (
                <p className="hint">{app.cvFileName || "Đã gửi file CV"}</p>
              )}
            </div>
            <div className="detail-section">
              <h3>Thư xin việc</h3>
              <p className="detail-prewrap">{app.coverLetter?.trim() || "Không có"}</p>
            </div>
            {app.statusHistory && app.statusHistory.length > 0 && (
              <div className="detail-section">
                <h3>Lịch sử trạng thái</h3>
                <ol className="timeline">
                  {[...app.statusHistory].sort((a, b) => +new Date(a.changedAt) - +new Date(b.changedAt)).map((h) => (
                    <li key={h.id}>
                      <strong>{STATUS_LABEL[h.status]}</strong>
                      <span className="hint"> · {new Date(h.changedAt).toLocaleString("vi-VN")}</span>
                      {h.note && <div className="hint">{h.note}</div>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
