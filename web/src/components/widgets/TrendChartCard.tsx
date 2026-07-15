"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Accent } from "@/lib/types";
import { accentVar, fmtNum, formatDate } from "@/lib/ui";

export interface TrendChartProps {
  title: string;
  unit: string;
  category?: Accent;
  data: { date: string; value: number }[];
  currentValue?: number;
  delta?: number;
}

export function TrendChartCard({ title, unit, category, data, currentValue, delta }: TrendChartProps) {
  const color = accentVar(category);
  const series = Array.isArray(data) ? data : [];
  const last = currentValue ?? series[series.length - 1]?.value;
  const gid = `tg-${String(title ?? "").replace(/\s+/g, "")}`;

  return (
    <div className="bg-bg-secondary rounded-card shadow-card pt-5 overflow-hidden">
      <div className="flex items-start justify-between px-5">
        <div>
          <div className="text-title-3 text-text-primary">{title}</div>
          {last != null && (
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-large-title tabular text-text-primary">{fmtNum(last)}</span>
              <span className="text-subheadline text-text-tertiary">{unit}</span>
              {delta != null && (
                <span className="text-caption-1 tabular ml-1" style={{ color }}>
                  {delta > 0 ? "+" : ""}
                  {fmtNum(delta)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="h-[160px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatDate(String(d)).replace(/ \d{4}$/, "")}
              tick={{ fontSize: 11, fill: "var(--color-text-quaternary)" }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "none",
                boxShadow: "var(--shadow-modal)",
                background: "var(--color-bg-elevated)",
                fontSize: 12,
              }}
              labelFormatter={(l) => formatDate(String(l))}
              formatter={(v) => [`${fmtNum(Number(v))} ${unit}`, ""] as [string, string]}
              cursor={{ stroke: "var(--color-separator)", strokeWidth: 1 }}
            />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gid})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
