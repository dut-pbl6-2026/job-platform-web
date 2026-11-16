import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { AppFooter } from "../components/AppFooter";
import { ScrollToTop } from "../components/ScrollToTop";
import { PageLoading, TopBar } from "../components/ui";
import { WorkspaceLayout } from "./WorkspaceLayout";

/** Public marketing shell: navy top bar, page, footer. Auth screens use their own layout. */
export function PublicLayout() {
  return (
    <>
      <ScrollToTop />
      <TopBar />
      <Outlet />
      <AppFooter />
    </>
  );
}

/** Signed-in candidate shell: the compact top bar (avatar menu) and no marketing footer. */
export function CandidateLayout() {
  return (
    <>
      <ScrollToTop />
      <TopBar compact />
      <Outlet />
    </>
  );
}

/**
 * One guard for every signed-in route. The shell follows the role: candidates get the compact header,
 * recruiters and admins get the workspace console with the left sidebar.
 */
export function AuthedLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoading label={t("route.checkingSession")} />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  const role = (user?.role ?? "").toLowerCase();
  if (role === "recruiter" || role === "employer" || role === "admin") {
    return <WorkspaceLayout />;
  }
  return <CandidateLayout />;
}
