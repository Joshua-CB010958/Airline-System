import { flightApi } from "./apiClients";
import type { Flight } from "@/types";

export const flightService = {
  /** GET /flights — full flight inventory. */
  async list(): Promise<Flight[]> {
    const { data } = await flightApi.get<Flight[]>("/flights");
    return data;
  },

  /** GET /flight/{id} — single flight record. */
  async get(id: number): Promise<Flight> {
    const { data } = await flightApi.get<Flight>(`/flight/${id}`);
    return data;
  },
};
