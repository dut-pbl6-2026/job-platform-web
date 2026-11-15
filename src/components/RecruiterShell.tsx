import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isRecruiter } from "../lib/roles";
import { NoticeRedirect } from "./ProtectedRoute";
import { PageHead, PageLoading, TopBar } from "./ui";

const LINKS = [
  { to: "/recruiter", labelKey: "recruiter.nav.overview", end: true },
  { to: "/recruiter/jobs", labelKey: "recruiter.nav.jobs", end: true },
  { to: "/recruiter/jobs/new", labelKey: "recruiter.nav.post", end: true },
] as const;

/**
 * Recruiter-only area. Only the Recruiter role gets in: Admin is refused too, as on mobile
 * (recruiter-only routes). Anyone else is sent to the job board with a notice.
 */
export function RecruiterRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading label={t("recruiter.checkingAccess")} />;
  if (!isAuthenticated)
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (!isRecruiter(user?.role)) {
    return <NoticeRedirect to="/jobs" title={t("recruiter.accessNotice")} dedupeKey="recruiter-only" />;
  }
  return <>{children}</>;
}

/** The recruiter frame: the shared shell bar, a second bar with the recruiter sections, then the page. */
export function RecruiterShell({
  title,
  lead,
  actions,
  back,
  children,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  back?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TopBar />
      <nav className="jp-subnav" aria-label={t("recruiter.nav.label")}>
        <div className="jp-subnav-inner">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="jp-subnav-link">
              {t(link.labelKey)}
            </NavLink>
          ))}
          <NavLink to="/recruiter/invite-codes" end className="jp-subnav-link">
            {t("invite.navLabel")}
          </NavLink>
        </div>
      </nav>
      <main className="jp-page">
        <PageHead title={title} lead={lead} actions={actions} back={back} />
        {children}
      </main>
    </>
  );
}
