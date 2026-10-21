import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { ActivityLineChart, CategoryBarChart, StatusDoughnutChart } from "../components/StatsCharts";
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
              <h2 className="section-h">Xu hướng hoạt động</h2>
              <ActivityLineChart stats={stats} />
            </div>
            <div className="admin-side-charts">
              <div className="card">
                <h2 className="section-h">Tin theo danh mục</h2>
                <CategoryBarChart stats={stats} />
              </div>
              <div className="card">
                <h2 className="section-h">Trạng thái đơn</h2>
                <StatusDoughnutChart stats={stats} />
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
