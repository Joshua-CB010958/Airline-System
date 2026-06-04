import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCancelBooking } from "@/hooks/useBookings";
import { ApiError } from "@/services/apiClients";
import type { Booking } from "@/types";

/**
 * Cancel control for a booking. Rendered only for staff/admin (callers wrap it
 * in <RoleGate>). Confirms before issuing DELETE /booking/{id}.
 */
export function CancelBookingButton({ booking }: { booking: Booking }) {
  const cancelBooking = useCancelBooking();

  async function confirm() {
    try {
      await cancelBooking.mutateAsync(booking.id);
      toast.success("Booking cancelled", {
        description: `${booking.passenger_name}'s booking removed · seat restored on Flight ${booking.flight_id}.`,
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to cancel booking.";
      toast.error("Cancellation failed", { description: message });
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Cancel</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove{" "}
            <span className="font-medium text-foreground">
              {booking.passenger_name}
            </span>
            's booking on Flight {booking.flight_id} and restore the seat to
            inventory. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={cancelBooking.isPending}
          >
            {cancelBooking.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Cancelling…
              </>
            ) : (
              "Cancel booking"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
