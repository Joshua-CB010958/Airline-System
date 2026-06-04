import {
  LayoutDashboard,
  Plane,
  Ticket,
  Luggage,
  ShieldCheck,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Roles permitted to see this item. Undefined = all authenticated roles. */
  allow?: Role[];
}

export const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Flights", to: "/flights", icon: Plane },
  { label: "Bookings", to: "/bookings", icon: Ticket },
  { label: "Baggage", to: "/baggage", icon: Luggage },
  { label: "Admin", to: "/admin", icon: ShieldCheck, allow: ["admin"] },
  { label: "Profile", to: "/profile", icon: UserCircle },
];
