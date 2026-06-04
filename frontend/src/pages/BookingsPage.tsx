import { useMemo, useState } from "react";
import { Ticket, Search, RefreshCw, Mail } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, TableSkeleton } from "@/components/common/StateViews";
import { RoleGate } from "@/components/RoleGate";
import { CreateBookingDialog } from "@/components/bookings/CreateBookingDialog";
import { CancelBookingButton } from "@/components/bookings/CancelBookingButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBookings } from "@/hooks/useBookings";
import { useFlights } from "@/hooks/useFlights";
import { ApiError } from "@/services/apiClients";
import { cn, formatDateTime, titleCase } from "@/lib/utils";

const COLUMNS = [
  "Passenger",
  "Flight",
  "Seat Class",
  "Status",
  "Created",
  "Booking ID",
  "",
];

export function BookingsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useBookings();
  const flights = useFlights();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (b) =>
        b.passenger_name.toLowerCase().includes(q) ||
        b.passenger_email.toLowerCase().includes(q) ||
        String(b.flight_id).toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
    );
  }, [data, query]);

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Passenger reservations from the Booking Service (:8001) · Aurora PostgreSQL."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
        <CreateBookingDialog flights={flights.data} />
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border/60 p-4">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, email, flight or booking ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-4">
              <TableSkeleton columns={COLUMNS} />
            </div>
          ) : isError ? (
            <div className="p-6">
              <ErrorState
                message={
                  error instanceof ApiError
                    ? error.message
                    : "Failed to load bookings."
                }
                onRetry={() => refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Ticket}
                title="No bookings found"
                description={
                  query
                    ? "No bookings match your search."
                    : "Create the first booking to get started."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((c, i) => (
                    <TableHead key={i}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/10 text-success">
                          <Ticket className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold">{b.passenger_name}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{b.passenger_email}</span>
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">#{b.flight_id}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {titleCase(String(b.seat_class))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(b.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {b.id.slice(0, 8)}…
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <RoleGate allow={["staff", "admin"]}>
                        <CancelBookingButton booking={b} />
                      </RoleGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && !isError && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {filtered.length} of {data?.length ?? 0} bookings
              </span>
              <RoleGate
                allow={["passenger"]}
                fallback={
                  <span className="text-success">
                    Cancellation enabled for your role
                  </span>
                }
              >
                <span>Cancellation restricted to staff &amp; admin</span>
              </RoleGate>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
