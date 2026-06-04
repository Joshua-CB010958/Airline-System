import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Luggage } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { titleCase } from "@/lib/utils";
import type { Booking } from "@/types";

const COLORS: Record<string, string> = {
  economy: "hsl(205 90% 54%)",
  business: "hsl(199 89% 48%)",
  first: "hsl(152 62% 42%)",
  other: "hsl(38 92% 50%)",
};

export function SeatClassChart({
  bookings,
  loading,
}: {
  bookings?: Booking[];
  loading?: boolean;
}) {
  const data = useMemo(() => {
    if (!bookings) return [];
    const counts = new Map<string, number>();
    for (const b of bookings) {
      const key = String(b.seat_class || "other").toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts, ([name, value]) => ({ name, value }));
  }, [bookings]);

  if (loading) return <Skeleton className="h-[240px] w-full" />;
  if (data.length === 0)
    return (
      <EmptyState
        icon={Luggage}
        title="No booking data"
        description="Create bookings to populate the seat-class distribution."
        className="py-10"
      />
    );

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={3}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={COLORS[entry.name] ?? COLORS.other}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(220 43% 11%)",
            border: "1px solid hsl(217 33% 20%)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            `${value} booking${value === 1 ? "" : "s"}`,
            titleCase(name),
          ]}
        />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs text-muted-foreground">
              {titleCase(value)}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
