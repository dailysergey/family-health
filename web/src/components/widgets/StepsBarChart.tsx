"use client";

const DEFAULT_GOAL = 10_000;

interface StepsDay {
  date: string;
  steps: number;
  goal?: number;
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
}

export function StepsBarChart({ data, goal = DEFAULT_GOAL }: { data: StepsDay[]; goal?: number }) {
  if (!data.length) return null;

  const max = Math.max(...data.map((d) => d.steps), goal);
  const BAR_H = 80;

  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-5">
      <div className="text-callout font-semibold text-text-primary mb-3">Шаги за 7 дней</div>
      <div className="flex items-end justify-between gap-1.5" style={{ height: BAR_H }}>
        {data.map((d) => {
          const pct = Math.min(d.steps / max, 1);
          const reached = d.steps >= (d.goal ?? goal);
          return (
            <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
              <div className="w-full flex flex-col justify-end" style={{ height: BAR_H - 16 }}>
                <div
                  className="w-full rounded-t-[4px] transition-all duration-500"
                  style={{
                    height: `${Math.max(pct * 100, 4)}%`,
                    background: reached
                      ? "var(--color-status-normal)"
                      : "var(--color-fill-quaternary)",
                  }}
                />
              </div>
              <span className="text-caption-2 text-text-tertiary">{shortDate(d.date)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-caption-1 text-text-tertiary">
          Цель {(goal / 1000).toFixed(0)}k шагов
        </span>
      </div>
    </div>
  );
}
