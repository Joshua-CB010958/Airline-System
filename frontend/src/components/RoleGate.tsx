import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/types";

interface RoleGateProps {
  allow: Role[];
  children: React.ReactNode;
  /** Optional fallback rendered when the user lacks the required role. */
  fallback?: React.ReactNode;
}

/**
 * Conditionally render children based on the current user's role. Used to hide
 * unauthorised UI controls (e.g. Cancel Booking, Update Baggage) so the UI
 * mirrors the server-side RBAC matrix.
 */
export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { hasRole } = useAuth();
  return <>{hasRole(allow) ? children : fallback}</>;
}
