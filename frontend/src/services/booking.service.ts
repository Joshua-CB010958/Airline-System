import { bookingApi } from "./apiClients";
import type { Booking, CreateBookingInput } from "@/types";

export const bookingService = {
  /** GET /bookings — all bookings. */
  async list(): Promise<Booking[]> {
    const { data } = await bookingApi.get<Booking[]>("/bookings");
    return data;
  },

  /** GET /booking/{id} — single booking. */
  async get(id: string): Promise<Booking> {
    const { data } = await bookingApi.get<Booking>(`/booking/${id}`);
    return data;
  },

  /** POST /booking — create a booking (validates flight + decrements seat). */
  async create(input: CreateBookingInput): Promise<Booking> {
    const { data } = await bookingApi.post<Booking>("/booking", input);
    return data;
  },

  /** DELETE /booking/{id} — cancel a booking (staff/admin only). */
  async cancel(id: string): Promise<{ message: string }> {
    const { data } = await bookingApi.delete<{ message: string }>(
      `/booking/${id}`
    );
    return data;
  },
};
