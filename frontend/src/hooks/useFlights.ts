import { useQuery } from "@tanstack/react-query";
import { flightService } from "@/services/flight.service";

export const flightKeys = {
  all: ["flights"] as const,
  detail: (id: number) => ["flights", id] as const,
};

/** Query the full flight inventory. */
export function useFlights() {
  return useQuery({
    queryKey: flightKeys.all,
    queryFn: flightService.list,
  });
}
