"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ProgressionChart({
  data,
  labelA,
  labelB,
  unit,
}: {
  data: { date: string; a: number | null; b: number | null }[];
  labelA: string;
  labelB?: string | null;
  unit: string;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-muted">
        Pas encore assez de données.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--surface-border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            unit={unit}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--surface-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="a"
            name={labelA}
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          {labelB ? (
            <Line
              type="monotone"
              dataKey="b"
              name={labelB}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
