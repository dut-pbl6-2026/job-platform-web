import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { showToast } from "../lib/toastBus";
import { isUser } from "../lib/roles";
import { PageLoading } from "./ui";

/**
 * Sends the visitor to `to` and shows why. The toast is fired from an effect, not during render, and a
 * ref keeps StrictMode's second effect run from showing it twice.
 */
export function NoticeRedirect({ to, title, dedupeKey }: { to: string; title: string; dedupeKey: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    showToast({ title, dedupeKey, kind: "info" });
  }, [title, dedupeKey]);
  return <Navigate to={to} replace />;
}

/**
 * `applicantOnly` routes (apply, applications, resume score) are for Users. Recruiters and Admins
 * are bounced to the job board, as on mobile (app_router.dart: applicant-only routes).
 */
export function ProtectedRoute({
  children,
  applicantOnly = false,
}: {
  children: React.ReactNode;
  applicantOnly?: boolean;
}) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading label="Đang kiểm tra phiên đăng nhập" />;
  // Remember where the user was heading so login can send them back there.
  if (!isAuthenticated)
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (applicantOnly && !isUser(user?.role)) {
    return <NoticeRedirect to="/jobs" title="Trang này chỉ dành cho ứng viên." dedupeKey="applicant-only" />;
  }
  return <>{children}</>;
}
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { target } = useAuthRedirect();
  if (loading) return <PageLoading label="Đang kiểm tra phiên đăng nhập" />;
  if (isAuthenticated) return <Navigate to={target} replace />;
  return <>{children}</>;
}
