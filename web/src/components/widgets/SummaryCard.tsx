"use client";

import type { LabStatus } from "@/lib/types";
import { statusVar } from "@/lib/ui";
import { StatusPill } from "@/components/ui/StatusPill";

export interface SummaryCardProps {
  title: string;
  status?: LabStatus;
  items: { label: string; value: string; status?: LabStatus }[];
  note?: string;
}

export function SummaryCard({ title, status, items, note }: SummaryCardProps) {
  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-title-3 text-text-primary">{title}</div>
        {status && <StatusPill status={status} />}
      </div>
      <div className="mt-3 divide-y divide-separator">
        {(Array.isArray(items) ? items : []).map((it, i) => (
          <div key={i} className="flex items-center justify-between py-2 first:pt-0">
            <span className="text-callout text-text-secondary">{it.label}</span>
            <span
              className="text-callout font-semibold tabular"
              style={{ color: it.status ? statusVar(it.status) : "var(--color-text-primary)" }}
            >
              {it.value}
            </span>
          </div>
        ))}
      </div>
      {note && <p className="text-footnote text-text-tertiary mt-3">{note}</p>}
    </div>
  );
}
