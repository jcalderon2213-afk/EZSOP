import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "../LoadingScreen";

export default function AuthRoute() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (session) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
