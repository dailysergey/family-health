import type { LabStatus } from "@/lib/types";
import { STATUS_LABEL, statusVar, tint } from "@/lib/ui";

export function StatusPill({
  status,
  label,
  dot = false,
}: {
  status: LabStatus;
  label?: string;
  dot?: boolean;
}) {
  const color = statusVar(status);
  return (
    <span
      className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-caption-1 font-medium whitespace-nowrap"
      style={{ backgroundColor: tint(color, 14), color }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
