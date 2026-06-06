import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { baggageService } from "@/services/baggage.service";
import type { CreateBaggageInput, UpdateBaggageInput } from "@/types";

export const baggageKeys = {
  all: ["baggage"] as const,
};

/** Query all baggage records. */
export function useBaggage() {
  return useQuery({
    queryKey: baggageKeys.all,
    queryFn: baggageService.list,
  });
}

/** Create a baggage record (staff/admin). */
export function useCreateBaggage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBaggageInput) => baggageService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: baggageKeys.all });
    },
  });
}

/** Update a baggage record's status/location (staff/admin). */
export function useUpdateBaggage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBaggageInput) => baggageService.update(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: baggageKeys.all });
    },
  });
}
