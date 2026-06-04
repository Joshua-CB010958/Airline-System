import { useMemo, useState } from "react";
import { Plane, Search, RefreshCw, Filter } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, TableSkeleton } from "@/components/common/StateViews";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlights } from "@/hooks/useFlights";
import { ApiError } from "@/services/apiClients";
import { cn } from "@/lib/utils";

const COLUMNS = ["Flight", "Route", "Available Seats", "Status"];

export function FlightsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useFlights();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const statuses = useMemo(() => {
    const set = new Set<string>();
    data?.forEach((f) => set.add(f.status));
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter((f) => {
      const matchesQuery =
        !q ||
        f.flight_number.toLowerCase().includes(q) ||
        f.origin.toLowerCase().includes(q) ||
        f.destination.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || f.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data, query, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Flight Inventory"
        description="Live flight records from the Flight Service (:8000)."
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
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search flight, origin, destination…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
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
                    : "Failed to load flights."
                }
                onRetry={() => refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Plane}
                title="No flights found"
                description={
                  query || statusFilter !== "all"
                    ? "No flights match your search or filter."
                    : "The flight inventory is currently empty."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => {
                  const low = f.available_seats <= 10;
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Plane className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold">{f.flight_number}</p>
                            <p className="text-xs text-muted-foreground">
                              ID #{f.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{f.origin}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{f.destination}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={low ? "warning" : "secondary"}>
                          {f.available_seats} seats
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={f.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Footer count */}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              Showing {filtered.length} of {data?.length ?? 0} flights
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
