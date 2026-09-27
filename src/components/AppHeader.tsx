import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isRecruiter, isUser } from "../lib/roles";

export function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="topbar topbar-topcv">
      <div className="topbar-left">
        <Link to="/jobs" className="topbar-brand" aria-label="Job Platform trang chủ">
          <span className="topbar-wordmark">jobplatform</span>
        </Link>
        <nav className="nav-links">
          <Link to="/jobs">Việc làm</Link>
          <Link to={isAuthenticated ? "/profile" : "/register"}>Tạo CV</Link>
          {isAuthenticated && isUser(user?.role) && <Link to="/applications">Đơn của tôi</Link>}
          {isAuthenticated && <Link to="/dashboard">Công cụ</Link>}
        </nav>
      </div>
      <div className="topbar-right">
        {!isAuthenticated ? (
          <>
            <Link className="btn-topcv-outline" to="/register">Đăng ký</Link>
            <Link className="btn-topcv-fill" to="/login">Đăng nhập</Link>
            <Link className="btn-topcv-muted" to="/register">Đăng tuyển & tìm hồ sơ</Link>
          </>
        ) : (
          <>
            <span className="hint user-name">{user?.fullName}</span>
            {isRecruiter(user?.role) && <Link className="btn-topcv-muted" to="/jobs">Đăng tuyển & tìm hồ sơ</Link>}
            <button className="btn-topcv-outline" type="button" onClick={async () => { await logout(); nav("/login"); }}>Đăng xuất</button>
          </>
        )}
      </div>
    </header>
  );
}
