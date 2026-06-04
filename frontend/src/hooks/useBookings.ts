import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { bookingService } from "@/services/booking.service";
import { flightKeys } from "./useFlights";
import type { CreateBookingInput } from "@/types";

export const bookingKeys = {
  all: ["bookings"] as const,
};

/** Query all bookings. */
export function useBookings() {
  return useQuery({
    queryKey: bookingKeys.all,
    queryFn: bookingService.list,
  });
}

/** Create a booking; invalidates bookings + flights (seat count changes). */
export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookingKeys.all });
      qc.invalidateQueries({ queryKey: flightKeys.all });
    },
  });
}

/** Cancel a booking; invalidates bookings + flights (seat restored). */
export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bookingService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookingKeys.all });
      qc.invalidateQueries({ queryKey: flightKeys.all });
    },
  });
}
