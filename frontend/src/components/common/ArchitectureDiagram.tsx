import {
  Database,
  Boxes,
  Plane,
  Ticket,
  Luggage,
  ShieldCheck,
  Radio,
  Zap,
  Monitor,
  ArrowDown,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthState, ServiceHealth, ServiceKey } from "@/types";

interface NodeProps {
  label: string;
  sublabel: string;
  icon: LucideIcon;
  state?: HealthState;
  tone?: "service" | "datastore" | "messaging" | "compute" | "client" | "observ";
}

const toneStyles: Record<NonNullable<NodeProps["tone"]>, string> = {
  client: "border-primary/40 bg-primary/5",
  service: "border-border bg-card",
  datastore: "border-accent/30 bg-accent/5",
  messaging: "border-warning/30 bg-warning/5",
  compute: "border-success/30 bg-success/5",
  observ: "border-muted-foreground/30 bg-secondary/40",
};

function Node({ label, sublabel, icon: Icon, state, tone = "service" }: NodeProps) {
  return (
    <div
      className={cn(
        "relative flex min-w-[150px] items-center gap-3 rounded-lg border px-3.5 py-2.5 shadow-sm",
        toneStyles[tone]
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sublabel}</p>
      </div>
      {state && (
        <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3">
          {state === "online" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
          )}
          <span
            className={cn(
              "relative inline-flex h-3 w-3 rounded-full ring-2 ring-card",
              state === "online" && "bg-success",
              state === "offline" && "bg-destructive",
              state === "checking" && "bg-muted-foreground"
            )}
          />
        </span>
      )}
    </div>
  );
}

function Connector({
  direction = "down",
  label,
}: {
  direction?: "down" | "right";
  label?: string;
}) {
  const Arrow = direction === "down" ? ArrowDown : ArrowRight;
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 text-muted-foreground",
        direction === "down" ? "flex-col py-1" : "px-1"
      )}
    >
      <div
        className={cn(
          "bg-gradient-to-b from-border to-primary/40",
          direction === "down" ? "h-5 w-px" : "h-px w-5"
        )}
      />
      <Arrow className="h-3.5 w-3.5 text-primary/70" />
      {label && (
        <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium">
          {label}
        </span>
      )}
    </div>
  );
}

function stateFor(source: ServiceKey, health?: ServiceHealth[]): HealthState {
  if (!health) return "checking";
  return health.find((h) => h.key === source)?.state ?? "checking";
}

/**
 * End-to-end request & event topology of the DAMS. Live status dots reflect the
 * latest health probe; the diagram traces the documented data flow:
 * Client → Auth → (Flight · Booking · Baggage) → datastores → SNS → Lambda → CloudWatch.
 */
export function ArchitectureDiagram({ health }: { health?: ServiceHealth[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="mx-auto flex min-w-[680px] flex-col items-center gap-1 py-2">
        {/* Tier 0 — Client */}
        <Node
          label="Client"
          sublabel="Browser · Operations Console"
          icon={Monitor}
          tone="client"
        />
        <Connector label="HTTPS · JWT" />

        {/* Tier 1 — Auth */}
        <Node
          label="Auth Service"
          sublabel="JWT issue · RBAC · :8003"
          icon={ShieldCheck}
          tone="service"
          state={stateFor("auth", health)}
        />
        <Connector label="Bearer token" />

        {/* Tier 2 — Edge services */}
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          <Node
            label="Flight Service"
            sublabel="Inventory · :8000"
            icon={Plane}
            tone="service"
            state={stateFor("flight", health)}
          />
          <Node
            label="Booking Service"
            sublabel="Orchestrator · :8001"
            icon={Ticket}
            tone="service"
            state={stateFor("booking", health)}
          />
          <Node
            label="Baggage Service"
            sublabel="Tracking · :8002"
            icon={Luggage}
            tone="service"
            state={stateFor("baggage", health)}
          />
        </div>

        {/* Booking ↔ Flight token-forwarding note */}
        <div className="my-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full border border-border px-2 py-0.5">
            Booking → Flight: zero-trust JWT forwarding (seat decrement / restore)
          </span>
        </div>

        {/* Tier 3 — Data stores */}
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          <Node
            label="Aurora PostgreSQL"
            sublabel="Bookings · persistent"
            icon={Database}
            tone="datastore"
          />
          <Node
            label="DynamoDB"
            sublabel="dams_baggage · persistent"
            icon={Boxes}
            tone="datastore"
          />
        </div>
        <Connector label="publish event (booking confirmed)" />

        {/* Tier 4 — SNS */}
        <Node
          label="Amazon SNS"
          sublabel="alms-booking-topic · eu-west-1"
          icon={Radio}
          tone="messaging"
        />
        <Connector label="async fan-out" />

        {/* Tier 5 — Lambda */}
        <Node
          label="AWS Lambda"
          sublabel="Notification Service (serverless)"
          icon={Zap}
          tone="compute"
        />
        <Connector label="structured logs" />

        {/* Tier 6 — CloudWatch */}
        <Node
          label="Amazon CloudWatch"
          sublabel="Logs · invocation traces"
          icon={Monitor}
          tone="observ"
        />
      </div>
    </div>
  );
}
