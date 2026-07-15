"use client";

import type { Accent } from "@/lib/types";
import { accentVar, tint } from "@/lib/ui";
import { categoryIcon } from "./icons";

export function IconBadge({
  accent,
  size = 36,
  iconSize = 20,
}: {
  accent: Accent | string | undefined;
  size?: number;
  iconSize?: number;
}) {
  const color = accentVar(accent);
  const Icon = categoryIcon(accent);
  return (
    <span
      className="inline-flex items-center justify-center rounded-inner shrink-0"
      style={{ width: size, height: size, backgroundColor: tint(color, 12) }}
    >
      <Icon size={iconSize} strokeWidth={2} style={{ color }} />
    </span>
  );
}
