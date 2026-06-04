import { useState } from "react";
import { Loader2, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateBooking } from "@/hooks/useBookings";
import { ApiError } from "@/services/apiClients";
import type { Flight, SeatClass } from "@/types";

const SEAT_CLASSES: SeatClass[] = ["economy", "business", "first"];

export function CreateBookingDialog({ flights }: { flights?: Flight[] }) {
  const [open, setOpen] = useState(false);
  const [flightId, setFlightId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [seatClass, setSeatClass] = useState<SeatClass>("economy");
  const createBooking = useCreateBooking();

  function reset() {
    setFlightId("");
    setName("");
    setEmail("");
    setSeatClass("economy");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!flightId || name.trim().length < 2 || !email) return;
    try {
      const booking = await createBooking.mutateAsync({
        flight_id: flightId,
        passenger_name: name.trim(),
        passenger_email: email.trim(),
        seat_class: seatClass,
      });
      toast.success("Booking confirmed", {
        description: `Ref ${booking.id.slice(0, 8)}… · ${booking.passenger_name} · seat decremented & SNS event published.`,
      });
      setOpen(false);
      reset();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create booking.";
      toast.error("Booking failed", { description: message });
    }
  }

  const availableFlights = flights?.filter((f) => f.available_seats > 0) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New Booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" /> Create Booking
          </DialogTitle>
          <DialogDescription>
            The Booking Service validates seat availability with the Flight
            Service, persists to Aurora, then publishes an SNS event.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="flight">Flight</Label>
            <Select value={flightId} onValueChange={setFlightId}>
              <SelectTrigger id="flight">
                <SelectValue placeholder="Select a flight" />
              </SelectTrigger>
              <SelectContent>
                {availableFlights.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No flights with available seats
                  </SelectItem>
                ) : (
                  availableFlights.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.flight_number} · {f.origin} → {f.destination} (
                      {f.available_seats} seats)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Passenger Name</Label>
            <Input
              id="name"
              placeholder="Alice Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Passenger Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="alice@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seat">Seat Class</Label>
            <Select
              value={seatClass}
              onValueChange={(v) => setSeatClass(v as SeatClass)}
            >
              <SelectTrigger id="seat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEAT_CLASSES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createBooking.isPending ||
                !flightId ||
                flightId === "none" ||
                name.trim().length < 2 ||
                !email
              }
            >
              {createBooking.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                "Confirm Booking"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
