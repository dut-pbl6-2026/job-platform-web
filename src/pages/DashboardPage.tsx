import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  async function onLogout() {
    await logout();
    nav("/login");
  }
  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 13 }}>JP</div>
          <strong>Job Platform</strong>
          <span className="badge">Auth OK</span>
        </div>
        <button className="btn btn-ghost" style={{ height: 36, padding: "0 14px" }} onClick={onLogout}>Đăng xuất</button>
      </div>
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
        </div>
      </div>
    </>
  );
}
