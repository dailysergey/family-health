// Derived view of lab results for the Organic dashboard: status buckets,
// previous value, trend vs. reference range and a shared value scale for the
// range bars and the detail chart. Pure helpers, no React.
import type { LabResult } from "./types";

export type LabBucket = "ok" | "border" | "out";

export interface LabView {
  lab: LabResult;
  numeric: boolean;
  value: number | null;
  prev: number | null;
  bucket: LabBucket;
  /** Reference bounds used for drawing; one side may be open. */
  lo: number | null;
  hi: number | null;
  /** Moved away from the reference range since the previous result. */
  worse: boolean;
  /** Moved towards / into the reference range. */
  better: boolean;
  deltaPct: number | null;
  /** Chronological points (history + current), deduplicated by date. */
  series: { date: string; value: number }[];
  /** Map a value to 0–100 % of the drawing scale. */
  pct: (v: number) => number;
}

export function bucketOf(status: LabResult["status"]): LabBucket {
  if (status === "normal") return "ok";
  if (status === "borderline") return "border";
  return "out";
}

/** Distance from the reference range (0 inside it). */
function distance(v: number, lo: number | null, hi: number | null): number {
  if (lo != null && v < lo) return lo - v;
  if (hi != null && v > hi) return v - hi;
  return 0;
}

export function analyzeLab(lab: LabResult): LabView {
  const numeric = typeof lab.value === "number" && Number.isFinite(lab.value);
  const value = numeric ? (lab.value as number) : null;
  const lo = typeof lab.refLow === "number" ? lab.refLow : null;
  const hi = typeof lab.refHigh === "number" ? lab.refHigh : null;

  const byDate = new Map<string, number>();
  for (const h of lab.history ?? []) {
    if (typeof h?.value === "number" && Number.isFinite(h.value) && h.date) byDate.set(h.date.slice(0, 10), h.value);
  }
  if (value != null && lab.date) byDate.set(lab.date.slice(0, 10), value);
  const series = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, value: v }));

  const prev = value != null && series.length >= 2 ? series[series.length - 2].value : null;

  let worse = false;
  let better = false;
  if (value != null && prev != null) {
    const dNow = distance(value, lo, hi);
    const dPrev = distance(prev, lo, hi);
    worse = dNow > dPrev;
    better = dNow < dPrev;
  }
  const deltaPct = value != null && prev != null && prev !== 0 ? Math.round(((value - prev) / Math.abs(prev)) * 100) : null;

  const vals = series.map((p) => p.value);
  const candidates = [...vals, ...(lo != null ? [lo] : []), ...(hi != null ? [hi] : [])];
  const minV = candidates.length ? Math.min(...candidates) : 0;
  const maxV = candidates.length ? Math.max(...candidates) : 1;
  const span = maxV - minV || Math.abs(maxV) || 1;
  const dmin = Math.max(0, minV - span * 0.18);
  const dmax = maxV + span * 0.18;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - dmin) / (dmax - dmin)) * 100));

  return { lab, numeric, value, prev, bucket: bucketOf(lab.status), lo, hi, worse, better, deltaPct, series, pct };
}

export const BUCKET_STYLE: Record<
  LabBucket,
  { label: string; dot: string; valueColor: string; tag: string }
> = {
  out: { label: "вне нормы", dot: "var(--color-accent-700)", valueColor: "var(--color-accent-800)", tag: "tag tag-accent-strong" },
  border: { label: "на границе", dot: "var(--color-accent-400)", valueColor: "var(--color-text)", tag: "tag tag-accent" },
  ok: { label: "норма", dot: "var(--color-accent-2-600)", valueColor: "var(--color-text)", tag: "tag tag-accent-2" },
};

/** «12.09.2026» */
export function dmy(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** «сен 26» */
export function monYY(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
  return `${m} ${String(d.getFullYear()).slice(2)}`;
}

/** Decimal comma for display. */
export function fmt(v: number | string | null | undefined): string {
  if (v == null) return "";
  if (typeof v !== "number") return String(v);
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
  return String(r).replace(".", ",");
}

export function refLabel(v: LabView): string {
  if (v.lo != null && v.hi != null) return `${fmt(v.lo)}–${fmt(v.hi)}`;
  if (v.lo != null) return `> ${fmt(v.lo)}`;
  if (v.hi != null) return `< ${fmt(v.hi)}`;
  return v.lab.refText ?? "—";
}
