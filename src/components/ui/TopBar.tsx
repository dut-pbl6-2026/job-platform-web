import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isAdmin, isRecruiter, isUser } from "../../lib/roles";
import { Icon } from "./Icon";
import { DevTag, cx } from "./controls";

type Item = { to: string; label: string; match: (path: string) => boolean; dev?: boolean };

/**
 * The navy shell bar shared by every screen. The active item carries the amber band (amber means
 * "where you are"). Below 768px the nav and account actions fold into a disclosure menu.
 * Recruiters get a "Tuyển dụng" item for the recruiter area. Create-CV is applicant-only, so it is
 * shown to guests and Users only, as on mobile.
 */
export function TopBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // A route change closes the mobile menu. Adjusting state during render avoids an effect.
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setOpen(false);
  }

  const items: Item[] = [{ to: "/jobs", label: "Việc làm", match: (p) => p === "/jobs" || p.startsWith("/jobs/") }];
  if (!isAuthenticated || isUser(user?.role)) {
    items.push({ to: isAuthenticated ? "/profile" : "/register", label: "Tạo CV", match: (p) => p === "/profile" });
  }
  if (isAuthenticated && isRecruiter(user?.role)) {
    items.push({
      to: "/recruiter",
      label: "Tuyển dụng",
      match: (p) => p === "/recruiter" || p.startsWith("/recruiter/"),
    });
  }
  if (isAuthenticated && isUser(user?.role)) {
    items.push({ to: "/applications", label: "Đơn của tôi", match: (p) => p.startsWith("/applications") });
  }
  if (isAuthenticated) {
    items.push({ to: "/chat", label: "Trợ lý AI", match: (p) => p === "/chat", dev: true });
  }
  if (isAuthenticated && isAdmin(user?.role)) {
    items.push({ to: "/admin", label: "Quản trị", match: (p) => p.startsWith("/admin") });
  }

  async function signOut() {
    await logout();
    nav("/login");
  }

  return (
    <header className={cx("jp-shell on-navy", open && "is-open")}>
      <div className="jp-shell-bar">
        <Link to="/jobs" className="jp-mark" aria-label="jobplatform, về bảng việc làm">
          <b aria-hidden="true">jp</b>
          <span aria-hidden="true">jobplatform</span>
        </Link>

        <nav id="jp-nav" className="jp-nav" aria-label="Điều hướng chính">
          {items.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={() => cx("jp-nav-link", item.match(pathname) && "is-active")}
              aria-current={item.match(pathname) ? "page" : undefined}
            >
              {item.label}
              {item.dev && <DevTag />}
            </NavLink>
          ))}
        </nav>

        <div className="jp-shell-actions">
          {!isAuthenticated ? (
            <>
              <Link className="jp-shell-btn jp-shell-btn--line" to="/register">
                Đăng ký
              </Link>
              <Link className="jp-shell-btn jp-shell-btn--fill" to="/login">
                Đăng nhập
              </Link>
            </>
          ) : (
            <>
              <span className="jp-shell-user" title={user?.email}>
                {user?.fullName}
              </span>
              <button type="button" className="jp-shell-btn jp-shell-btn--line" onClick={signOut}>
                Đăng xuất
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="jp-shell-menu"
          aria-expanded={open}
          aria-controls="jp-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? "x" : "menu"} size={22} />
          <span>Menu</span>
        </button>
      </div>
    </header>
  );
}
