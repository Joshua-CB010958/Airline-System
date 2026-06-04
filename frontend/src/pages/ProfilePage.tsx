import { useQuery } from "@tanstack/react-query";
import {
  User,
  Mail,
  BadgeCheck,
  KeyRound,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/common/RoleBadge";
import { LoadingState, ErrorState } from "@/components/common/StateViews";
import { Separator } from "@/components/ui/separator";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/hooks/useAuth";
import { decodeJwt } from "@/lib/jwt";
import { initials, formatDateTime } from "@/lib/utils";
import { ApiError } from "@/services/apiClients";

const rolePermissions: Record<string, string[]> = {
  passenger: [
    "View flights, bookings & baggage",
    "Create bookings",
  ],
  staff: [
    "All passenger permissions",
    "Cancel bookings",
    "Update baggage status & location",
  ],
  admin: [
    "All staff permissions",
    "List system users",
    "Unrestricted access across all services",
  ],
};

export function ProfilePage() {
  const { token } = useAuth();
  const claims = token ? decodeJwt(token) : null;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: authService.me,
  });

  if (isLoading) return <LoadingState label="Loading profile…" />;
  if (isError || !data)
    return (
      <ErrorState
        message={
          error instanceof ApiError ? error.message : "Failed to load profile."
        }
        onRetry={() => refetch()}
      />
    );

  const perms = rolePermissions[data.role] ?? [];

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Identity resolved from your JWT via GET /me on the Auth Service."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identity card */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Avatar className="h-20 w-20 text-xl">
              <AvatarFallback>{initials(data.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-bold">{data.full_name}</h3>
              <p className="text-sm text-muted-foreground">@{data.username}</p>
            </div>
            <RoleBadge role={data.role} />
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>
              Profile attributes from the auth user store.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <DetailRow icon={User} label="Username" value={data.username} />
            <Separator />
            <DetailRow icon={BadgeCheck} label="Full Name" value={data.full_name} />
            <Separator />
            <DetailRow icon={Mail} label="Email" value={data.email} />
            <Separator />
            <DetailRow
              icon={ShieldCheck}
              label="Role"
              value={<RoleBadge role={data.role} />}
            />
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
            <CardDescription>
              Capabilities granted to the{" "}
              <span className="capitalize text-foreground">{data.role}</span>{" "}
              role across the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {perms.map((p) => (
              <div key={p} className="flex items-center gap-2 text-sm">
                <BadgeCheck className="h-4 w-4 shrink-0 text-success" />
                {p}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* JWT session */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Session Token
            </CardTitle>
            <CardDescription>Decoded JWT claims (HS256)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subject</span>
              <span className="font-mono">{claims?.sub ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-mono">{claims?.role ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Expires
              </span>
              <span className="text-right font-mono text-xs">
                {claims?.exp
                  ? formatDateTime(new Date(claims.exp * 1000).toISOString())
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
