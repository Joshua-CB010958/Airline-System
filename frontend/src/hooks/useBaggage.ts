import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { baggageService } from "@/services/baggage.service";
import type { UpdateBaggageInput } from "@/types";

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
