import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/jobs" style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 13 }}>JP</div>
          <strong>Job Platform</strong>
        </Link>
        <nav className="nav-links">
          <Link to="/jobs">Việc làm</Link>
          {isAuthenticated && <Link to="/dashboard">Dashboard</Link>}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isAuthenticated ? (
          <>
            <Link className="btn btn-ghost" to="/login" style={{ height: 36, padding: "0 14px" }}>Đăng nhập</Link>
            <Link className="btn btn-primary" to="/register" style={{ height: 36, padding: "0 14px" }}>Đăng ký</Link>
          </>
        ) : (
          <>
            <span className="hint" style={{ fontWeight: 600 }}>{user?.fullName}</span>
            <span className="badge">{user?.role}</span>
            <button className="btn btn-ghost" style={{ height: 36, padding: "0 14px" }} onClick={async () => { await logout(); nav("/login"); }}>Đăng xuất</button>
          </>
        )}
      </div>
    </header>
  );
}
