import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
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
import { useUpdateBaggage } from "@/hooks/useBaggage";
import { ApiError } from "@/services/apiClients";
import type { Baggage } from "@/types";

const STATUS_OPTIONS = [
  "Checked In",
  "In Transit",
  "Arrived",
  "Loaded",
  "Located",
  "Lost",
];

export function UpdateBaggageDialog({ baggage }: { baggage: Baggage }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(baggage.status);
  const [location, setLocation] = useState(baggage.location);
  const updateBaggage = useUpdateBaggage();

  // Reset local form state whenever the dialog re-opens for this row.
  function onOpenChange(next: boolean) {
    if (next) {
      setStatus(baggage.status);
      setLocation(baggage.location);
    }
    setOpen(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return;
    try {
      const updated = await updateBaggage.mutateAsync({
        baggage_id: baggage.id,
        status,
        location: location || undefined,
      });
      toast.success("Baggage updated", {
        description: `#${updated.id} · ${updated.status} @ ${updated.location}`,
      });
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update baggage.";
      toast.error("Update failed", { description: message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4" />
          <span className="hidden sm:inline">Update</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Baggage #{baggage.id}</DialogTitle>
          <DialogDescription>
            {baggage.passenger_name} · Flight {baggage.flight_id}. Writes to
            DynamoDB via PATCH /baggage/update.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {/* Ensure the current status is selectable even if non-standard */}
                {Array.from(new Set([baggage.status, ...STATUS_OPTIONS]))
                  .filter(Boolean)
                  .map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Heathrow Airport"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Optional · existing location retained if left unchanged.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateBaggage.isPending || !status}>
              {updateBaggage.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
