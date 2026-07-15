"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Accent, LabStatus } from "@/lib/types";
import { accentVar, fmtNum, formatDate, statusVar, tint } from "@/lib/ui";
import { StatusPill } from "@/components/ui/StatusPill";

export interface LabCardProps {
  name: string;
  value: number | string;
  unit: string;
  status: LabStatus;
  refLow?: number;
  refHigh?: number;
  refText?: string;
  date?: string;
  trend?: number;
  history?: { date: string; value: number }[];
  category?: Accent;
}

function refLabel(p: LabCardProps): string {
  if (p.refText) return `Норма: ${p.refText}`;
  if (p.refLow != null && p.refHigh != null) return `Норма: ${fmtNum(p.refLow)}–${fmtNum(p.refHigh)} ${p.unit}`;
  if (p.refHigh != null) return `Норма: < ${fmtNum(p.refHigh)} ${p.unit}`;
  if (p.refLow != null) return `Норма: > ${fmtNum(p.refLow)} ${p.unit}`;
  return "";
}

export function LabCard(p: LabCardProps) {
  const [open, setOpen] = useState(false);
  const color = statusVar(p.status);
  const accent = accentVar(p.category);
  const history = p.history ?? [];
  const hasChart = history.length >= 2;
  const TrendIcon = p.trend == null ? Minus : p.trend > 0 ? TrendingUp : p.trend < 0 ? TrendingDown : Minus;
  // Качественный (нечисловой) результат: длинный текст рендерим компактнее, без огромного title.
  const qualitative = typeof p.value === "string" && Number.isNaN(Number(String(p.value).replace(",", ".")));

  return (
    <div
      className="relative bg-bg-secondary rounded-card shadow-card p-4 pl-5 overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-0.5"
      style={hasChart ? { cursor: "pointer" } : undefined}
      onClick={hasChart ? () => setOpen((v) => !v) : undefined}
    >
      <span className="absolute left-0 inset-y-0 w-1 rounded-l-card" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-headline text-text-primary truncate">{p.name}</div>
          {refLabel(p) && <div className="text-caption-1 text-text-tertiary mt-0.5">{refLabel(p)}</div>}
          {p.date && <div className="text-caption-1 text-text-quaternary mt-0.5">{formatDate(p.date)}</div>}
        </div>
        <div className="flex flex-col items-end shrink-0 max-w-[55%]">
          <div className="flex items-baseline gap-1 flex-wrap justify-end">
            <span
              className={`tabular text-right ${qualitative ? "text-subheadline font-semibold" : "text-title-2"}`}
              style={{ color }}
            >
              {fmtNum(p.value)}
            </span>
            {p.unit && <span className="text-subheadline text-text-tertiary">{p.unit}</span>}
          </div>
          <div className="mt-1">
            <StatusPill status={p.status} dot />
          </div>
          {p.trend != null && (
            <div className="flex items-center gap-1 mt-1 text-caption-1" style={{ color: tint(color, 80) }}>
              <TrendIcon size={13} />
              <span className="tabular">
                {p.trend > 0 ? "+" : ""}
                {fmtNum(p.trend)}
              </span>
            </div>
          )}
        </div>
      </div>

      {open && hasChart && (
        <div className="h-16 mt-3 -mx-1 animate-fade-in">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id={`lg-${p.name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  boxShadow: "var(--shadow-modal)",
                  background: "var(--color-bg-elevated)",
                  fontSize: 12,
                }}
                labelFormatter={(l) => formatDate(String(l))}
                formatter={(v) => [`${fmtNum(Number(v))} ${p.unit}`, ""] as [string, string]}
              />
              <Area type="monotone" dataKey="value" stroke={accent} strokeWidth={2.5} fill={`url(#lg-${p.name})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
