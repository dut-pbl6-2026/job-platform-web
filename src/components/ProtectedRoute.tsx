import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { PageLoading } from "./ui";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading label="Đang kiểm tra phiên đăng nhập" />;
  // Remember where the user was heading so login can send them back there.
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <>{children}</>;
}
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { target } = useAuthRedirect();
  if (loading) return <PageLoading label="Đang kiểm tra phiên đăng nhập" />;
  if (isAuthenticated) return <Navigate to={target} replace />;
  return <>{children}</>;
}
