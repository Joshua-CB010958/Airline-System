import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Maps a free-text domain status (flight, booking, or baggage) to a coloured
 * badge variant. Falls back to a neutral style for unknown values.
 */
function variantFor(status: string): BadgeProps["variant"] {
  const s = status.toLowerCase();
  if (["on time", "confirmed", "arrived", "checked in", "located"].includes(s))
    return "success";
  if (["in transit", "boarding", "delayed", "pending"].includes(s))
    return "warning";
  if (["cancelled", "canceled", "lost", "diverted"].includes(s))
    return "destructive";
  return "secondary";
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge variant={variantFor(status)} className={cn("capitalize", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}
