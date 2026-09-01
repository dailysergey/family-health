"use client";

import { useEffect, useState } from "react";
import { TrendChartCard } from "@/components/widgets/TrendChartCard";
import { StepsBarChart } from "@/components/widgets/StepsBarChart";
import { fmtNum } from "@/lib/ui";

interface WearablesDaily {
  date: string;
  steps?: number;
  stepsGoal?: number;
  activeZoneMinutes?: number;
  vo2max?: number;
  activeEnergyKcal?: number;
}

interface WearablesResponse {
  member: { id: string; name: string; wearables: { enabled: boolean } | null };
  daily: WearablesDaily[];
}

function StatTile({ label, value, unit, caption }: { label: string; value: string; unit?: string; caption?: string }) {
  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-5 flex flex-col justify-between min-h-[96px]">
      <div className="text-callout text-text-secondary">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="text-title-2 tabular text-text-primary">{value}</span>
        {unit && <span className="text-subheadline text-text-tertiary">{unit}</span>}
      </div>
      {caption && <div className="text-caption-1 text-text-tertiary mt-1">{caption}</div>}
    </div>
  );
}

export function FitnessSection({ memberId }: { memberId: string }) {
  const [data, setData] = useState<WearablesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/wearables?member=${encodeURIComponent(memberId)}&days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancel) setData(j); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [memberId]);

  if (loading) return <div className="text-callout text-text-tertiary">Загружаю данные…</div>;
  if (!data?.daily?.length) return null;

  const daily = data.daily;
  const last7 = daily.slice(-7);

  // Streak: дней подряд с последнего где выполнена цель шагов
  let streak = 0;
  const reversed = [...last7].reverse();
  for (const d of reversed) {
    const goal = d.stepsGoal ?? 10_000;
    if ((d.steps ?? 0) >= goal) streak++;
    else break;
  }

  // Серии для графиков
  const vo2Series = daily
    .filter((d) => d.vo2max != null)
    .map((d) => ({ date: d.date, value: d.vo2max! }));
  const azmSeries = daily
    .filter((d) => d.activeZoneMinutes != null)
    .map((d) => ({ date: d.date, value: d.activeZoneMinutes! }));

  const stepsData7 = last7.map((d) => ({
    date: d.date,
    steps: d.steps ?? 0,
    goal: d.stepsGoal,
  }));

  // Недельные ккал
  const weekKcal = last7.reduce((sum, d) => sum + (d.activeEnergyKcal ?? 0), 0);
  const latestVo2 = vo2Series.length ? vo2Series[vo2Series.length - 1].value : null;

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {latestVo2 != null && (
          <StatTile
            label="VO₂max"
            value={latestVo2.toFixed(1)}
            unit="мл/кг/мин"
            caption="аэробная форма"
          />
        )}
        {weekKcal > 0 && (
          <StatTile
            label="Калории за неделю"
            value={fmtNum(Math.round(weekKcal))}
            unit="kcal"
          />
        )}
        <StatTile
          label="Streak шагов"
          value={String(streak)}
          unit={streak === 1 ? "день" : streak < 5 ? "дня" : "дней"}
          caption="дней цель достигнута"
        />
      </div>

      {/* Steps bar chart */}
      {stepsData7.length > 0 && (
        <StepsBarChart data={stepsData7} />
      )}

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {azmSeries.length >= 2 && (
          <TrendChartCard
            title="Активные минуты"
            unit="мин"
            category="activity"
            data={azmSeries}
          />
        )}
        {vo2Series.length >= 2 && (
          <TrendChartCard
            title="VO₂max"
            unit="мл/кг/мин"
            category="mindfulness"
            data={vo2Series}
          />
        )}
      </div>
    </div>
  );
}
