import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isAdmin, isRecruiter, isUser } from "../../lib/roles";
import { Icon } from "./Icon";
import { DevTag, cx } from "./controls";

type Item = { to: string; label: string; match: (path: string) => boolean; dev?: boolean };

/**
 * The navy shell bar shared by every screen. The active item carries the amber band (amber means
 * "where you are"). Below 768px the nav and account actions fold into a disclosure menu.
 * Recruiters get a "Recruit" item for the recruiter area. Create-CV is applicant-only, so it is
 * shown to guests and Users only, as on mobile.
 */
export function TopBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // A route change closes the mobile menu. Adjusting state during render avoids an effect.
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setOpen(false);
  }

  const items: Item[] = [{ to: "/jobs", label: t("nav.jobs"), match: (p) => p === "/jobs" || p.startsWith("/jobs/") }];
  if (!isAuthenticated || isUser(user?.role)) {
    items.push({
      to: isAuthenticated ? "/profile" : "/register",
      label: t("nav.createCv"),
      match: (p) => p === "/profile",
    });
  }
  if (isAuthenticated && isRecruiter(user?.role)) {
    items.push({
      to: "/recruiter",
      label: t("nav.recruit"),
      match: (p) => p === "/recruiter" || p.startsWith("/recruiter/"),
    });
  }
  if (isAuthenticated && isUser(user?.role)) {
    items.push({ to: "/applications", label: t("nav.myApplications"), match: (p) => p.startsWith("/applications") });
  }
  if (isAuthenticated) {
    items.push({ to: "/chat", label: t("nav.aiAssistant"), match: (p) => p === "/chat", dev: true });
  }
  if (isAuthenticated && isAdmin(user?.role)) {
    items.push({ to: "/admin", label: t("nav.admin"), match: (p) => p.startsWith("/admin") });
  }

  async function signOut() {
    await logout();
    nav("/login");
  }

  return (
    <header className={cx("jp-shell on-navy", open && "is-open")}>
      <div className="jp-shell-bar">
        <Link to="/jobs" className="jp-mark" aria-label={t("nav.homeLabel")}>
          <b aria-hidden="true">jp</b>
          <span aria-hidden="true">jobplatform</span>
        </Link>

        <nav id="jp-nav" className="jp-nav" aria-label={t("nav.mainLabel")}>
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
                {t("nav.register")}
              </Link>
              <Link className="jp-shell-btn jp-shell-btn--fill" to="/login">
                {t("nav.login")}
              </Link>
            </>
          ) : (
            <>
              <span className="jp-shell-user" title={user?.email}>
                {user?.fullName}
              </span>
              <button type="button" className="jp-shell-btn jp-shell-btn--line" onClick={signOut}>
                {t("nav.logout")}
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
          <span>{t("nav.menu")}</span>
        </button>
      </div>
    </header>
  );
}
