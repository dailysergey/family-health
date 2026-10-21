"use client";

import { useEffect, useState } from "react";
import { Bars, Section } from "./primitives";

interface MealItem {
  name: string;
  kcal: number;
}
interface MealEntry {
  name: string;
  time?: string;
  items: MealItem[];
}
interface MealDay {
  date: string;
  meals: MealEntry[];
  totals: { kcal: number; protein_g: number; fat_g: number; carbs_g: number };
}
interface Goals {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

const num = (n: number) => Math.round(n).toLocaleString("ru-RU");
const localISO = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const weekday = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { weekday: "short" });
const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function NutritionSection({ memberId }: { memberId: string }) {
  const [days, setDays] = useState<MealDay[] | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);

  useEffect(() => {
    let cancel = false;
    setDays(null);
    fetch(`/api/meals?member=${encodeURIComponent(memberId)}&days=7`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancel) return;
        setDays(((d?.days as MealDay[]) ?? []).filter((x) => x.meals?.length));
        setGoals((d?.goals as Goals) ?? null);
      })
      .catch(() => !cancel && setDays([]));
    return () => {
      cancel = true;
    };
  }, [memberId]);

  if (days && days.length === 0) {
    return (
      <Section id="meals" title="Питание" caption="из фото в Telegram">
        <div className="o-card px-8 py-7 flex items-center gap-5 flex-wrap">
          <span className="text-[15px] flex-1 min-w-[220px]">
            Записей пока нет — отправьте фото еды боту, и калории с БЖУ появятся здесь.
          </span>
        </div>
      </Section>
    );
  }
  if (!days) {
    return (
      <Section id="meals" title="Питание" caption="из фото в Telegram">
        <div className="o-card p-6 text-sm text-muted">Загружаю дневник питания…</div>
      </Section>
    );
  }

  const last = days[days.length - 1];
  const isToday = last.date === localISO();
  const kcalGoal = goals?.kcal ?? null;
  const left = kcalGoal != null ? kcalGoal - last.totals.kcal : null;
  const macros = [
    { label: "Белки", v: last.totals.protein_g, t: goals?.protein_g, c: "var(--color-accent-2-600)" },
    { label: "Жиры", v: last.totals.fat_g, t: goals?.fat_g, c: "var(--color-accent-400)" },
    { label: "Углеводы", v: last.totals.carbs_g, t: goals?.carbs_g, c: "var(--color-accent-2-400)" },
  ];
  const maxK = Math.max(kcalGoal ?? 0, ...days.map((d) => d.totals.kcal)) * 1.15 || 1;

  return (
    <Section
      id="meals"
      title="Питание"
      caption={isToday ? "из фото в Telegram" : `из фото в Telegram · последняя запись ${dayMonth(last.date)}`}
    >
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
        <div className="o-card p-6 flex flex-col gap-[18px]">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="font-heading text-[40px] leading-none">{num(last.totals.kcal)}</span>
            <span className="text-sm text-muted">
              {kcalGoal != null
                ? `из ${num(kcalGoal)} ккал · ${left! >= 0 ? `осталось ${num(left!)}` : `сверх на ${num(-left!)}`}`
                : "ккал"}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {macros.map((m) => (
              <div key={m.label} className="grid grid-cols-[80px_minmax(0,1fr)_96px] gap-3 items-center text-[13px]">
                <span className="font-semibold">{m.label}</span>
                <span className="h-3 rounded-full overflow-hidden block" style={{ background: "var(--color-neutral-300)" }}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${m.t ? Math.min(100, (m.v / m.t) * 100) : 0}%`, background: m.c }}
                  />
                </span>
                <span className="text-right" style={{ color: "var(--color-neutral-800)" }}>
                  {Math.round(m.v)}
                  {m.t ? ` / ${m.t}` : ""} г
                </span>
              </div>
            ))}
          </div>
          {days.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">Калории по дням{kcalGoal != null ? " · линия — цель" : ""}</span>
              <Bars
                height={70}
                gap={8}
                bars={days.map((d, i) => ({
                  h: (d.totals.kcal / maxK) * 100,
                  title: `${num(d.totals.kcal)} ккал`,
                  color:
                    i === days.length - 1
                      ? "var(--color-accent)"
                      : kcalGoal != null && d.totals.kcal > kcalGoal
                        ? "var(--color-accent-300)"
                        : "var(--color-neutral-400)",
                }))}
                overlay={
                  kcalGoal != null && (
                    <div
                      className="absolute inset-x-0 z-[1] pointer-events-none"
                      style={{ bottom: `${(kcalGoal / maxK) * 100}%`, borderTop: "2px dashed var(--color-neutral-500)" }}
                    />
                  )
                }
              />
              <div className="flex gap-2">
                {days.map((d) => (
                  <span key={d.date} className="flex-1 text-center text-[11px] text-muted">
                    {weekday(d.date)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="o-card px-[22px] py-5 flex flex-col gap-1">
          <span className="font-semibold text-sm pb-2">{isToday ? "Сегодня съедено" : `Съедено ${dayMonth(last.date)}`}</span>
          {last.meals.map((m, i) => (
            <div key={i} className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-3 items-center py-[9px]">
              <span className="text-xs text-muted">{m.time ?? ""}</span>
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-semibold">{m.name}</span>
                <span className="text-xs text-muted truncate">{m.items.map((it) => it.name).join(", ")}</span>
              </span>
              <span className="text-[13px] font-semibold">{num(m.items.reduce((a, it) => a + (it.kcal ?? 0), 0))}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
