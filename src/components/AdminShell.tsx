import { Link, Navigate, useLocation } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin } from "../lib/roles";

const LINKS = [
  { to: "/admin", label: "Tổng quan" },
  { to: "/admin/jobs", label: "Duyệt tin" },
  { to: "/admin/users", label: "Người dùng" },
];

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}><div className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin(user?.role)) {
    return (
      <>
        <AppHeader />
        <div className="container">
          <div className="alert alert-error">Chỉ quản trị viên mới vào được khu vực này.</div>
          <Link className="btn btn-ghost" to="/jobs">← Việc làm</Link>
        </div>
      </>
    );
  }
  return <>{children}</>;
}

export function AdminShell({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <>
      <AppHeader />
      <div className="container admin-layout">
        <aside className="admin-nav" aria-label="Điều hướng quản trị">
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to} className={pathname === link.to ? "active" : ""}>{link.label}</Link>
          ))}
        </aside>
        <section className="admin-main">
          <h1 className="page-h1">{title}</h1>
          {lead && <p className="hint page-lead">{lead}</p>}
          {children}
        </section>
      </div>
    </>
  );
}
