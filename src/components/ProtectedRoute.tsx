import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useAuthRedirect } from "../hooks/useAuthRedirect";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}><div className="spinner" /></div>;
  // Remember where the user was heading so login can send them back there.
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <>{children}</>;
}
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { target } = useAuthRedirect();
  if (loading) return <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}><div className="spinner" /></div>;
  if (isAuthenticated) return <Navigate to={target} replace />;
  return <>{children}</>;
}
