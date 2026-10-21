// Small Organic building blocks shared by the dashboard sections.
import type { CSSProperties, ReactNode } from "react";

/** Ask the chat assistant from anywhere on the page (ChatPanel listens). */
export const ASK_EVENT = "health:ask";

export function askAssistant(text: string) {
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: text }));
}

export function Section({
  id,
  title,
  caption,
  aside,
  children,
}: {
  id: string;
  title: string;
  caption?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-6">
      <div className="flex items-baseline gap-3 flex-wrap justify-between">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="o-h2">{title}</h2>
          {caption && <span className="text-[13px] text-muted">{caption}</span>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Card({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={`o-card flex flex-col ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Seg<K extends string | number>({
  options,
  value,
  onChange,
}: {
  options: [K, string][];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map(([k, label]) => (
        <button key={String(k)} type="button" className="seg-opt" aria-pressed={k === value} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function LegendDot({ color, children, ring }: { color: string; children: ReactNode; ring?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <i
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={ring ? { border: `2px solid ${color}` } : { background: color }}
      />
      {children}
    </span>
  );
}

/** Dashed empty state with an icon bubble and an action. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  dashed,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
  dashed?: boolean;
}) {
  return (
    <div
      className={`rounded-[28px] p-7 sm:p-8 flex items-center gap-6 flex-wrap ${dashed ? "" : "bg-[var(--color-neutral-100)]"}`}
      style={dashed ? { border: "2px dashed var(--color-neutral-400)" } : undefined}
    >
      <div
        className="w-[72px] h-[72px] rounded-full grid place-items-center shrink-0"
        style={{ background: "var(--color-accent-200)", color: "var(--color-accent-800)" }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
        <span className="font-semibold text-base">{title}</span>
        <span className="text-sm text-muted">{text}</span>
      </div>
      {action}
    </div>
  );
}

/** Mini bar chart (last N days) used by the «Сегодня» cards. */
export function Bars({
  bars,
  overlay,
  gap = 3,
  height = 64,
}: {
  bars: { h: number; color: string; title?: string }[];
  overlay?: ReactNode;
  gap?: number;
  height?: number;
}) {
  return (
    <div className="relative flex items-end" style={{ height, gap }}>
      {overlay}
      {bars.map((b, i) => (
        <div
          key={i}
          title={b.title}
          className="relative flex-1"
          style={{ height: `${Math.max(2, b.h)}%`, background: b.color, borderRadius: "6px 6px 3px 3px" }}
        />
      ))}
    </div>
  );
}
