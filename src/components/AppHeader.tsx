import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link to="/jobs" className="topbar-brand">
          <div className="topbar-logo">JP</div>
          <strong>Job Platform</strong>
        </Link>
        <nav className="nav-links">
          <Link to="/jobs">Việc làm</Link>
          {isAuthenticated && <Link to="/dashboard">Dashboard</Link>}
        </nav>
      </div>
      <div className="topbar-right">
        {!isAuthenticated ? (
          <>
            <Link className="btn btn-ghost btn-sm" to="/login">Đăng nhập</Link>
            <Link className="btn btn-primary btn-sm" to="/register">Đăng ký</Link>
          </>
        ) : (
          <>
            <span className="hint user-name">{user?.fullName}</span>
            <span className="badge">{user?.role}</span>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); nav("/login"); }}>Đăng xuất</button>
          </>
        )}
      </div>
    </header>
  );
}
