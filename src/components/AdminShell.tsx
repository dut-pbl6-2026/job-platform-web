import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { ButtonLink, EmptyState, PageHead, PageLoading, TopBar } from "./ui";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../lib/roles";

const LINKS = [
  { to: "/admin", labelKey: "admin.nav.overview", end: true },
  { to: "/admin/jobs", labelKey: "admin.nav.jobs", end: false },
  { to: "/admin/users", labelKey: "admin.nav.users", end: false },
] as const;

export function AdminRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading label={t("admin.checkingAccess")} />;
  if (!isAuthenticated)
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (!isAdmin(user?.role)) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <EmptyState
            title={t("admin.accessNotice")}
            action={<ButtonLink to="/jobs">{t("jobs.detail.viewBoard")}</ButtonLink>}
          />
        </main>
      </>
    );
  }
  return <>{children}</>;
}

/**
 * The admin frame: the shared shell bar, then a second bar with the three admin sections (the amber
 * underline is "where you are"), then the page. Admin is the same world as the job board, not another app.
 */
export function AdminShell({
  title,
  lead,
  actions,
  children,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TopBar />
      <nav className="jp-subnav" aria-label={t("admin.nav.label")}>
        <div className="jp-subnav-inner">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="jp-subnav-link">
              {t(link.labelKey)}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="jp-page">
        <PageHead title={title} lead={lead} actions={actions} />
        {children}
      </main>
    </>
  );
}
