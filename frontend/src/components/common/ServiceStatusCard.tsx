import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthState } from "@/types";

interface ServiceStatusCardProps {
  name: string;
  meta: string;
  icon: LucideIcon;
  state: HealthState;
  latencyMs?: number | null;
  /** When true the state is derived from an owning service, not probed directly. */
  inferred?: boolean;
}

const dotColor: Record<HealthState, string> = {
  online: "bg-success",
  offline: "bg-destructive",
  checking: "bg-muted-foreground",
};

const ringColor: Record<HealthState, string> = {
  online: "border-success/30",
  offline: "border-destructive/30",
  checking: "border-border",
};

/**
 * A single architecture component's live status tile. Used in both the
 * dashboard status grid and the admin system-overview grid.
 */
export function ServiceStatusCard({
  name,
  meta,
  icon: Icon,
  state,
  latencyMs,
  inferred,
}: ServiceStatusCardProps) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-lg border bg-card/60 p-3.5 transition-colors",
        ringColor[state]
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary/70 text-foreground/80">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="relative flex h-2.5 w-2.5">
          {state === "online" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              dotColor[state]
            )}
          />
        </span>
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wide",
            state === "online" && "text-success",
            state === "offline" && "text-destructive",
            state === "checking" && "text-muted-foreground"
          )}
        >
          {state === "checking" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : state === "online" ? (
            inferred ? "Active" : `${latencyMs ?? "—"}ms`
          ) : (
            "Down"
          )}
        </span>
      </div>
    </div>
  );
}
