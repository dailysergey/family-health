"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Smartphone } from "lucide-react";
import { Bars, Card, EmptyState, Section, Seg } from "./primitives";

interface Day {
  date: string;
  activeZoneMinutes?: number;
  sleepMinutes?: number;
  sleepEfficiency?: number;
  sleepScore?: number;
  readinessScore?: number;
  sleepStages?: { deep: number; rem: number; light: number; awake: number };
  restingHeartRate?: number;
  hrvRmssd?: number;
  spo2?: number;
}

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const hm = (min: number) => ({ h: Math.floor(min / 60), m: Math.round(min % 60) });
const hmText = (min: number) => {
  const { h, m } = hm(min);
  return h ? `${h}ч ${m}м` : `${m}м`;
};
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
const fmt1 = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

// Strain on the 0–21 scale from active zone minutes (same formula as before).
const strainOf = (d: Day) =>
  d.activeZoneMinutes != null ? Math.min((d.activeZoneMinutes / 210) * 21, 21) : null;
const STRAIN_LO = 8;
const STRAIN_HI = 14;

function readinessZone(score: number) {
  if (score >= 67) return { label: "в норме", tag: "tag tag-accent-2", zone: "высокая зона" };
  if (score >= 33) return { label: "средняя", tag: "tag tag-neutral", zone: "средняя зона" };
  return { label: "низкая", tag: "tag tag-accent", zone: "низкая зона" };
}

function ReadinessChart({ days }: { days: { date: string; score: number }[] }) {
  const [hover, setHover] = useState(-1);
  const n = days.length;
  if (n < 2) return <div className="text-sm text-muted py-8">Недостаточно дней для графика.</div>;
  const rx = (i: number) => (i / (n - 1)) * 100;
  const ry = (v: number) => 100 - v;
  const line = days.map((d, i) => `${i ? "L" : "M"}${rx(i)} ${ry(d.score)}`).join(" ");
  const last = days[n - 1];
  const h = hover >= 0 && hover < n ? hover : -1;
  return (
    <>
      <div className="relative h-[200px] ml-[72px]" onMouseLeave={() => setHover(-1)}>
        {[
          ["Высокая", 0, "var(--color-accent-2-800)"],
          ["Средняя", 33, "var(--color-neutral-700)"],
          ["Низкая", 67, "var(--color-accent-800)"],
        ].map(([label, top, color]) => (
          <div
            key={label as string}
            className="absolute -left-[72px] h-[33%] flex items-center text-[11px]"
            style={{ top: `${top}%`, color: color as string }}
          >
            {label}
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          <rect x="0" y="0" width="100" height="33" style={{ fill: "var(--color-accent-2-100)" }} />
          <rect x="0" y="67" width="100" height="33" style={{ fill: "var(--color-accent-100)" }} />
          <path d={`${line} L100 100 L0 100 Z`} style={{ fill: "var(--color-accent-2-300)", opacity: 0.45 }} />
          <path
            d={line}
            style={{
              fill: "none",
              stroke: "var(--color-accent-2-700)",
              strokeWidth: 2.75,
              strokeLinejoin: "round",
              strokeLinecap: "round",
              vectorEffect: "non-scaling-stroke",
            }}
          />
        </svg>
        {h >= 0 && (
          <>
            <div className="absolute inset-y-0" style={{ left: `${rx(h)}%`, borderLeft: "2px solid var(--color-neutral-500)" }} />
            <div
              className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full"
              style={{
                left: `${rx(h)}%`,
                top: `${ry(days[h].score)}%`,
                background: "var(--color-accent-2-700)",
                border: "3px solid var(--color-neutral-100)",
              }}
            />
            <div
              className="absolute -top-2 px-2.5 py-1.5 rounded-[10px] text-xs whitespace-nowrap z-10"
              style={{
                left: `${rx(h)}%`,
                transform: "translate(-50%,-100%)",
                background: "var(--color-text)",
                color: "var(--color-neutral-100)",
              }}
            >
              {dayLabel(days[h].date)} · {days[h].score}
            </div>
          </>
        )}
        <div className="absolute inset-0 flex">
          {days.map((d, i) => (
            <div key={d.date} className="flex-1" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
          ))}
        </div>
        <div
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full pointer-events-none"
          style={{
            left: "100%",
            top: `${ry(last.score)}%`,
            background: "var(--color-accent)",
            border: "3px solid var(--color-neutral-100)",
          }}
        />
      </div>
      <div className="flex justify-between ml-[72px] text-[11px] text-muted">
        <span>{dayLabel(days[0].date)}</span>
        <span>
          {dayLabel(last.date)} · {last.score}
        </span>
      </div>
    </>
  );
}

export function TodaySection({
  memberId,
  enabled,
  device,
  extra,
}: {
  memberId: string;
  enabled: boolean;
  device?: string;
  /** Detailed activity widgets shown under a disclosure. */
  extra?: React.ReactNode;
}) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [calc, setCalc] = useState<Map<string, number>>(new Map());
  const [range, setRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    setDays(null);
    const q = `member=${encodeURIComponent(memberId)}&days=90`;
    Promise.all([
      fetch(`/api/wearables?${q}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/readiness?${q}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([w, r]) => {
        if (cancel) return;
        setDays((w?.daily as Day[]) ?? []);
        const m = new Map<string, number>();
        for (const d of (r?.daily ?? []) as { date: string; score: number | null }[]) {
          if (d.score != null) m.set(d.date, d.score);
        }
        setCalc(m);
      })
      .catch(() => !cancel && setDays([]));
    return () => {
      cancel = true;
    };
  }, [memberId, enabled]);

  const model = useMemo(() => {
    if (!days || days.length === 0) return null;
    const score = (d: Day) => d.readinessScore ?? calc.get(d.date) ?? null;
    const last14 = days.slice(-14);
    const today = days[days.length - 1];
    const prev = days.length > 1 ? days[days.length - 2] : null;

    const rec = last14.map(score);
    const recToday = score(today);
    const recAvg = avg(rec);

    const strain = last14.map(strainOf);
    const strainToday = strainOf(today);

    const base = days.slice(-15, -1);
    const vital = (key: "hrvRmssd" | "restingHeartRate" | "spo2") => ({ now: today[key] ?? null, norm: avg(base.map((d) => d[key])) });

    const readiness = days
      .map((d) => ({ date: d.date, score: score(d) }))
      .filter((d): d is { date: string; score: number } => d.score != null);

    return { today, prev, rec, recToday, recAvg, strain, strainToday, vital, readiness };
  }, [days, calc]);

  if (!enabled) {
    return (
      <Section id="today" title="Сегодня">
        <EmptyState
          icon={<Smartphone size={30} strokeWidth={2.5} />}
          title="Нет данных о сне и активности"
          text="Подключите часы или фитнес-браслет — восстановление, нагрузка и сон появятся здесь."
          action={
            <Link href="/settings/wearables" className="btn btn-primary">
              Подключить устройство
            </Link>
          }
        />
      </Section>
    );
  }

  if (!model) {
    return (
      <Section id="today" title="Сегодня">
        <div className="o-card p-6 text-sm text-muted">{days ? "Данных с устройства пока нет." : "Загружаю данные с устройства…"}</div>
      </Section>
    );
  }

  const { today, prev, rec, recToday, recAvg, strain, strainToday, vital, readiness } = model;
  const zone = recToday != null ? readinessZone(recToday) : null;
  const recDelta = recToday != null && recAvg != null ? Math.round(recToday - recAvg) : null;

  const sleepMin = today.sleepMinutes ?? null;
  const sleepDelta = sleepMin != null && prev?.sleepMinutes != null ? Math.round(sleepMin - prev.sleepMinutes) : null;
  const stages = today.sleepStages
    ? [
        { label: "Глубокий", min: today.sleepStages.deep, c: "var(--color-accent-2-800)" },
        { label: "REM", min: today.sleepStages.rem, c: "var(--color-accent-2-500)" },
        { label: "Лёгкий", min: today.sleepStages.light, c: "var(--color-accent-2-300)" },
        { label: "Пробуждения", min: today.sleepStages.awake, c: "var(--color-accent-400)" },
      ].filter((s) => s.min > 0)
    : [];

  const vitals = [
    { label: "Вариабельность (HRV)", unit: "мс", ...vital("hrvRmssd"), lowerIsBad: true, digits: 1 },
    { label: "Пульс в покое", unit: "уд/мин", ...vital("restingHeartRate"), lowerIsBad: false, digits: 0 },
    { label: "Сатурация SpO₂", unit: "%", ...vital("spo2"), lowerIsBad: true, digits: 1 },
  ]
    .filter((v) => v.now != null)
    .map((v) => {
      const diff = v.norm ? ((v.now! - v.norm) / v.norm) * 100 : 0;
      const bad = v.lowerIsBad ? diff < -3 : diff > 3;
      const good = v.lowerIsBad ? diff > 3 : diff < -3;
      const note =
        v.norm == null || Math.abs(diff) < 3
          ? "как обычно"
          : `${diff > 0 ? "+" : "−"}${Math.abs(Math.round(diff))}% к вашей норме`;
      return {
        ...v,
        val: v.digits ? fmt1(v.now!) : String(Math.round(v.now!)),
        note,
        c: bad ? "var(--color-accent-700)" : good || note === "как обычно" ? "var(--color-accent-2-700)" : "var(--color-neutral-700)",
      };
    });

  const shown = readiness.slice(-range);
  const shownAvg = avg(shown.map((d) => d.score));

  return (
    <Section
      id="today"
      title="Сегодня"
      caption={`${device ? `${device} · ` : ""}${dayLabel(today.date)} · столбики — последние 14 дней`}
    >
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <Card className="px-[22px] pt-[22px] pb-[18px] gap-3.5">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">Восстановление</span>
            {zone && <span className={zone.tag}>{zone.label}</span>}
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-heading text-[44px] leading-none">
              {recToday ?? "—"}
              {recToday != null && <span className="text-[22px]">%</span>}
            </span>
            {recDelta != null && (
              <span
                className="text-[13px]"
                style={{ color: recDelta < 0 ? "var(--color-accent-700)" : "var(--color-accent-2-700)" }}
              >
                {recDelta > 0 ? "+" : recDelta < 0 ? "−" : "±"}
                {Math.abs(recDelta)} к среднему
              </span>
            )}
          </div>
          <Bars
            bars={rec.map((v, i) => ({
              h: v ?? 0,
              title: v != null ? String(v) : "нет данных",
              color:
                v == null
                  ? "var(--color-neutral-300)"
                  : i === rec.length - 1
                    ? "var(--color-accent-2-600)"
                    : v < 60
                      ? "var(--color-accent-300)"
                      : "var(--color-accent-2-300)",
            }))}
            overlay={
              recAvg != null && (
                <div
                  className="absolute inset-x-0 z-[1] pointer-events-none"
                  style={{ bottom: `${recAvg}%`, borderTop: "2px dashed var(--color-neutral-500)" }}
                />
              )
            }
          />
          <span className="text-xs text-muted">
            Пунктир — среднее за 14 дней{recAvg != null ? ` (${Math.round(recAvg)}%)` : ""}
          </span>
        </Card>

        <Card className="px-[22px] pt-[22px] pb-[18px] gap-3.5">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">Нагрузка</span>
            {strainToday != null && (
              <span className={strainToday >= STRAIN_LO && strainToday <= STRAIN_HI ? "tag tag-accent-2" : "tag tag-accent"}>
                {strainToday < STRAIN_LO ? "ниже цели" : strainToday > STRAIN_HI ? "выше цели" : "в целевой зоне"}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-heading text-[44px] leading-none">{strainToday != null ? fmt1(strainToday) : "—"}</span>
            <span className="text-[13px] text-muted">
              из 21 · цель {STRAIN_LO}–{STRAIN_HI}
            </span>
          </div>
          <Bars
            bars={strain.map((v, i) => ({
              h: v != null ? (v / 21) * 100 : 0,
              title: v != null ? fmt1(v) : "нет данных",
              color:
                v == null
                  ? "var(--color-neutral-300)"
                  : i === strain.length - 1
                    ? "var(--color-accent)"
                    : v > STRAIN_HI || v < STRAIN_LO
                      ? "var(--color-accent-300)"
                      : "var(--color-neutral-400)",
            }))}
            overlay={
              <div
                className="absolute -inset-x-1 rounded-lg"
                style={{
                  bottom: `${(STRAIN_LO / 21) * 100}%`,
                  height: `${((STRAIN_HI - STRAIN_LO) / 21) * 100}%`,
                  background: "var(--color-accent-2-200)",
                }}
              />
            }
          />
          <span className="text-xs text-muted">Зелёная полоса — целевая нагрузка по минутам в пульсовых зонах</span>
        </Card>

        <Card className="px-[22px] pt-[22px] pb-[18px] gap-3.5">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">Сон</span>
            {today.sleepScore != null ? (
              <span className="tag tag-accent-2">{today.sleepScore} / 100</span>
            ) : today.sleepEfficiency != null ? (
              <span className="tag tag-accent-2">эфф. {today.sleepEfficiency}%</span>
            ) : null}
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-heading text-[44px] leading-none">
              {sleepMin != null ? (
                <>
                  {hm(sleepMin).h}
                  <span className="text-[22px]">ч</span> {hm(sleepMin).m}
                  <span className="text-[22px]">м</span>
                </>
              ) : (
                "—"
              )}
            </span>
            {sleepDelta != null && sleepDelta !== 0 && (
              <span
                className="text-[13px]"
                style={{ color: sleepDelta > 0 ? "var(--color-accent-2-700)" : "var(--color-accent-700)" }}
              >
                {sleepDelta > 0 ? "+" : "−"}
                {Math.abs(sleepDelta)} мин
              </span>
            )}
          </div>
          {stages.length > 0 && (
            <div className="flex flex-col gap-2 mt-auto">
              <div className="flex h-[22px] rounded-full overflow-hidden gap-0.5">
                {stages.map((s) => (
                  <div key={s.label} style={{ flex: s.min, background: s.c }} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {stages.map((s) => (
                  <span key={s.label} className="flex items-center gap-1.5 text-xs">
                    <i className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: s.c }} />
                    {s.label}
                    <b className="ml-auto font-semibold">{hmText(s.min)}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {vitals.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {vitals.map((v) => (
            <div
              key={v.label}
              className="rounded-[16px] px-[18px] py-3.5 flex items-center gap-3.5"
              style={{ background: "var(--color-neutral-200)" }}
            >
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="text-xs text-muted">{v.label}</span>
                <span className="text-xl font-bold whitespace-nowrap">
                  {v.val} <span className="text-[13px] font-normal text-muted">{v.unit}</span>
                </span>
              </div>
              <span className="text-xs text-right font-semibold max-w-[110px]" style={{ color: v.c }}>
                {v.note}
              </span>
            </div>
          ))}
        </div>
      )}

      {readiness.length > 1 && (
        <Card className="px-6 py-[22px] gap-3.5">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-[15px]">Готовность к нагрузке</span>
              <span className="text-[13px] text-muted">
                {recToday != null && zone ? `Сегодня ${recToday} — ${zone.zone}` : "Последние дни"}
                {shownAvg != null ? ` · в среднем за период ${Math.round(shownAvg)}` : ""}
              </span>
            </div>
            <Seg<7 | 30 | 90>
              options={[
                [7, "7 дней"],
                [30, "30 дней"],
                [90, "90 дней"],
              ]}
              value={range}
              onChange={setRange}
            />
          </div>
          <ReadinessChart days={shown} />
        </Card>
      )}

      {extra && (
        <details className="group">
          <summary className="btn btn-secondary text-[13px] cursor-pointer list-none w-fit">
            Шаги и активность подробно
          </summary>
          <div className="mt-4">{extra}</div>
        </details>
      )}
    </Section>
  );
}
