"use client";

import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import type { LabResult } from "@/lib/types";
import { groupLabs } from "@/lib/ui";
import { analyzeLab, BUCKET_STYLE, fmt, monYY, refLabel, type LabView } from "@/lib/labs";
import { EmptyState, LegendDot, Section, Seg } from "./primitives";

type Filter = "all" | "attention" | "worse";

function insight(v: LabView): string {
  const s = v.series;
  if (!v.numeric) return v.lab.refText ? `Качественный результат. Норма: ${v.lab.refText}.` : "Качественный результат.";
  const status =
    v.bucket === "out"
      ? v.better
        ? "Всё ещё вне нормы, но движется к ней."
        : v.worse
          ? "Вне нормы и продолжает уходить от неё."
          : "Вне нормы."
      : v.bucket === "border"
        ? "Близко к границе нормы — стоит пересдать."
        : "В норме.";
  if (s.length < 2) return `${status} Это первый анализ — динамика появится после следующего.`;
  const first = s[0].value;
  const chg = first !== 0 ? Math.round(((v.value! - first) / Math.abs(first)) * 100) : 0;
  const move = chg === 0 ? "Не изменился" : chg > 0 ? `Вырос на ${chg}%` : `Снизился на ${Math.abs(chg)}%`;
  return `${move} с ${monYY(s[0].date)} (${s.length} ${s.length < 5 ? "анализа" : "анализов"}). ${status}`;
}

function DetailChart({ v }: { v: LabView }) {
  const n = v.series.length;
  const X = (i: number) => (n === 1 ? 50 : 4 + (i / (n - 1)) * 92);
  const Y = (x: number) => 100 - v.pct(x);
  const bandTop = v.hi != null ? Y(v.hi) : 0;
  const bandBottom = v.lo != null ? Y(v.lo) : 100;
  const line = v.series.map((p, i) => `${i ? "L" : "M"}${X(i)} ${Y(p.value)}`).join(" ");
  return (
    <div className="relative h-[220px] mr-14 sm:mr-[70px] ml-1 mb-7">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
        {(v.lo != null || v.hi != null) && (
          <rect x="0" y={bandTop} width="100" height={Math.max(0, bandBottom - bandTop)} style={{ fill: "var(--color-accent-2-200)" }} />
        )}
        {n > 1 && (
          <path
            d={line}
            style={{
              fill: "none",
              stroke: "var(--color-neutral-800)",
              strokeWidth: 2.75,
              strokeLinejoin: "round",
              strokeLinecap: "round",
              vectorEffect: "non-scaling-stroke",
            }}
          />
        )}
      </svg>
      {v.hi != null && (
        <div
          className="absolute left-full -translate-y-1/2 pl-2.5 text-[11px] whitespace-nowrap"
          style={{ top: `${bandTop}%`, color: "var(--color-accent-2-800)" }}
        >
          {fmt(v.hi)}
        </div>
      )}
      {v.lo != null && (
        <div
          className="absolute left-full -translate-y-1/2 pl-2.5 text-[11px] whitespace-nowrap"
          style={{ top: `${bandBottom}%`, color: "var(--color-accent-2-800)" }}
        >
          {fmt(v.lo)}
        </div>
      )}
      {v.series.map((p, i) => {
        const st =
          (v.lo != null && p.value < v.lo) || (v.hi != null && p.value > v.hi)
            ? BUCKET_STYLE.out.dot
            : BUCKET_STYLE.ok.dot;
        const last = i === n - 1;
        return (
          <div key={p.date}>
            <div
              className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full"
              style={{
                left: `${X(i)}%`,
                top: `${Y(p.value)}%`,
                background: last ? BUCKET_STYLE[v.bucket].dot : st,
                border: "3px solid var(--color-neutral-100)",
              }}
            />
            <div
              className="absolute text-[13px] font-bold whitespace-nowrap"
              style={{ left: `${X(i)}%`, top: `${Y(p.value)}%`, transform: "translate(-50%,-150%)" }}
            >
              {fmt(p.value)}
            </div>
            <div
              className="absolute text-xs text-muted whitespace-nowrap"
              style={{ left: `${X(i)}%`, top: "calc(100% + 10px)", transform: "translateX(-50%)" }}
            >
              {monYY(p.date)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RangeBar({ v, showPrev }: { v: LabView; showPrev: boolean }) {
  if (!v.numeric || (v.lo == null && v.hi == null)) {
    return <span className="text-xs text-muted truncate">{v.lab.refText ?? "—"}</span>;
  }
  const bl = v.pct(v.lo ?? 0);
  const bh = v.hi != null ? v.pct(v.hi) : 100;
  return (
    <span className="relative h-5 block">
      <span className="absolute inset-x-0 top-[7px] h-1.5 rounded-full" style={{ background: "var(--color-neutral-300)" }} />
      <span
        className="absolute top-[5px] h-2.5 rounded-full"
        style={{ left: `${bl}%`, width: `${Math.max(2, bh - bl)}%`, background: "var(--color-accent-2-300)" }}
      />
      {showPrev && v.prev != null && (
        <span
          className="absolute top-1 w-3 h-3 -ml-1.5 rounded-full"
          style={{
            left: `${v.pct(v.prev)}%`,
            border: "2px solid var(--color-neutral-600)",
            background: "var(--color-neutral-100)",
          }}
        />
      )}
      <span
        className="absolute top-px w-[18px] h-[18px] -ml-[9px] rounded-full"
        style={{
          left: `${v.pct(v.value!)}%`,
          background: BUCKET_STYLE[v.bucket].dot,
          border: "3px solid var(--color-neutral-100)",
          boxShadow: "var(--shadow-sm)",
        }}
      />
    </span>
  );
}

export function LabsSection({
  labs,
  selectedId,
  onSelect,
  onUpload,
}: {
  labs: LabResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpload: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const views = useMemo(() => labs.map(analyzeLab), [labs]);
  const byId = useMemo(() => new Map(views.map((v) => [v.lab.id, v])), [views]);

  const fallback =
    views.find((v) => v.bucket === "out" && v.series.length > 1) ??
    views.find((v) => v.bucket !== "ok") ??
    views.find((v) => v.series.length > 1) ??
    views.find((v) => v.numeric) ??
    views[0];
  const det = (selectedId && byId.get(selectedId)) || fallback;

  const shown = views.filter(
    (v) => filter === "all" || (filter === "attention" && v.bucket !== "ok") || (filter === "worse" && v.worse),
  );
  const groups = groupLabs(shown.map((v) => v.lab));
  const anyPrev = views.some((v) => v.prev != null);

  if (labs.length === 0) {
    return (
      <Section id="labs" title="Анализы">
        <EmptyState
          dashed
          icon={<UploadCloud size={30} strokeWidth={2.5} />}
          title="Анализов пока нет"
          text="Загрузите бланк из лаборатории (PDF, JPG, PNG) — ассистент распознает показатели и построит динамику."
          action={
            <button type="button" className="btn btn-primary" onClick={onUpload}>
              Загрузить бланк
            </button>
          }
        />
      </Section>
    );
  }

  const ds = BUCKET_STYLE[det.bucket];
  const cols = "sm:grid-cols-[minmax(90px,1.1fr)_96px_minmax(100px,2fr)_84px]";

  return (
    <Section
      id="labs"
      title="Анализы"
      aside={
        <Seg<Filter>
          options={[
            ["all", "Все"],
            ["attention", "Требуют внимания"],
            ["worse", "Ухудшились"],
          ]}
          value={filter}
          onChange={setFilter}
        />
      }
    >
      <div className="o-card px-5 sm:px-[26px] pt-6 pb-5 flex flex-col gap-[18px]">
        <div className="flex justify-between gap-4 flex-wrap items-start">
          <div className="flex flex-col gap-1.5 max-w-[520px]">
            <span className="text-xs text-muted">{det.lab.group ?? "Прочие показатели"}</span>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-heading text-[30px] leading-none">{det.lab.name}</span>
              <span className={ds.tag}>{ds.label}</span>
            </div>
            <span className="text-sm leading-snug" style={{ color: "var(--color-neutral-800)", textWrap: "pretty" }}>
              {insight(det)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[32px] font-bold leading-none tabular">{fmt(det.lab.value)}</span>
            <span className="text-[13px] text-muted">
              {det.lab.unit} · норма {refLabel(det)}
            </span>
          </div>
        </div>
        {det.numeric && <DetailChart v={det} />}
      </div>

      <div className="o-card px-2.5 py-2">
        <div
          className={`hidden sm:grid ${cols} gap-4 px-4 pt-3 pb-2 text-[11px] tracking-[.04em] uppercase text-muted`}
        >
          <span>Показатель</span>
          <span className="text-right">Значение</span>
          <span>Положение в норме</span>
          <span className="text-right whitespace-nowrap">С прошлого</span>
        </div>
        {groups.length === 0 && <div className="px-4 py-6 text-sm text-muted">Нет показателей под этот фильтр.</div>}
        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-4 pt-4 pb-1.5 text-[13px] font-bold" style={{ color: "var(--color-neutral-800)" }}>
              {g.title}
            </div>
            {g.labs.map((lab) => {
              const v = byId.get(lab.id)!;
              const s = BUCKET_STYLE[v.bucket];
              const trend =
                v.deltaPct == null ? "—" : `${v.deltaPct > 0 ? "↑ +" : v.deltaPct < 0 ? "↓ −" : ""}${Math.abs(v.deltaPct)}%`;
              const trendColor = v.worse
                ? "var(--color-accent-700)"
                : v.better
                  ? "var(--color-accent-2-700)"
                  : "var(--color-neutral-700)";
              const selected = lab.id === det.lab.id;
              return (
                <button
                  key={lab.id}
                  type="button"
                  onClick={() => onSelect(lab.id)}
                  className={`w-full grid grid-cols-[minmax(0,1fr)_auto_56px] ${cols} gap-x-4 gap-y-2 items-center px-4 py-3 rounded-[16px] text-left transition-colors hover:bg-[var(--color-neutral-200)]`}
                  style={selected ? { background: "var(--color-accent-100)" } : undefined}
                >
                  <span className="text-sm font-semibold min-w-0 truncate" title={lab.name}>
                    {lab.name}
                  </span>
                  <span className="text-right text-[15px] font-bold tabular max-w-[45vw] sm:max-w-none break-words" style={{ color: s.valueColor }}>
                    {fmt(lab.value)} <span className="text-xs font-normal text-muted">{lab.unit}</span>
                  </span>
                  <span className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto min-w-0">
                    <RangeBar v={v} showPrev />
                  </span>
                  <span className="text-right text-[13px] font-semibold whitespace-nowrap" style={{ color: trendColor }}>
                    {trend}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <div className="flex gap-[18px] flex-wrap px-4 pt-3.5 pb-2.5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <i className="inline-block w-[18px] h-2 rounded-full" style={{ background: "var(--color-accent-2-300)" }} />
            референс
          </span>
          {anyPrev && (
            <LegendDot ring color="var(--color-neutral-600)">
              прошлый анализ
            </LegendDot>
          )}
          <LegendDot color="var(--color-accent-700)">сейчас</LegendDot>
          <span>Нажмите на строку — график выше покажет динамику</span>
        </div>
      </div>
    </Section>
  );
}
