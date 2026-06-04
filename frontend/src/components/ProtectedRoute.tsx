import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/types";

interface ProtectedRouteProps {
  /** If provided, the user's role must be in this list to access the route. */
  allow?: Role[];
}

/**
 * Gate for authenticated routes. Redirects unauthenticated users to /login
 * (preserving the attempted location) and role-unauthorised users to /dashboard.
 */
export function ProtectedRoute({ allow }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing, role } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow && role && !allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
