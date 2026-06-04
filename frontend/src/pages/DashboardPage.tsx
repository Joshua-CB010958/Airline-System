import { Link } from "react-router-dom";
import {
  Plane,
  Ticket,
  Luggage,
  Activity,
  ArrowUpRight,
  Server,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/common/StatCard";
import { RoleBadge } from "@/components/common/RoleBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ArchitectureGrid } from "@/components/common/ArchitectureGrid";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useFlights } from "@/hooks/useFlights";
import { useBookings } from "@/hooks/useBookings";
import { useBaggage } from "@/hooks/useBaggage";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, titleCase } from "@/lib/utils";
import { SeatClassChart } from "@/components/charts/SeatClassChart";
import { FlightStatusChart } from "@/components/charts/FlightStatusChart";

export function DashboardPage() {
  const { user, role } = useAuth();
  const flights = useFlights();
  const bookings = useBookings();
  const baggage = useBaggage();
  const health = useHealth();

  const onlineCount = health.data?.filter((s) => s.state === "online").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Welcome back, {user?.full_name?.split(" ")[0] ?? user?.username}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live operational overview of the Distributed Airline Management System.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            flights.refetch();
            bookings.refetch();
            baggage.refetch();
            health.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Flights"
          value={flights.data?.length ?? 0}
          icon={Plane}
          loading={flights.isLoading}
          hint="Flight Service · in-memory inventory"
          accent="primary"
        />
        <StatCard
          label="Total Bookings"
          value={bookings.data?.length ?? 0}
          icon={Ticket}
          loading={bookings.isLoading}
          hint="Booking Service · Aurora PostgreSQL"
          accent="success"
        />
        <StatCard
          label="Baggage Records"
          value={baggage.data?.length ?? 0}
          icon={Luggage}
          loading={baggage.isLoading}
          hint="Baggage Service · DynamoDB"
          accent="warning"
        />
        <Card className="overflow-hidden">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your Role
              </p>
              <div className="mt-1.5">
                {role ? (
                  <RoleBadge role={role} />
                ) : (
                  <Skeleton className="h-6 w-20" />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {onlineCount}/4 services online
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Architecture status */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" /> Architecture Status
            </CardTitle>
            <CardDescription>
              Live health across services & managed AWS components · auto-refreshes every 8s
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ArchitectureGrid health={health.data} isLoading={health.isLoading} />
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bookings by Seat Class</CardTitle>
            <CardDescription>Distribution across cabin classes</CardDescription>
          </CardHeader>
          <CardContent>
            <SeatClassChart bookings={bookings.data} loading={bookings.isLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Flights by Status</CardTitle>
            <CardDescription>Current operational state of inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <FlightStatusChart flights={flights.data} loading={flights.isLoading} />
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent flights */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Flights</CardTitle>
              <CardDescription>Latest inventory records</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/flights">
                View all <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {flights.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            ) : flights.data && flights.data.length > 0 ? (
              flights.data.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Plane className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{f.flight_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.origin} → {f.destination}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {f.available_seats} seats
                    </span>
                    <StatusBadge status={f.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Plane}
                title="No flights"
                description="The flight inventory is currently empty."
              />
            )}
          </CardContent>
        </Card>

        {/* Recent bookings */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Latest passenger reservations</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/bookings">
                View all <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookings.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            ) : bookings.data && bookings.data.length > 0 ? (
              bookings.data.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/10 text-success">
                      <Ticket className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {b.passenger_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Flight {b.flight_id} · {titleCase(String(b.seat_class))} ·{" "}
                        {formatDate(b.created_at)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))
            ) : (
              <EmptyState
                icon={Ticket}
                title="No bookings"
                description="No reservations have been created yet."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
