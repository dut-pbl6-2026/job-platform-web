import type { ReactNode } from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isRecruiter } from "../lib/roles";
import { NoticeRedirect } from "./ProtectedRoute";
import { PageHead, PageLoading, TopBar } from "./ui";

const LINKS = [
  { to: "/recruiter", label: "Tổng quan", end: true },
  { to: "/recruiter/jobs", label: "Tin tuyển dụng", end: false },
];

/**
 * Recruiter-only area. Only the Recruiter role gets in: Admin is refused too, as on mobile
 * (recruiter-only routes). Anyone else is sent to the job board with a notice.
 */
export function RecruiterRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading label="Đang kiểm tra quyền truy cập" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (!isRecruiter(user?.role)) {
    return <NoticeRedirect to="/jobs" title="Khu vực này chỉ dành cho nhà tuyển dụng." dedupeKey="recruiter-only" />;
  }
  return <>{children}</>;
}

/** The recruiter frame: the shared shell bar, a second bar with the recruiter sections, then the page. */
export function RecruiterShell({ title, lead, actions, children }: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <TopBar />
      <nav className="jp-subnav" aria-label="Điều hướng nhà tuyển dụng">
        <div className="jp-subnav-inner">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="jp-subnav-link">
              {link.label}
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
