import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import AuthRoute from "./components/auth/AuthRoute";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import SOPLibraryPage from "./pages/SOPLibraryPage";
import SOPDetailPage from "./pages/SOPDetailPage";
import BusinessProfilePage from "./pages/BusinessProfilePage";
import PracticeModePage from "./pages/PracticeModePage";
import PracticeChatPage from "./pages/PracticeChatPage";
import PracticeDebriefPage from "./pages/PracticeDebriefPage";
import KnowledgeBuilderPage from "./pages/KnowledgeBuilderPage";
import ComplianceLogPage from "./pages/ComplianceLogPage";
import ManagerReadinessPage from "./pages/ManagerReadinessPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Routes>
        {/* Auth routes — redirect to /dashboard if logged in */}
        <Route element={<AuthRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Onboarding — needs session, does NOT require org_id */}
        <Route element={<ProtectedRoute requireOrg={false} />}>
          <Route path="onboarding" element={<OnboardingPage />} />
        </Route>

        {/* Knowledge route — needs session + org, does NOT require KB */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="knowledge" element={<KnowledgeBuilderPage />} />
          </Route>
        </Route>

        {/* App routes — needs session + org + knowledge base */}
        <Route element={<ProtectedRoute requireKnowledgeBase />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="sops" element={<SOPLibraryPage />} />
            <Route path="sops/:id" element={<SOPDetailPage />} />
            <Route path="profile" element={<BusinessProfilePage />} />
            <Route path="practice" element={<PracticeModePage />} />
            <Route path="practice/:scenarioId" element={<PracticeChatPage />} />
            <Route path="practice/:scenarioId/debrief" element={<PracticeDebriefPage />} />
            <Route path="readiness" element={<ManagerReadinessPage />} />
            <Route path="compliance" element={<ComplianceLogPage />} />
          </Route>
        </Route>
      </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
