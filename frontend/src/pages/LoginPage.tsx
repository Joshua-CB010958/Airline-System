import { useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import {
  Plane,
  Lock,
  User,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Server,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/apiClients";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface DemoAccount {
  role: Role;
  username: string;
  password: string;
  label: string;
  blurb: string;
}

const demoAccounts: DemoAccount[] = [
  {
    role: "passenger",
    username: "passenger1",
    password: "password123",
    label: "Passenger",
    blurb: "View flights, bookings & baggage; create bookings",
  },
  {
    role: "staff",
    username: "staff1",
    password: "password123",
    label: "Staff",
    blurb: "Passenger access + cancel bookings & update baggage",
  },
  {
    role: "admin",
    username: "admin1",
    password: "password123",
    label: "Admin",
    blurb: "Unrestricted access across all services",
  },
];

const roleAccent: Record<Role, string> = {
  passenger: "hover:border-primary/50",
  staff: "hover:border-warning/50",
  admin: "hover:border-destructive/50",
};

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function submit(uname: string, pword: string) {
    setSubmitting(true);
    try {
      await login(uname, pword);
      toast.success("Authenticated", {
        description: `Signed in as ${uname}. JWT issued by Auth Service.`,
      });
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to reach the Auth Service.";
      toast.error("Sign-in failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    submit(username, password);
  }

  function quickFill(acc: DemoAccount) {
    setUsername(acc.username);
    setPassword(acc.password);
    submit(acc.username, acc.password);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute inset-0 bg-radial-glow" aria-hidden />

      <div className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-2">
        {/* Left — brand / system panel */}
        <div className="hidden flex-col justify-between rounded-2xl border border-border bg-card/40 p-8 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Plane className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">DAMS</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Operations Console
                </p>
              </div>
            </div>
            <h1 className="mt-10 text-3xl font-bold leading-tight text-balance">
              Distributed Airline Management System
            </h1>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              A cloud-native microservices platform — JWT-secured, role-aware,
              and event-driven across five independent services.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {[
              { icon: ShieldCheck, text: "Stateless JWT auth · HS256 · RBAC at every boundary" },
              { icon: Server, text: "Auth · Flight · Booking · Baggage microservices" },
              { icon: Radio, text: "SNS → Lambda event-driven notifications" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/70 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Right — login form */}
        <Card className="border-border/80 bg-card/70 p-7 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold tracking-tight">DAMS</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Operations Console
              </p>
            </div>
          </div>

          <h2 className="text-xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Authenticate against the Auth Service to receive a JWT.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  autoComplete="username"
                  className="pl-9"
                  placeholder="passenger1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !username || !password}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Authenticating…
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Demo accounts · one-click
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  disabled={submitting}
                  onClick={() => quickFill(acc)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-border bg-background/40 p-2.5 text-left transition-colors disabled:opacity-60",
                    roleAccent[acc.role]
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary/70 text-xs font-bold uppercase">
                    {acc.label[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {acc.label}{" "}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {acc.username}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {acc.blurb}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              All demo accounts use password{" "}
              <span className="font-mono">password123</span>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
