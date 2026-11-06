import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { fetchAdminHealth, fetchAdminStatistics } from "../lib/adminApi";
import { apiErrorMessage } from "../lib/http";
import type { AdminHealth, AdminStatistics } from "../types/admin";

const SECTION_LABEL: Record<AdminStatistics["unavailable"][number], string> = {
  users: "người dùng",
  jobs: "tin đăng",
  applications: "đơn ứng tuyển",
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStatistics | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    Promise.all([fetchAdminStatistics(), fetchAdminHealth()])
      .then(([s, h]) => { if (!alive) return; setStats(s); setHealth(h); })
      .catch((e) => { if (alive) setErr(apiErrorMessage(e, "Không tải được thống kê")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <AdminShell title="Bảng quản trị" lead="Thống kê nền tảng và hàng chờ duyệt tin.">
      {err && <div className="alert alert-error">{err}</div>}
      {loading && <div className="skeleton-detail" />}
      {stats && (
        <>
          {stats.unavailable.length > 0 && (
            <div className="alert alert-error">
              Chưa lấy được số liệu {stats.unavailable.map((key) => SECTION_LABEL[key]).join(", ")}: dịch vụ không phản hồi.
            </div>
          )}
          <div className="admin-kpis">
            <Kpi label="Người dùng" value={stats.totalUsers} />
            <Kpi label="Nhà tuyển dụng" value={stats.totalRecruiters} />
            <Kpi label="Người tìm việc" value={stats.totalJobSeekers} />
            <Kpi label="Tin đăng" value={stats.totalJobs} />
            <Kpi label="Đơn ứng tuyển" value={stats.totalApplications} />
            <Kpi label="Chờ duyệt" value={stats.pendingJobs} href="/admin/jobs" />
          </div>
          <div className="admin-grid">
            <div className="card">
              <h2 className="section-h">Người dùng</h2>
              <div className="kv-grid">
                <div><span className="hint">Đang hoạt động</span><strong>{show(stats.activeUsers)}</strong></div>
                <div><span className="hint">Mới tháng này</span><strong>{show(stats.newUsersThisMonth)}</strong></div>
              </div>
              <h2 className="section-h" style={{ marginTop: 16 }}>Tin đăng</h2>
              <div className="kv-grid">
                <div><span className="hint">Đang hiển thị</span><strong>{show(stats.activeJobs)}</strong></div>
                <div><span className="hint">Chờ duyệt</span><strong>{show(stats.pendingJobs)}</strong></div>
              </div>
            </div>
            <div className="card">
              <h2 className="section-h">Trạng thái đơn</h2>
              {stats.applicationStatus ? (
                <div className="kv-grid">
                  <div><span className="hint">Chờ</span><strong>{stats.applicationStatus.pending}</strong></div>
                  <div><span className="hint">Nhận</span><strong>{stats.applicationStatus.accepted}</strong></div>
                  <div><span className="hint">Từ chối</span><strong>{stats.applicationStatus.rejected}</strong></div>
                </div>
              ) : (
                <p className="hint">Chưa có số liệu.</p>
              )}
            </div>
          </div>
        </>
      )}
      {health && (
        <div className="card">
          <h2 className="section-h">Sức khỏe dịch vụ</h2>
          <ul className="admin-health">
            {health.services.map((s) => (
              <li key={s.name}>
                <span className={`status-badge status-badge--${s.status === "online" ? "accepted" : "rejected"}`}>{s.status === "online" ? "Online" : "Offline"}</span>
                <strong>{s.name}</strong>
                <span className="hint">{s.latencyMs == null ? "—" : `${s.latencyMs} ms`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminShell>
  );
}

function show(value: number | null) {
  return value == null ? "—" : value;
}

function Kpi({ label, value, href }: { label: string; value: number | null; href?: string }) {
  const body = (
    <>
      <span className="hint">{label}</span>
      <strong>{show(value)}</strong>
    </>
  );
  if (href) return <Link className="admin-kpi" to={href}>{body}</Link>;
  return <div className="admin-kpi">{body}</div>;
}
