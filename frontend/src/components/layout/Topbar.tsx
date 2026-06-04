import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/common/RoleBadge";
import { SessionIndicator } from "./SessionIndicator";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/utils";
import { navItems } from "./navItems";

function pageTitle(pathname: string): string {
  const match = navItems.find((n) => pathname.startsWith(n.to));
  return match?.label ?? "Dashboard";
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <button
        className="rounded-md p-2 text-muted-foreground hover:bg-secondary lg:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">
          {pageTitle(location.pathname)}
        </h1>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Distributed Airline Management System
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SessionIndicator />
        {role && <div className="hidden sm:block"><RoleBadge role={role} /></div>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full border border-border bg-card/60 p-1 pr-2 transition-colors hover:bg-secondary/70">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {initials(user?.full_name ?? user?.username)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  {user?.full_name ?? user?.username ?? "Account"}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email ?? ""}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
