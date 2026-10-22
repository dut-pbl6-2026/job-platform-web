import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastViewport } from "./components/ToastViewport";
import { GuestOnly, ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppFooter } from "./components/AppFooter";
import { createQueryClient } from "./lib/queryClient";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const JobListPage = lazy(() => import("./pages/JobListPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));
const ApplyPage = lazy(() => import("./pages/ApplyPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ApplicationHistoryPage = lazy(() => import("./pages/ApplicationHistoryPage"));
const ApplicationDetailPage = lazy(() => import("./pages/ApplicationDetailPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminJobsPage = lazy(() => import("./pages/AdminJobsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));

function PageFallback() {
  return <div style={{ display: "grid", placeItems: "center", minHeight: "40vh" }}><div className="spinner" /></div>;
}

export default function App() {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <ToastProvider>
            <ToastViewport />
            <Suspense fallback={<PageFallback />}>
            <Routes>
            <Route path="/" element={<Navigate to="/jobs" replace />} />
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
            <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/jobs" element={<JobListPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/jobs/:id/apply" element={<ProtectedRoute><ApplyPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/applications" element={<ProtectedRoute><ApplicationHistoryPage /></ProtectedRoute>} />
            <Route path="/applications/:id" element={<ProtectedRoute><ApplicationDetailPage /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
            <Route path="/admin/jobs" element={<AdminRoute><AdminJobsPage /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/jobs" replace />} />
            </Routes>
            </Suspense>
            <AppFooter />
            </ToastProvider>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
