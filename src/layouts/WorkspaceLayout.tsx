import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { AccountMenu } from "../components/ui/AccountMenu";
import { Icon, type IconName } from "../components/ui/Icon";
import { cx } from "../components/ui/controls";
import { fetchMyCompany } from "../lib/companyApi";
import { isAdmin, isRecruiter } from "../lib/roles";

type NavLabelKey =
  | "recruiter.nav.overview"
  | "recruiter.nav.jobs"
  | "recruiter.nav.post"
  | "recruiter.nav.company"
  | "admin.nav.overview"
  | "admin.nav.jobs"
  | "admin.nav.users"
  | "invite.navLabel"
  | "joinRequest.admin.navLabel";

type NavItem = {
  to: string;
  labelKey: NavLabelKey;
  icon: IconName;
  match: (path: string) => boolean;
};

const RECRUITER_NAV: NavItem[] = [
  { to: "/recruiter", labelKey: "recruiter.nav.overview", icon: "dashboard", match: (p) => p === "/recruiter" },
  {
    to: "/recruiter/jobs",
    labelKey: "recruiter.nav.jobs",
    icon: "briefcase",
    match: (p) => p === "/recruiter/jobs" || (p.startsWith("/recruiter/jobs/") && p !== "/recruiter/jobs/new"),
  },
  { to: "/recruiter/jobs/new", labelKey: "recruiter.nav.post", icon: "plus", match: (p) => p === "/recruiter/jobs/new" },
  {
    to: "/recruiter/company",
    labelKey: "recruiter.nav.company",
    icon: "building",
    match: (p) => p === "/recruiter/company",
  },
];

/** Company-admin only: the creator can hand out invite codes and decide join requests. */
const COMPANY_ADMIN_NAV: NavItem[] = [
  {
    to: "/recruiter/invite-codes",
    labelKey: "invite.navLabel",
    icon: "mail",
    match: (p) => p === "/recruiter/invite-codes",
  },
  {
    to: "/recruiter/join-requests",
    labelKey: "joinRequest.admin.navLabel",
    icon: "inbox",
    match: (p) => p === "/recruiter/join-requests",
  },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", labelKey: "admin.nav.overview", icon: "dashboard", match: (p) => p === "/admin" },
  { to: "/admin/jobs", labelKey: "admin.nav.jobs", icon: "briefcase", match: (p) => p === "/admin/jobs" },
  { to: "/admin/users", labelKey: "admin.nav.users", icon: "users", match: (p) => p === "/admin/users" },
];

/**
 * The console shell for recruiters and admins: persistent left sidebar on a white surface with navy
 * ink, a slim top bar (brand, account), and no marketing footer. Below 768px the sidebar folds into a
 * Menu disclosure in the top bar, using the same pattern as the public shell.
 */
export function WorkspaceLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const mainRef = useRef<HTMLDivElement>(null);
  const admin = isAdmin(user?.role);
  const recruiter = isRecruiter(user?.role);
  const items = admin ? ADMIN_NAV : RECRUITER_NAV;

  // Company-admin links are for the creator only; job-svc enforces the same rule.
  const company = useQuery({
    queryKey: ["company", "mine", user?.id],
    queryFn: () => fetchMyCompany(user?.companyId),
    enabled: recruiter,
    staleTime: 5 * 60_000,
  });
  const companyNav = recruiter && company.data?.isCompanyAdmin ? COMPANY_ADMIN_NAV : [];

  // Only the content pane scrolls, so the shell must reset it on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setOpen(false);
  }

  function navLink(item: NavItem) {
    const active = item.match(pathname);
    return (
      <Link
        key={item.to}
        to={item.to}
        className={cx("jp-workspace-link", active && "is-active")}
        aria-current={active ? "page" : undefined}
      >
        <Icon name={item.icon} size={18} className="jp-workspace-icon" />
        <span>{t(item.labelKey)}</span>
      </Link>
    );
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
          {items.map(navLink)}
          {companyNav.length > 0 && (
            <>
              <p className="jp-workspace-section">{t("workspace.companyAdmin")}</p>
              {companyNav.map(navLink)}
            </>
          )}
        </nav>
        <Link to="/" className="jp-workspace-home">
          <Icon name="arrowLeft" size={16} />
          {t("workspace.home")}
        </Link>
      </aside>

      <div className="jp-workspace-main" ref={mainRef}>
        <Outlet />
      </div>
    </div>
  );
}
