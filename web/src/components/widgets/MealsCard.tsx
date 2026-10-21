"use client";

import { useEffect, useState } from "react";

interface MealItem {
  name: string;
  grams?: number;
  kcal: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
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

interface NutritionGoals {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0);
  const over = value > max;
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-fill-tertiary)" }}>
      <div
        style={{
          width: `${pct}%`,
          background: over ? "var(--color-status-high)" : color,
          height: "100%",
          borderRadius: "inherit",
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

function MacroRow({
  label,
  eaten,
  goal,
  color,
}: {
  label: string;
  eaten: number;
  goal: number;
  color: string;
}) {
  const left = Math.max(0, goal - eaten);
  const over = eaten > goal;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-footnote">
        <span className="text-text-secondary">{label}</span>
        <span className="tabular" style={{ color: over ? "var(--color-status-high)" : "var(--color-text-primary)" }}>
          {Math.round(eaten)}г
          <span className="text-text-tertiary"> / {goal}г</span>
          {over ? (
            <span style={{ color: "var(--color-status-high)" }}> +{Math.round(eaten - goal)}</span>
          ) : (
            <span className="text-text-tertiary"> (ещё {left}г)</span>
          )}
        </span>
      </div>
      <ProgressBar value={eaten} max={goal} color={color} />
    </div>
  );
}

export function MealsCard({ memberId }: { memberId: string }) {
  const [days, setDays] = useState<MealDay[]>([]);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/meals?member=${memberId}&days=3`)
      .then((r) => r.json())
      .then((d) => {
        setDays(d.days ?? []);
        setGoals(d.goals ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [memberId]);

  if (loading) {
    return <div className="bg-bg-secondary rounded-card shadow-card p-5 animate-pulse h-32" />;
  }

  const today = days.length ? days[days.length - 1] : null;
  const todayTotals = today?.totals ?? { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };

  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-5 space-y-5">
      {/* Калории: факт vs норма */}
      {goals && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-subheadline text-text-secondary">Сегодня</span>
            <div className="text-right">
              <span className="text-title-2 tabular font-semibold text-text-primary">
                {Math.round(todayTotals.kcal)}
              </span>
              <span className="text-callout text-text-secondary"> / {goals.kcal} ккал</span>
            </div>
          </div>
          <ProgressBar
            value={todayTotals.kcal}
            max={goals.kcal}
            color="var(--accent)"
          />
          <div className="mt-1 text-footnote text-text-tertiary text-right">
            {todayTotals.kcal < goals.kcal
              ? `осталось ${Math.round(goals.kcal - todayTotals.kcal)} ккал`
              : `превышение на ${Math.round(todayTotals.kcal - goals.kcal)} ккал`}
          </div>
        </div>
      )}

      {/* Макронутриенты */}
      {goals && (
        <div className="space-y-3">
          <MacroRow
            label="Белки"
            eaten={todayTotals.protein_g}
            goal={goals.protein_g}
            color="var(--color-status-normal)"
          />
          <MacroRow
            label="Жиры"
            eaten={todayTotals.fat_g}
            goal={goals.fat_g}
            color="var(--color-status-elevated)"
          />
          <MacroRow
            label="Углеводы"
            eaten={todayTotals.carbs_g}
            goal={goals.carbs_g}
            color="var(--color-brand)"
          />
        </div>
      )}

      {/* Список приёмов пищи */}
      {today && today.meals.length > 0 ? (
        <div className="space-y-1.5 pt-1 border-t border-separator">
          {today.meals.map((meal, i) => {
            const kcal = meal.items.reduce((s, it) => s + (it.kcal ?? 0), 0);
            const itemNames = meal.items.map((it) => it.name).join(", ");
            return (
              <div key={i} className="flex justify-between text-callout">
                <span className="text-text-primary truncate flex-1 mr-2">
                  {meal.time && <span className="text-text-secondary mr-2">{meal.time}</span>}
                  <span className="font-medium">{meal.name}</span>
                  {itemNames && <span className="text-text-secondary"> — {itemNames}</span>}
                </span>
                <span className="text-text-secondary tabular shrink-0">{Math.round(kcal)} ккал</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-callout text-text-tertiary pt-1 border-t border-separator">
          Записей за сегодня нет — отправь фото еды в Telegram
        </p>
      )}

      {/* История */}
      {days.length > 1 && (
        <div className="border-t border-separator pt-3 space-y-1">
          {days.slice(0, -1).reverse().map((d) => (
            <div key={d.date} className="flex justify-between text-footnote text-text-secondary">
              <span>{d.date.slice(5).replace("-", ".")}</span>
              <span className="tabular">{Math.round(d.totals.kcal)} ккал</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
