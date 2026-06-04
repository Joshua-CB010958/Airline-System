import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealth } from "@/hooks/useHealth";

/** Compact live service-health readout pinned to the bottom of the sidebar. */
export function ServiceHealthMini() {
  const { data, isLoading } = useHealth();
  const online = data?.filter((s) => s.state === "online").length ?? 0;
  const total = data?.length ?? 4;

  return (
    <div className="rounded-lg border border-border/70 bg-card/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Activity className="h-3.5 w-3.5" /> Services
        </span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            online === total ? "text-success" : "text-warning"
          )}
        >
          {isLoading ? "…" : `${online}/${total}`}
        </span>
      </div>
      <div className="flex gap-1.5">
        {(data ?? Array.from({ length: 4 })).map((s, i) => (
          <div
            key={s?.key ?? i}
            title={s ? `${s.name}: ${s.state}` : "probing"}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              !s || isLoading
                ? "bg-muted-foreground/40"
                : s.state === "online"
                  ? "bg-success"
                  : "bg-destructive"
            )}
          />
        ))}
      </div>
    </div>
  );
}
