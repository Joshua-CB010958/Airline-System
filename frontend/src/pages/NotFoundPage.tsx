import { Link } from "react-router-dom";
import { PlaneTakeoff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <PlaneTakeoff className="h-8 w-8" />
        </div>
        <div>
          <p className="text-5xl font-black tracking-tight">404</p>
          <p className="mt-2 text-muted-foreground">
            This route never made it to the gate.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
