import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../LoadingScreen";
import logger from "../../lib/logger";

export default function ProtectedRoute({ requireOrg = true }: { requireOrg?: boolean }) {
  const { session, userProfile, loading } = useAuth();
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

  return <Outlet />;
}
