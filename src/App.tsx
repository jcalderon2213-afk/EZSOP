import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import SOPLibraryPage from "./pages/SOPLibraryPage";
import SOPDetailPage from "./pages/SOPDetailPage";
import CreateSOPPage from "./pages/CreateSOPPage";
import ContextUploadPage from "./pages/ContextUploadPage";
import VoiceCapturePage from "./pages/VoiceCapturePage";
import TranscriptReviewPage from "./pages/TranscriptReviewPage";
import DraftEditorPage from "./pages/DraftEditorPage";
import ComplianceAuditPage from "./pages/ComplianceAuditPage";
import BusinessProfilePage from "./pages/BusinessProfilePage";
import PracticeModePage from "./pages/PracticeModePage";
import PracticeChatPage from "./pages/PracticeChatPage";
import PracticeDebriefPage from "./pages/PracticeDebriefPage";
import ComplianceLogPage from "./pages/ComplianceLogPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function App() {
  return (
    <Routes>
      {/* Auth routes — no AppShell */}
      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />

      {/* App routes — wrapped in AppShell */}
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="sops" element={<SOPLibraryPage />} />
        <Route path="sops/:id" element={<SOPDetailPage />} />
        <Route path="sops/create" element={<CreateSOPPage />}>
          <Route index element={<Navigate to="context" replace />} />
          <Route path="context" element={<ContextUploadPage />} />
          <Route path="voice" element={<VoiceCapturePage />} />
          <Route path="transcript" element={<TranscriptReviewPage />} />
          <Route path="draft" element={<DraftEditorPage />} />
          <Route path="compliance" element={<ComplianceAuditPage />} />
        </Route>
        <Route path="profile" element={<BusinessProfilePage />} />
        <Route path="practice" element={<PracticeModePage />} />
        <Route path="practice/:scenarioId" element={<PracticeChatPage />} />
        <Route path="practice/:scenarioId/debrief" element={<PracticeDebriefPage />} />
        <Route path="compliance" element={<ComplianceLogPage />} />
      </Route>
    </Routes>
  );
}

export default App;
