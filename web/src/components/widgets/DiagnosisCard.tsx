"use client";

import type { Accent, LabStatus } from "@/lib/types";
import { DIAGNOSIS_STATUS_LABEL, accentVar, formatDate, tint } from "@/lib/ui";
import { IconBadge } from "@/components/ui/IconBadge";
import { StatusPill } from "@/components/ui/StatusPill";

export interface DiagnosisCardProps {
  title: string;
  icd10?: string;
  status: string;
  severity: LabStatus;
  description: string;
  doctor?: string;
  date?: string;
  medications?: string[];
  category?: Accent;
}

export function DiagnosisCard(p: DiagnosisCardProps) {
  const medColor = accentVar("medications");
  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-5 transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <IconBadge accent={p.category} />
          <div className="min-w-0">
            <div className="text-headline text-text-primary">{p.title}</div>
            {p.icd10 && <div className="text-caption-1 text-text-tertiary mt-0.5">МКБ-10: {p.icd10}</div>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusPill status={p.severity} label={DIAGNOSIS_STATUS_LABEL[p.status] ?? p.status} />
          {p.date && <span className="text-caption-1 text-text-quaternary">{formatDate(p.date)}</span>}
        </div>
      </div>

      <p className="text-callout text-text-secondary mt-3">{p.description}</p>

      {p.doctor && <div className="text-subheadline text-text-tertiary mt-2">{p.doctor}</div>}

      {p.medications && p.medications.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {p.medications.map((m) => (
            <span
              key={m}
              className="text-footnote rounded-chip px-2 py-0.5"
              style={{ backgroundColor: tint(medColor, 10), color: medColor }}
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
