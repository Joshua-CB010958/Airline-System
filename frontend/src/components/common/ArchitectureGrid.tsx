import {
  Database,
  Boxes,
  Plane,
  Ticket,
  Luggage,
  ShieldCheck,
  Radio,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ServiceStatusCard } from "./ServiceStatusCard";
import type { HealthState, ServiceHealth, ServiceKey } from "@/types";

interface ArchitectureGridProps {
  health?: ServiceHealth[];
  isLoading?: boolean;
}

interface CardDescriptor {
  name: string;
  meta: string;
  icon: LucideIcon;
  /** Service whose probe drives this card's state. */
  source: ServiceKey;
  /** Infrastructure components are inferred from their owning service. */
  inferred?: boolean;
}

// The eight architecture components surfaced in the status grid. The four
// FastAPI services are probed directly; the managed AWS components are inferred
// from the health of the service that owns them (Booking → Aurora/SNS/Lambda,
// Baggage → DynamoDB), since they expose no browser-reachable health endpoint.
const cards: CardDescriptor[] = [
  { name: "Auth Service", meta: "FastAPI · :8003", icon: ShieldCheck, source: "auth" },
  { name: "Flight Service", meta: "FastAPI · :8000", icon: Plane, source: "flight" },
  { name: "Booking Service", meta: "FastAPI · :8001", icon: Ticket, source: "booking" },
  { name: "Baggage Service", meta: "FastAPI · :8002", icon: Luggage, source: "baggage" },
  { name: "Aurora PostgreSQL", meta: "Booking store · eu-west-1", icon: Database, source: "booking", inferred: true },
  { name: "DynamoDB", meta: "dams_baggage · eu-west-1", icon: Boxes, source: "baggage", inferred: true },
  { name: "Amazon SNS", meta: "alms-booking-topic", icon: Radio, source: "booking", inferred: true },
  { name: "AWS Lambda", meta: "Notification consumer", icon: Zap, source: "booking", inferred: true },
];

/** Resolve the live state for a given source service. */
function stateFor(
  source: ServiceKey,
  health?: ServiceHealth[],
  isLoading?: boolean
): { state: HealthState; latency: number | null } {
  if (isLoading || !health) return { state: "checking", latency: null };
  const match = health.find((h) => h.key === source);
  if (!match) return { state: "checking", latency: null };
  return { state: match.state, latency: match.latencyMs };
}

/** The 8-component live architecture status grid. */
export function ArchitectureGrid({ health, isLoading }: ArchitectureGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const { state, latency } = stateFor(card.source, health, isLoading);
        return (
          <ServiceStatusCard
            key={card.name}
            name={card.name}
            meta={card.meta}
            icon={card.icon}
            state={state}
            latencyMs={latency}
            inferred={card.inferred}
          />
        );
      })}
    </div>
  );
}
