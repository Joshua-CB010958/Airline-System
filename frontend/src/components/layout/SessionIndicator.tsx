import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { timeUntilExpiry } from "@/lib/jwt";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function format(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * JWT session indicator — shows a live countdown to token expiry, mirroring the
 * 30-minute HS256 token lifetime. Turns amber under 5 minutes remaining.
 */
export function SessionIndicator() {
  const { token } = useAuth();
  const [remaining, setRemaining] = useState(() =>
    token ? timeUntilExpiry(token) : 0
  );

  useEffect(() => {
    if (!token) return;
    const tick = () => setRemaining(timeUntilExpiry(token));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [token]);

  if (!token) return null;
  const low = remaining < 5 * 60 * 1000;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:flex",
            low
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-success/30 bg-success/10 text-success"
          )}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                low ? "bg-warning" : "bg-success"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                low ? "bg-warning" : "bg-success"
              )}
            />
          </span>
          <KeyRound className="h-3.5 w-3.5" />
          <span className="tabular-nums">{format(remaining)}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        Active JWT session · expires in {format(remaining)} (HS256, 30-min TTL)
      </TooltipContent>
    </Tooltip>
  );
}
