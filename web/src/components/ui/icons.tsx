"use client";

import {
  Activity,
  Apple,
  Bone,
  Brain,
  Droplet,
  FlaskConical,
  Heart,
  Moon,
  Pill,
  Scale,
  Stethoscope,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Accent } from "@/lib/types";

const ICONS: Record<Accent, LucideIcon> = {
  activity: Activity,
  heart: Heart,
  mindfulness: Wind,
  nutrition: Apple,
  sleep: Moon,
  medications: Pill,
  body: Scale,
  labs: FlaskConical,
  reproductive: Droplet,
  hearing: Brain,
};

export function categoryIcon(accent: Accent | string | undefined): LucideIcon {
  return ICONS[(accent as Accent) ?? "labs"] ?? FlaskConical;
}

export { Bone, Stethoscope };
