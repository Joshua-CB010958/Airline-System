import { useMemo, useState } from "react";
import { Luggage, Search, RefreshCw, MapPin } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState, TableSkeleton } from "@/components/common/StateViews";
import { RoleGate } from "@/components/RoleGate";
import { UpdateBaggageDialog } from "@/components/baggage/UpdateBaggageDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBaggage } from "@/hooks/useBaggage";
import { ApiError } from "@/services/apiClients";
import { cn } from "@/lib/utils";

const COLUMNS = ["ID", "Passenger", "Flight", "Status", "Location", ""];

export function BaggagePage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useBaggage();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (b) =>
        b.passenger_name.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q) ||
        String(b.flight_id).includes(q) ||
        String(b.id).includes(q)
    );
  }, [data, query]);

  return (
    <div>
      <PageHeader
        title="Baggage Tracking"
        description="Baggage records from the Baggage Service (:8002) · DynamoDB."
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
          <div className="border-b border-border/60 p-4">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search passenger, status or location…"
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
                    : "Failed to load baggage records."
                }
                onRetry={() => refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Luggage}
                title="No baggage records"
                description={
                  query
                    ? "No baggage matches your search."
                    : "No baggage items are being tracked yet."
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
                      <Badge variant="outline">#{b.id}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-warning/10 text-warning">
                          <Luggage className="h-4 w-4" />
                        </div>
                        <span className="font-semibold">
                          {b.passenger_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">#{b.flight_id}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {b.location || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <RoleGate allow={["staff", "admin"]}>
                        <UpdateBaggageDialog baggage={b} />
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
                Showing {filtered.length} of {data?.length ?? 0} records
              </span>
              <RoleGate
                allow={["passenger"]}
                fallback={
                  <span className="text-success">
                    Updates enabled for your role
                  </span>
                }
              >
                <span>Updates restricted to staff &amp; admin</span>
              </RoleGate>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
