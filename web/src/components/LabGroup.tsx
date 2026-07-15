"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LabResult } from "@/lib/types";
import { LabCard } from "@/components/widgets/LabCard";

// A collapsible medical-panel section of lab results.
export function LabGroup({
  title,
  labs,
  defaultOpen = true,
}: {
  title: string;
  labs: LabResult[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const attention = labs.filter((l) => l.status !== "normal").length;

  return (
    <div className="bg-bg-secondary/40 rounded-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-1.5 py-2 text-left group"
      >
        <ChevronDown
          size={18}
          className={`text-text-tertiary transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
        <span className="text-headline text-text-primary">{title}</span>
        <span className="text-caption-1 text-text-tertiary">{labs.length}</span>
        {attention > 0 && (
          <span
            className="ml-auto text-caption-1 px-2 py-0.5 rounded-full"
            style={{ color: "var(--color-status-high)", backgroundColor: "rgba(255,59,48,0.10)" }}
          >
            {attention} вне нормы
          </span>
        )}
      </button>

      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1 pb-2 animate-fade-in">
          {labs.map((l) => {
            const trend =
              typeof l.value === "number" && l.history && l.history.length >= 2
                ? l.value - l.history[l.history.length - 2].value
                : undefined;
            return <LabCard key={l.id} {...l} trend={trend} />;
          })}
        </div>
      )}
    </div>
  );
}
