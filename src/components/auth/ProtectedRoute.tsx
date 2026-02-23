import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../LoadingScreen";
import logger from "../../lib/logger";

interface Props {
  requireOrg?: boolean;
  requireKnowledgeBase?: boolean;
}

export default function ProtectedRoute({ requireOrg = true, requireKnowledgeBase = false }: Props) {
  const { session, userProfile, loading, hasKnowledgeBase } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <LoadingScreen />;

  if (!session) {
    logger.info("auth_guard_redirect", { from: pathname, to: "/login" });
    return <Navigate to="/login" replace />;
  }

  if (requireOrg && userProfile && !userProfile.org_id) {
    logger.info("auth_guard_redirect", { from: pathname, to: "/onboarding" });
    return <Navigate to="/onboarding" replace />;
  }

  if (requireKnowledgeBase && !hasKnowledgeBase) {
    logger.info("auth_guard_redirect", { from: pathname, to: "/knowledge" });
    return <Navigate to="/knowledge" replace />;
  }

  return <Outlet />;
}
