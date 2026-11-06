import type { ReactNode } from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { ButtonLink, EmptyState, PageHead, PageLoading, TopBar } from "./ui";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../lib/roles";

const LINKS = [
  { to: "/admin", label: "Tổng quan", end: true },
  { to: "/admin/jobs", label: "Duyệt tin", end: false },
  { to: "/admin/users", label: "Người dùng", end: false },
];

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading label="Đang kiểm tra quyền truy cập" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (!isAdmin(user?.role)) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <EmptyState
            title="Chỉ quản trị viên mới vào được khu vực này."
            action={<ButtonLink to="/jobs">Xem bảng việc làm</ButtonLink>}
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
export function AdminShell({ title, lead, actions, children }: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <TopBar />
      <nav className="jp-subnav" aria-label="Điều hướng quản trị">
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
