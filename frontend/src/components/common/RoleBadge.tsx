import { Shield, ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";
import type { Role } from "@/types";

const config: Record<
  Role,
  { variant: "default" | "warning" | "destructive"; Icon: typeof User }
> = {
  passenger: { variant: "default", Icon: User },
  staff: { variant: "warning", Icon: Shield },
  admin: { variant: "destructive", Icon: ShieldCheck },
};

/** Coloured, icon-prefixed badge representing a user's role. */
export function RoleBadge({ role }: { role: Role }) {
  const { variant, Icon } = config[role];
  return (
    <Badge variant={variant} className="uppercase tracking-wide">
      <Icon className="h-3 w-3" />
      {titleCase(role)}
    </Badge>
  );
}
