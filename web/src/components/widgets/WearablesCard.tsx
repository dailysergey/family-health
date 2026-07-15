"use client";

import { useEffect, useState } from "react";
import { TrendChartCard } from "@/components/widgets/TrendChartCard";
import { fmtNum } from "@/lib/ui";

interface WearablesDaily {
  date: string;
  steps?: number;
  heartRateAvg?: number;
  heartRateMin?: number;
  heartRateMax?: number;
  activeEnergyKcal?: number;
  activeZoneMinutes?: number;
  sleepMinutes?: number;
  restingHeartRate?: number;
  hrvRmssd?: number;
  spo2?: number;
  vo2max?: number;
}

interface WearablesResponse {
  member: { id: string; name: string; wearables: { enabled: boolean; device?: string } | null };
  summary: {
    days: number;
    stepsAvg: number | null;
    stepsLast: number | null;
    heartRateAvg: number | null;
    activeKcalAvg: number | null;
    sleepMinutesAvg: number | null;
  };
  daily: WearablesDaily[];
}

function StatTile({ label, value, unit, caption }: { label: string; value: string; unit?: string; caption?: string }) {
  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-5 flex flex-col justify-between min-h-[104px]">
      <div className="text-callout text-text-secondary">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="text-large-title tabular text-text-primary">{value}</span>
        {unit && <span className="text-subheadline text-text-tertiary">{unit}</span>}
      </div>
      {caption && <div className="text-caption-1 text-text-tertiary mt-1">{caption}</div>}
    </div>
  );
}

export function WearablesCard({ memberId }: { memberId: string }) {
  const [data, setData] = useState<WearablesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/wearables?member=${encodeURIComponent(memberId)}&days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancel) setData(j);
      })
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [memberId]);

  if (loading) {
    return <div className="text-callout text-text-tertiary">Загружаю данные с носимого устройства…</div>;
  }
  if (!data || !data.member.wearables?.enabled) return null;
  if (data.summary.days === 0) {
    return (
      <div className="bg-bg-secondary rounded-card shadow-card p-5 text-callout text-text-secondary">
        Wearables подключены ({data.member.wearables.device ?? "устройство"}), но данных пока нет — подожди следующей синхронизации.
      </div>
    );
  }

  const stepsSeries = data.daily.filter((d) => typeof d.steps === "number").map((d) => ({ date: d.date, value: d.steps! }));
  const hrSeries = data.daily
    .filter((d) => typeof d.heartRateAvg === "number")
    .map((d) => ({ date: d.date, value: Math.round(d.heartRateAvg! * 10) / 10 }));
  const kcalSeries = data.daily
    .filter((d) => typeof d.activeEnergyKcal === "number")
    .map((d) => ({ date: d.date, value: Math.round(d.activeEnergyKcal!) }));

  const { summary } = data;
  const device = data.member.wearables.device ?? "устройство";
  const sleepAvgH = summary.sleepMinutesAvg ? summary.sleepMinutesAvg / 60 : null;

  return (
    <div className="space-y-4">
      <div className="text-caption-1 text-text-tertiary">
        Источник: {device} · Google Health API · последние {summary.days} дней
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile
          label="Шаги в день"
          value={summary.stepsAvg ? fmtNum(summary.stepsAvg) : "—"}
          unit="в среднем"
          caption={summary.stepsLast ? `сегодня ${fmtNum(summary.stepsLast)}` : undefined}
        />
        <StatTile
          label="ЧСС средняя"
          value={summary.heartRateAvg ? fmtNum(summary.heartRateAvg) : "—"}
          unit="bpm"
        />
        <StatTile
          label="Активные калории"
          value={summary.activeKcalAvg ? fmtNum(summary.activeKcalAvg) : "—"}
          unit="kcal/день"
        />
        <StatTile
          label="Сон"
          value={sleepAvgH ? fmtNum(Math.round(sleepAvgH * 10) / 10) : "—"}
          unit="ч/ночь"
          caption={sleepAvgH ? undefined : "нет данных"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stepsSeries.length >= 2 && (
          <TrendChartCard title="Шаги" unit="шагов" category="activity" data={stepsSeries} />
        )}
        {hrSeries.length >= 2 && (
          <TrendChartCard title="Средняя ЧСС" unit="bpm" category="heart" data={hrSeries} />
        )}
        {kcalSeries.length >= 2 && (
          <TrendChartCard title="Активные калории" unit="kcal" category="nutrition" data={kcalSeries} />
        )}
      </div>
    </div>
  );
}
