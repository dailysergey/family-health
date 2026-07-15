"use client";

import { useEffect, useState } from "react";
import type { Accent } from "@/lib/types";
import { accentVar } from "@/lib/ui";

export interface MetricRingProps {
  label: string;
  value: number | string;
  unit?: string;
  percent: number; // 0–100
  category?: Accent;
  caption?: string;
  size?: number;
}

export function MetricRing({ label, value, unit, percent, category, caption, size = 120 }: MetricRingProps) {
  const stroke = size >= 100 ? 12 : 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const color = accentVar(category);

  // Animate from empty to target on mount.
  const [offset, setOffset] = useState(c);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(c - (clamped / 100) * c));
    return () => cancelAnimationFrame(id);
  }, [c, clamped]);

  return (
    <div className="flex flex-col items-center gap-3 bg-bg-secondary rounded-card shadow-card p-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-fill-quaternary)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.34,1.56,0.64,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-large-title tabular text-text-primary leading-none">{value}</span>
          {unit && <span className="text-caption-1 text-text-tertiary mt-1">{unit}</span>}
        </div>
      </div>
      <div className="text-center">
        <div className="text-callout text-text-secondary">{label}</div>
        {caption && <div className="text-caption-1 text-text-tertiary mt-0.5">{caption}</div>}
      </div>
    </div>
  );
}
