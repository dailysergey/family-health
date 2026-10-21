"use client";

import type { Diagnosis, LabResult } from "@/lib/types";
import { analyzeLab, dmy, fmt } from "@/lib/labs";
import { askAssistant, LegendDot } from "./primitives";

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/** Hero row: labs summary, diagnoses count and the suggested next step. */
export function Overview({
  labs,
  diagnoses,
  onPickLab,
}: {
  labs: LabResult[];
  diagnoses: Diagnosis[];
  onPickLab: (id: string) => void;
}) {
  const views = labs.map(analyzeLab);
  const ok = views.filter((v) => v.bucket === "ok").length;
  const border = views.filter((v) => v.bucket === "border").length;
  const outViews = views.filter((v) => v.bucket === "out");
  const out = outViews.length;
  const worse = outViews.filter((v) => v.worse).length;
  const lastDate = labs.reduce((m, l) => (l.date > m ? l.date : m), "");

  const active = diagnoses.filter((d) => d.status === "active").length;
  const remission = diagnoses.filter((d) => d.status === "remission").length;
  const resolved = diagnoses.filter((d) => d.status === "resolved").length;

  const attention = [...outViews, ...views.filter((v) => v.bucket === "border")];
  const names = attention.slice(0, 3).map((v) => v.lab.name);
  const nextText = attention.length
    ? `Обсудить с врачом ${names.join(", ")}${attention.length > 3 ? ` и ещё ${attention.length - 3}` : ""} — ${
        out ? "вне нормы" : "на границе нормы"
      }`
    : labs.length
      ? "Все показатели в норме. Спросите ассистента, когда пора пересдать анализы."
      : "Загрузите бланк анализов — ассистент распознает показатели и подскажет, что проверить.";
  const nextAsk = attention.length
    ? `Что делать с показателями ${names.join(", ")}? Какие анализы пересдать и когда?`
    : "Когда мне стоит пересдать анализы и какие?";

  return (
    <section className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
      {labs.length > 0 ? (
        <div className="o-card px-7 py-6 flex flex-col gap-[18px]">
          <div className="flex justify-between items-baseline gap-3 flex-wrap text-[13px] text-muted">
            <span className="font-semibold">Анализы · последний срез {dmy(lastDate)}</span>
            <span>
              {labs.length} {plural(labs.length, "показатель", "показателя", "показателей")}
            </span>
          </div>
          <div className="flex items-baseline gap-3.5 flex-wrap">
            <span className="font-heading text-[56px] leading-none" style={{ color: "var(--color-accent-700)" }}>
              {out}
            </span>
            <span className="text-lg leading-snug max-w-[340px]">
              вне нормы
              {out > 0 && (
                <>
                  , из них <b>{worse}</b> {worse === 1 ? "ухудшился" : "ухудшились"} с прошлого раза
                </>
              )}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex h-3.5 rounded-full overflow-hidden gap-[3px]">
              {ok > 0 && <div style={{ flex: ok, background: "var(--color-accent-2-500)" }} />}
              {border > 0 && <div style={{ flex: border, background: "var(--color-accent-400)" }} />}
              {out > 0 && <div style={{ flex: out, background: "var(--color-accent-700)" }} />}
            </div>
            <div className="flex gap-[18px] flex-wrap text-xs" style={{ color: "var(--color-neutral-800)" }}>
              <LegendDot color="var(--color-accent-2-500)">Норма · {ok}</LegendDot>
              <LegendDot color="var(--color-accent-400)">На границе · {border}</LegendDot>
              <LegendDot color="var(--color-accent-700)">Вне нормы · {out}</LegendDot>
            </div>
          </div>
          {attention.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {attention.map((v) => (
                <button
                  key={v.lab.id}
                  type="button"
                  onClick={() => onPickLab(v.lab.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition-colors bg-[var(--color-accent-100)] hover:bg-[var(--color-accent-200)]"
                  style={{ color: "var(--color-accent-900)" }}
                >
                  <b className="font-semibold">{v.lab.name}</b>
                  <span>
                    {v.lab.status === "low" ? "↓" : v.lab.status === "high" ? "↑" : "·"} {fmt(v.lab.value)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {diagnoses.length > 0 && (
          <div className="o-card px-6 py-[22px] flex flex-col gap-3">
            <div className="flex items-baseline gap-2.5">
              <span className="font-heading text-[40px] leading-none">{active}</span>
              <span className="text-[15px]">
                {plural(active, "активный диагноз", "активных диагноза", "активных диагнозов")}
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {active > 0 && <span className="tag tag-accent">{active} активн.</span>}
              {remission > 0 && <span className="tag tag-accent-2">{remission} ремиссия</span>}
              {resolved > 0 && <span className="tag tag-neutral">{resolved} разрешено</span>}
            </div>
          </div>
        )}
        <div
          className="rounded-[28px] px-6 py-[22px] flex flex-col gap-2.5 flex-1"
          style={{ background: "var(--color-accent-2-200)" }}
        >
          <span
            className="text-xs font-semibold tracking-[.04em] uppercase"
            style={{ color: "var(--color-accent-2-800)" }}
          >
            Следующий шаг
          </span>
          <span className="text-base leading-snug" style={{ color: "var(--color-accent-2-900)", textWrap: "pretty" }}>
            {nextText}
          </span>
          <div className="flex gap-2 mt-auto pt-1">
            <button type="button" className="btn btn-primary text-[13px] px-4 py-2" onClick={() => askAssistant(nextAsk)}>
              Спросить ассистента
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
