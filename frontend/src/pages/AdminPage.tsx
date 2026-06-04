import { useQuery } from "@tanstack/react-query";
import {
  Network,
  Server,
  Gauge,
  Users,
  RefreshCw,
  Cloud,
  Boxes,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchitectureGrid } from "@/components/common/ArchitectureGrid";
import { ArchitectureDiagram } from "@/components/common/ArchitectureDiagram";
import { RoleBadge } from "@/components/common/RoleBadge";
import { LoadingState } from "@/components/common/StateViews";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHealth } from "@/hooks/useHealth";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

const techStack = [
  { icon: Server, label: "FastAPI", meta: "4 microservices · Python 3.11" },
  { icon: Layers, label: "Aurora PostgreSQL", meta: "Booking persistence" },
  { icon: Boxes, label: "DynamoDB", meta: "dams_baggage table" },
  { icon: Cloud, label: "SNS + Lambda", meta: "Event-driven notifications" },
];

export function AdminPage() {
  const health = useHealth();
  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: authService.adminUsers,
    retry: false,
  });

  const onlineCount = health.data?.filter((s) => s.state === "online").length ?? 0;
  const avgLatency =
    health.data && health.data.some((s) => s.latencyMs != null)
      ? Math.round(
          health.data
            .filter((s) => s.latencyMs != null)
            .reduce((acc, s) => acc + (s.latencyMs ?? 0), 0) /
            health.data.filter((s) => s.latencyMs != null).length
        )
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration"
        description="Operational overview, live topology, and user directory — admin only."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => health.refetch()}
          disabled={health.isFetching}
        >
          <RefreshCw
            className={cn("h-4 w-4", health.isFetching && "animate-spin")}
          />
          Probe services
        </Button>
      </PageHeader>

      {/* Top metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10 text-success">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Services Online
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {onlineCount}
                <span className="text-base text-muted-foreground">/4</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Avg Latency
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {avgLatency != null ? `${avgLatency}` : "—"}
                <span className="text-base text-muted-foreground"> ms</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Registered Users
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {users.data?.users.length ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System overview status grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> System Overview
          </CardTitle>
          <CardDescription>
            Live status of every architecture component.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArchitectureGrid health={health.data} isLoading={health.isLoading} />
        </CardContent>
      </Card>

      {/* Architecture diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" /> Architecture Topology
          </CardTitle>
          <CardDescription>
            End-to-end request &amp; event flow across the distributed system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArchitectureDiagram health={health.data} />
        </CardContent>
      </Card>

      {/* Tech stack + Users */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Technology Stack</CardTitle>
            <CardDescription>Core platform components</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {techStack.map(({ icon: Icon, label, meta }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary/70 text-foreground/80">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{meta}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> User Directory
            </CardTitle>
            <CardDescription>
              From GET /admin/users on the Auth Service.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {users.isLoading ? (
              <LoadingState label="Loading users…" />
            ) : users.isError ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Unable to load the user directory.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data?.users.map((u) => (
                    <TableRow key={u.username}>
                      <TableCell className="font-mono text-sm">
                        {u.username}
                      </TableCell>
                      <TableCell className="font-medium">
                        {u.full_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={u.role as Role} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AWS footprint note */}
      <Card>
        <CardHeader>
          <CardTitle>AWS Footprint</CardTitle>
          <CardDescription>
            Managed cloud resources · region eu-west-1 (Ireland)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            "SNS · alms-booking-topic",
            "Lambda · Notification Service",
            "Aurora PostgreSQL · Bookings",
            "DynamoDB · dams_baggage",
          ].map((r) => (
            <Badge key={r} variant="outline" className="font-normal">
              {r}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
