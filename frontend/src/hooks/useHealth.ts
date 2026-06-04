import { useQuery } from "@tanstack/react-query";
import { healthService } from "@/services/health.service";

export const healthKeys = {
  all: ["health"] as const,
};

/**
 * Probe all microservices on an interval so the dashboard/admin status grids
 * reflect live reachability. Kept aggressive (8s) for demo responsiveness.
 */
export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: healthService.probeAll,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });
}
