import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AccountMenu } from "../components/ui/AccountMenu";
import { Icon } from "../components/ui/Icon";
import { cx } from "../components/ui/controls";
import { isAdmin } from "../lib/roles";

type NavItem = {
  to: string;
  labelKey:
    | "recruiter.nav.overview"
    | "recruiter.nav.jobs"
    | "recruiter.nav.post"
    | "recruiter.nav.company"
    | "admin.nav.overview"
    | "admin.nav.jobs"
    | "admin.nav.users";
  match: (path: string) => boolean;
};

const RECRUITER_NAV: NavItem[] = [
  { to: "/recruiter", labelKey: "recruiter.nav.overview", match: (p) => p === "/recruiter" },
  {
    to: "/recruiter/jobs",
    labelKey: "recruiter.nav.jobs",
    match: (p) => p === "/recruiter/jobs" || (p.startsWith("/recruiter/jobs/") && p !== "/recruiter/jobs/new"),
  },
  { to: "/recruiter/jobs/new", labelKey: "recruiter.nav.post", match: (p) => p === "/recruiter/jobs/new" },
  { to: "/recruiter/company", labelKey: "recruiter.nav.company", match: (p) => p === "/recruiter/company" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", labelKey: "admin.nav.overview", match: (p) => p === "/admin" },
  { to: "/admin/jobs", labelKey: "admin.nav.jobs", match: (p) => p === "/admin/jobs" },
  { to: "/admin/users", labelKey: "admin.nav.users", match: (p) => p === "/admin/users" },
];

/**
 * The console shell for recruiters and admins: persistent left sidebar on a white surface with navy
 * ink, a slim top bar (brand, home, account), and no marketing footer. Below 768px the sidebar folds
 * into a Menu disclosure in the top bar, using the same pattern as the public shell.
 */
export function WorkspaceLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const admin = isAdmin(user?.role);
  const items = admin ? ADMIN_NAV : RECRUITER_NAV;

  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setOpen(false);
  }

  return (
    <div className={cx("jp-workspace", open && "is-open")}>
      <header className="jp-workspace-bar">
        <Link to="/" className="jp-workspace-mark">
          <b aria-hidden="true">jp</b>
          <span aria-hidden="true">jobplatform</span>
        </Link>
        <div className="jp-workspace-account">
          <AccountMenu />
        </div>
        <button
          type="button"
          className="jp-workspace-menu"
          aria-expanded={open}
          aria-controls="jp-workspace-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? "x" : "menu"} size={22} />
          <span>{t("nav.menu")}</span>
        </button>
      </header>

      <aside className="jp-workspace-side">
        <p className="jp-workspace-role">{admin ? t("workspace.adminRole") : t("workspace.recruiterRole")}</p>
        <nav id="jp-workspace-nav" className="jp-workspace-nav" aria-label={t("workspace.navLabel")}>
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cx("jp-workspace-link", active && "is-active")}
                aria-current={active ? "page" : undefined}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <Link to="/" className="jp-workspace-home">
          <Icon name="arrowLeft" size={16} />
          {t("workspace.home")}
        </Link>
      </aside>

      <div className="jp-workspace-main">
        <Outlet />
      </div>
    </div>
  );
}
