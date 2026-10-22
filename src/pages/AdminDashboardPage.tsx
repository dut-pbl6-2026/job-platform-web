import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { fetchAdminHealth, fetchAdminStatistics } from "../lib/adminApi";
import type { AdminHealth, AdminPeriod, AdminStatistics } from "../types/admin";

const PERIODS: { id: AdminPeriod; label: string }[] = [
  { id: "daily", label: "Ngày" },
  { id: "weekly", label: "Tuần" },
  { id: "monthly", label: "Tháng" },
];

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<AdminPeriod>("weekly");
  const [stats, setStats] = useState<AdminStatistics | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    Promise.all([fetchAdminStatistics(period), fetchAdminHealth()])
      .then(([s, h]) => { if (!alive) return; setStats(s); setHealth(h); })
      .catch((e) => { if (alive) setErr(e?.response?.data?.message || e?.message || "Không tải được thống kê"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period]);

  const maxBar = Math.max(1, ...(stats?.series.map((p) => Math.max(p.users, p.jobs, p.applications)) ?? [1]));

  return (
    <AdminShell title="Bảng quản trị" lead="Thống kê nền tảng và hàng chờ duyệt tin.">
      <div className="status-pills" role="tablist">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" className={`status-pill ${period === p.id ? "active" : ""}`} onClick={() => setPeriod(p.id)}>{p.label}</button>
        ))}
      </div>
      {err && <div className="alert alert-error">{err}</div>}
      {loading && <div className="skeleton-detail" />}
      {stats && (
        <>
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
              <h2 className="section-h">Hoạt động</h2>
              <ul className="admin-bars">
                {stats.series.map((point) => (
                  <li key={point.label}>
                    <span>{point.label}</span>
                    <div className="admin-bar-track" title={`${point.users} user · ${point.jobs} tin · ${point.applications} đơn`}>
                      <i style={{ width: `${(point.applications / maxBar) * 100}%` }} />
                    </div>
                    <strong>{point.applications}</strong>
                  </li>
                ))}
              </ul>
              <p className="hint">Cột là số đơn ứng tuyển trong kỳ.</p>
            </div>
            <div className="card">
              <h2 className="section-h">Tin theo danh mục (chờ duyệt)</h2>
              {stats.categories.length === 0 && <p className="hint">Không có tin chờ duyệt.</p>}
              <ul className="stack-list">
                {stats.categories.map((c) => (
                  <li key={c.name} className="stack-item"><span>{c.name}</span><strong>{c.count}</strong></li>
                ))}
              </ul>
              <h2 className="section-h" style={{ marginTop: 16 }}>Trạng thái đơn</h2>
              <div className="kv-grid">
                <div><span className="hint">Chờ</span><strong>{stats.applicationStatus.pending}</strong></div>
                <div><span className="hint">Đã xem</span><strong>{stats.applicationStatus.reviewed}</strong></div>
                <div><span className="hint">Nhận</span><strong>{stats.applicationStatus.accepted}</strong></div>
                <div><span className="hint">Từ chối</span><strong>{stats.applicationStatus.rejected}</strong></div>
              </div>
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

function Kpi({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <span className="hint">{label}</span>
      <strong>{value}</strong>
    </>
  );
  if (href) return <Link className="admin-kpi" to={href}>{body}</Link>;
  return <div className="admin-kpi">{body}</div>;
}
