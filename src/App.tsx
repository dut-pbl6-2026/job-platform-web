import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ChatProvider } from "./contexts/ChatContext";
import { ToastViewport } from "./components/ToastViewport";
import { ChatDock } from "./components/ChatDock";
import { GuestOnly, ProtectedRoute, RequireRole } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthedLayout, PublicLayout } from "./layouts/PublicLayout";
import { createQueryClient } from "./lib/queryClient";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RegisterCompanyPage from "./pages/RegisterCompanyPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import HomePage from "./pages/HomePage";
import JobListPage from "./pages/JobListPage";
import JobDetailPage from "./pages/JobDetailPage";
import CompanyPage from "./pages/CompanyPage";
import NotFoundPage from "./pages/NotFoundPage";
import ApplyPage from "./pages/ApplyPage";
import ProfilePage from "./pages/ProfilePage";
import ApplicationHistoryPage from "./pages/ApplicationHistoryPage";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminJobsPage from "./pages/AdminJobsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import ChatPage from "./pages/ChatPage";
import RecruiterDashboardPage from "./pages/RecruiterDashboardPage";
import RecruiterJobsPage from "./pages/RecruiterJobsPage";
import RecruiterPostJobPage from "./pages/RecruiterPostJobPage";
import RecruiterApplicationsPage from "./pages/RecruiterApplicationsPage";
import RecruiterCompanyPage from "./pages/RecruiterCompanyPage";
import RecruiterInviteCodesPage from "./pages/RecruiterInviteCodesPage";
import RecruiterJoinRequestsPage from "./pages/RecruiterJoinRequestsPage";
import JoinRequestPage from "./pages/JoinRequestPage";

/**
 * One layout per audience. Public pages get the marketing chrome; auth pages keep their own panel;
 * every signed-in route goes through AuthedLayout, which picks the candidate header or the workspace
 * console from the role. Role-only routes add RequireRole inside that shell.
 */
export default function App() {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <ToastProvider>
              <ChatProvider>
                <ToastViewport />
                <ChatDock />
                <Routes>
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/jobs" element={<JobListPage />} />
                    <Route path="/jobs/:id" element={<JobDetailPage />} />
                    <Route path="/companies/:id" element={<CompanyPage />} />
                  </Route>

                  <Route
                    path="/login"
                    element={
                      <GuestOnly>
                        <LoginPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <GuestOnly>
                        <RegisterPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/register-company"
                    element={
                      <GuestOnly>
                        <RegisterCompanyPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/forgot-password"
                    element={
                      <GuestOnly>
                        <ForgotPasswordPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/reset-password"
                    element={
                      <GuestOnly>
                        <ResetPasswordPage />
                      </GuestOnly>
                    }
                  />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />

                  <Route element={<AuthedLayout />}>
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/join-request" element={<JoinRequestPage />} />
                    <Route
                      path="/applications"
                      element={
                        <ProtectedRoute applicantOnly>
                          <ApplicationHistoryPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/applications/:id"
                      element={
                        <ProtectedRoute applicantOnly>
                          <ApplicationDetailPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/jobs/:id/apply"
                      element={
                        <ProtectedRoute applicantOnly>
                          <ApplyPage />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/recruiter"
                      element={
                        <RequireRole requiredRole="Recruiter">
                          <RecruiterDashboardPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/recruiter/jobs"
                      element={
                        <RequireRole requiredRole="Recruiter">
                          <RecruiterJobsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/recruiter/jobs/new"
                      element={
                        <RequireRole requiredRole="Recruiter">
                          <RecruiterPostJobPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/recruiter/jobs/:jobId/edit"
                      element={
                        <RequireRole requiredRole="Recruiter">
                          <RecruiterPostJobPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/recruiter/jobs/:jobId/applications"
                      element={
                        <RequireRole requiredRole="Recruiter">
                          <RecruiterApplicationsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/recruiter/company"
                      element={
                        <RequireRole requiredRole="Recruiter">
                          <RecruiterCompanyPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/recruiter/invite-codes"
                      element={
                        <RequireRole requiredRole="Recruiter">
                          <RecruiterInviteCodesPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/recruiter/join-requests"
                      element={
                        <RequireRole requiredRole="Recruiter">
                          <RecruiterJoinRequestsPage />
                        </RequireRole>
                      }
                    />

                    <Route
                      path="/admin"
                      element={
                        <RequireRole requiredRole="Admin">
                          <AdminDashboardPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/jobs"
                      element={
                        <RequireRole requiredRole="Admin">
                          <AdminJobsPage />
                        </RequireRole>
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        <RequireRole requiredRole="Admin">
                          <AdminUsersPage />
                        </RequireRole>
                      }
                    />
                  </Route>

                  <Route element={<PublicLayout />}>
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </ChatProvider>
            </ToastProvider>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
