import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppHeader } from "../components/AppHeader";

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <>
      <AppHeader />
      <div className="dashboard">
        <div className="card">
          <h2 style={{ margin: "0 0 6px" }}>Xin chào, {user?.fullName} 👋</h2>
          <p style={{ color: "#64748b", margin: "0 0 16px" }}>Bạn đã đăng nhập thành công qua <code>job-platform-auth-svc</code> (Port 5001).</p>
          <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
            <div><strong>Email:</strong> {user?.email}</div>
            <div><strong>Role:</strong> {user?.role}</div>
            <div><strong>UserId:</strong> <code>{user?.id}</code></div>
            <div><strong>IsActive:</strong> {String(user?.isActive)}</div>
          </div>
          <div className="alert alert-success" style={{ marginTop: 16 }}>
            JWT Access 60p + Refresh 30d (SHA256, rotation) — Gateway sẽ forward <code>X-User-Id / X-User-Role</code>.
          </div>
          <div className="dash-actions">
            <Link className="btn btn-primary" to="/jobs">Tìm việc</Link>
            <Link className="btn btn-ghost" to="/profile">Hồ sơ</Link>
            <Link className="btn btn-ghost" to="/applications">Đơn của tôi</Link>
          </div>
        </div>
      </div>
    </>
  );
}
