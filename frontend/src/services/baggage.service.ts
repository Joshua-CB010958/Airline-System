import { baggageApi } from "./apiClients";
import type { Baggage, CreateBaggageInput, UpdateBaggageInput } from "@/types";

export const baggageService = {
  /** GET /baggage — all baggage records. */
  async list(): Promise<Baggage[]> {
    const { data } = await baggageApi.get<Baggage[]>("/baggage");
    return data;
  },

  /** POST /baggage — create a baggage record (staff/admin only). */
  async create(input: CreateBaggageInput): Promise<Baggage> {
    const { data } = await baggageApi.post<Baggage>("/baggage", input);
    return data;
  },

  /** GET /baggage/{id} — single baggage record. */
  async get(id: number): Promise<Baggage> {
    const { data } = await baggageApi.get<Baggage>(`/baggage/${id}`);
    return data;
  },

  /** PATCH /baggage/update — update status/location (staff/admin only). */
  async update(input: UpdateBaggageInput): Promise<Baggage> {
    const { data } = await baggageApi.patch<Baggage>("/baggage/update", input);
    return data;
  },
};
