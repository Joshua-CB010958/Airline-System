import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plane } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import type { Flight } from "@/types";

function colorFor(status: string): string {
  const s = status.toLowerCase();
  if (s === "on time") return "hsl(152 62% 42%)";
  if (["delayed", "boarding"].includes(s)) return "hsl(38 92% 50%)";
  if (["cancelled", "canceled", "diverted"].includes(s))
    return "hsl(0 72% 51%)";
  return "hsl(205 90% 54%)";
}

export function FlightStatusChart({
  flights,
  loading,
}: {
  flights?: Flight[];
  loading?: boolean;
}) {
  const data = useMemo(() => {
    if (!flights) return [];
    const counts = new Map<string, number>();
    for (const f of flights) {
      counts.set(f.status, (counts.get(f.status) ?? 0) + 1);
    }
    return Array.from(counts, ([status, count]) => ({ status, count }));
  }, [flights]);

  if (loading) return <Skeleton className="h-[240px] w-full" />;
  if (data.length === 0)
    return (
      <EmptyState
        icon={Plane}
        title="No flight data"
        description="The flight inventory is empty."
        className="py-10"
      />
    );

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(217 33% 20%)"
          vertical={false}
        />
        <XAxis
          dataKey="status"
          tick={{ fill: "hsl(215 20% 65%)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "hsl(217 33% 20%)" }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "hsl(215 20% 65%)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(217 33% 18% / 0.5)" }}
          contentStyle={{
            background: "hsl(220 43% 11%)",
            border: "1px solid hsl(217 33% 20%)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number) => [`${value} flights`, "Count"]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={colorFor(entry.status)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
