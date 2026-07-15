// Pure presentation helpers shared by client components. No React, no Node.
import type { Accent, LabResult, LabStatus } from "./types";

// Canonical display order of lab panels. Groups not listed here are appended
// alphabetically; ungrouped results fall into «Прочие показатели» (always last).
export const LAB_GROUP_ORDER = [
  "Общий анализ крови",
  "Биохимия крови",
  "Липидный профиль",
  "Углеводный обмен",
  "Гормоны",
  "Витамины и микроэлементы",
  "Воспаление и обмен",
  "Почки и моча",
  "Обследования",
] as const;

const UNGROUPED = "Прочие показатели";

/** Bucket labs by their `group`, returned in canonical display order. */
export function groupLabs(labs: LabResult[]): { title: string; labs: LabResult[] }[] {
  const buckets = new Map<string, LabResult[]>();
  for (const lab of labs) {
    const key = lab.group?.trim() || UNGROUPED;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(lab);
  }
  const rank = (name: string) => {
    if (name === UNGROUPED) return Number.MAX_SAFE_INTEGER;
    const i = LAB_GROUP_ORDER.indexOf(name as (typeof LAB_GROUP_ORDER)[number]);
    return i === -1 ? LAB_GROUP_ORDER.length : i;
  };
  return Array.from(buckets.entries())
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "ru"))
    .map(([title, list]) => ({ title, labs: list }));
}

export const STATUS_LABEL: Record<LabStatus, string> = {
  normal: "Норма",
  high: "Выше нормы",
  low: "Ниже нормы",
  borderline: "Погранично",
  critical: "Критично",
};

export const DIAGNOSIS_STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  remission: "Ремиссия",
  resolved: "Разрешён",
};

/** CSS var expression for a health domain accent color. */
export function accentVar(accent: Accent | string | undefined): string {
  return `var(--color-${accent ?? "labs"})`;
}

export function statusVar(status: LabStatus | string): string {
  return `var(--color-status-${status})`;
}

/** A translucent tint of a CSS color, used for badge/lozenge backgrounds. */
export function tint(colorExpr: string, percent = 12): string {
  return `color-mix(in srgb, ${colorExpr} ${percent}%, transparent)`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return chars.join("");
}

const MONTHS = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export function ageLabel(birthDate: string | undefined): string {
  if (!birthDate) return "";
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return `${age} ${plural(age, ["год", "года", "лет"])}`;
}

/** Format a number without trailing zeros, with tabular nums in mind.
 *  Tolerates qualitative (string) lab values like "< 0,9" or "обнаружено" — returns them as-is. */
export function fmtNum(value: number | string | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return value == null ? "" : String(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
