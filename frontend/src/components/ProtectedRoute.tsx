import { Navigate } from "react-router-dom";
import { useAuth } from "../modules/auth/AuthContext";
import type { ProtectedRouteProps } from "../types/ui";

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
