"use client";

import { useEffect, useRef, useState } from "react";
import { readinessColor, readinessLabel } from "@/lib/readiness";
import { Tooltip } from "@/components/ui/Tooltip";

interface ReadinessLatest {
  date: string;
  score: number | null;
  components: {
    hrv: number | null;
    rhr: number | null;
    sleepEfficiency: number | null;
    spo2: number | null;
  };
}

interface WhoopData {
  recovery: number | null;  // 0–100
  strain: number | null;    // 0–21
  sleep: number | null;     // 0–100, sleep efficiency
  latest: ReadinessLatest | null;
}

// ---- Concentric rings (WHOOP / Apple Watch Activity style) ----

const TRACK = "var(--color-fill-quaternary)";

function arc(pct: number, circ: number) {
  const p = Math.min(Math.max(pct, 0), 1);
  return `${p * circ} ${circ}`;
}

// ---- Animated counter hook ----

function useCountUp(target: number | null, duration = 1200): number | null {
  const [value, setValue] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) {
      setValue(null);
      return;
    }

    const start = performance.now();
    const finalTarget = target; // captured in closure, guaranteed non-null

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setValue(Math.round(eased * finalTarget));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

// ---- LegendDot with tooltip ----

interface LegendDotProps {
  color: string;
  label: string;
  value: string;
  tooltip: string;
}

function LegendDot({ color, label, value, tooltip }: LegendDotProps) {
  return (
    <Tooltip content={tooltip} side="bottom">
      <div
        className="group flex flex-col items-center gap-0.5 min-w-0 cursor-default transition-transform duration-150 hover:scale-105"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-caption-1 font-semibold text-text-primary tabular">{value}</span>
        </div>
        <span className="text-caption-2 text-text-tertiary">{label}</span>
      </div>
    </Tooltip>
  );
}

// ---- Tooltip contents ----

const TOOLTIP_RECOVERY = `Готовность организма к нагрузке.\nСчитается по HRV, ЧСС покоя и качеству сна за ночь.\n≥85% — отлично, 70–85% — хорошо, <70% — беречься`;
const TOOLTIP_STRAIN   = `Физический стресс за день (шкала 0–21).\nСчитается по активным минутам в зонах пульса.\n<7 — лёгкая, 7–14 — умеренная, >14 — высокая`;
const TOOLTIP_SLEEP    = `Эффективность сна — время сна / время в постели × 100.\n≥85% — хороший сон, 70–85% — средний, <70% — плохой`;
const TOOLTIP_RHR      = `Пульс в состоянии покоя (утром, до активности).\nНиже = лучше. Норма: 50–65 bpm.\nВысокий RHR сигнализирует о стрессе или болезни`;

// ---- Main ----

export function WhoopDashboard({ memberId }: { memberId: string }) {
  const [data, setData] = useState<WhoopData | null>(null);
  const [loading, setLoading] = useState(true);

  // Hover state for rings (for brightness effect)
  const [hoveredRing, setHoveredRing] = useState<"recovery" | "strain" | "sleep" | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);

    Promise.all([
      fetch(`/api/readiness?member=${encodeURIComponent(memberId)}&days=7`)
        .then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/wearables?member=${encodeURIComponent(memberId)}&days=3`)
        .then((r) => (r.ok ? r.json() : null)),
    ]).then(([readiness, wearables]) => {
      if (cancel) return;
      const latest: ReadinessLatest | null = readiness?.latest ?? null;
      const days: Array<Record<string, unknown>> = wearables?.daily ?? [];
      const strainRaw = days.map((d) => d?.activeZoneMinutes as number | undefined)
        .find((v) => v != null) ?? null;
      const strain = strainRaw != null ? Math.min(strainRaw / 210 * 21, 21) : null;

      setData({
        recovery: latest?.score ?? null,
        strain: strain != null ? Math.round(strain * 10) / 10 : null,
        sleep: latest?.components?.sleepEfficiency ?? null,
        latest,
      });
    }).finally(() => {
      if (!cancel) setLoading(false);
    });

    return () => { cancel = true; };
  }, [memberId]);

  // Animated counter — counts from 0 to recovery value on mount
  const animatedRecovery = useCountUp(data?.recovery ?? null);

  if (loading) {
    return <div className="text-callout text-text-tertiary animate-pulse">Считаю показатели…</div>;
  }
  if (!data || (data.recovery == null && data.strain == null && data.sleep == null)) {
    return (
      <div className="bg-bg-secondary rounded-card shadow-card p-5 text-callout text-text-secondary">
        Недостаточно данных. Нужны HRV и ЧСС покоя из носимого устройства.
      </div>
    );
  }

  // Colors
  const recoveryColor = data.recovery != null
    ? `var(--color-${readinessColor(data.recovery)})`
    : TRACK;

  const strainColor = data.strain == null ? TRACK
    : data.strain < 7  ? "var(--color-status-normal)"
    : data.strain < 14 ? "var(--color-status-borderline)"
    : "var(--color-status-high)";

  const sleepColor = data.sleep == null ? TRACK
    : data.sleep >= 85 ? "var(--color-mindfulness)"
    : data.sleep >= 70 ? "var(--color-sleep)"
    : "var(--color-status-low)";

  // Pulse effect: outer ring glows when recovery >= 85
  const shouldPulse = data.recovery != null && data.recovery >= 85;

  // Concentric ring geometry
  const SIZE = 200;
  const CX = SIZE / 2;
  const SW = 13;   // stroke width
  const GAP = 6;   // gap between rings

  const R1 = CX - SW / 2 - 2;        // outer  (Recovery)
  const R2 = R1 - SW - GAP;           // middle (Strain)
  const R3 = R2 - SW - GAP;           // inner  (Sleep)

  const C1 = 2 * Math.PI * R1;
  const C2 = 2 * Math.PI * R2;
  const C3 = 2 * Math.PI * R3;

  const pct1 = data.recovery != null ? data.recovery / 100 : 0;
  const pct2 = data.strain   != null ? data.strain / 21    : 0;
  const pct3 = data.sleep    != null ? data.sleep / 100     : 0;

  // Display value for center: animated counter or dash
  const displayRecovery = animatedRecovery ?? (data.recovery != null ? Math.round(data.recovery) : null);

  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-5">
      <div className="flex flex-col items-center">

        {/* Three concentric rings */}
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            style={{ transform: "rotate(-90deg)", display: "block", overflow: "visible" }}
          >
            {/* Outer — Recovery */}
            <circle cx={CX} cy={CX} r={R1} fill="none" stroke={TRACK} strokeWidth={SW} />
            <g
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredRing("recovery")}
              onMouseLeave={() => setHoveredRing(null)}
            >
              <circle
                cx={CX} cy={CX} r={R1} fill="none"
                stroke={recoveryColor} strokeWidth={SW} strokeLinecap="round"
                strokeDasharray={arc(pct1, C1)}
                style={{
                  transition: "stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s",
                  opacity: hoveredRing === "recovery" ? 1 : hoveredRing != null ? 0.75 : 1,
                  ...(shouldPulse ? { animation: "ring-pulse 2.5s ease-in-out infinite" } : {}),
                }}
              />
              {/* Invisible wide hit area */}
              <circle cx={CX} cy={CX} r={R1} fill="none" stroke="transparent" strokeWidth={SW + 10} />
            </g>

            {/* Middle — Strain */}
            <circle cx={CX} cy={CX} r={R2} fill="none" stroke={TRACK} strokeWidth={SW} />
            <g
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredRing("strain")}
              onMouseLeave={() => setHoveredRing(null)}
            >
              <circle
                cx={CX} cy={CX} r={R2} fill="none"
                stroke={strainColor} strokeWidth={SW} strokeLinecap="round"
                strokeDasharray={arc(pct2, C2)}
                style={{
                  transition: "stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.05s, opacity 0.2s",
                  opacity: hoveredRing === "strain" ? 1 : hoveredRing != null ? 0.75 : 1,
                }}
              />
              <circle cx={CX} cy={CX} r={R2} fill="none" stroke="transparent" strokeWidth={SW + 10} />
            </g>

            {/* Inner — Sleep */}
            <circle cx={CX} cy={CX} r={R3} fill="none" stroke={TRACK} strokeWidth={SW} />
            <g
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredRing("sleep")}
              onMouseLeave={() => setHoveredRing(null)}
            >
              <circle
                cx={CX} cy={CX} r={R3} fill="none"
                stroke={sleepColor} strokeWidth={SW} strokeLinecap="round"
                strokeDasharray={arc(pct3, C3)}
                style={{
                  transition: "stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.1s, opacity 0.2s",
                  opacity: hoveredRing === "sleep" ? 1 : hoveredRing != null ? 0.75 : 1,
                }}
              />
              <circle cx={CX} cy={CX} r={R3} fill="none" stroke="transparent" strokeWidth={SW + 10} />
            </g>
          </svg>

          {/* Ring tooltips — absolute divs over SVG (SVG is rotated, so we use separate elements) */}
          {hoveredRing === "recovery" && (
            <div style={{
              position: "absolute",
              top: -8,
              left: "50%",
              transform: "translateX(-50%) translateY(-100%)",
              zIndex: 50,
              pointerEvents: "none",
              background: "#1c1c1e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "10px 14px",
              maxWidth: 220,
              fontSize: 12,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.9)",
              whiteSpace: "pre-line",
              boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
              animation: "none",
            }}>
              {TOOLTIP_RECOVERY}
            </div>
          )}
          {hoveredRing === "strain" && (
            <div style={{
              position: "absolute",
              top: "50%",
              right: -8,
              transform: "translateY(-50%) translateX(100%)",
              zIndex: 50,
              pointerEvents: "none",
              background: "#1c1c1e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "10px 14px",
              maxWidth: 220,
              fontSize: 12,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.9)",
              whiteSpace: "pre-line",
              boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
            }}>
              {TOOLTIP_STRAIN}
            </div>
          )}
          {hoveredRing === "sleep" && (
            <div style={{
              position: "absolute",
              bottom: -8,
              left: "50%",
              transform: "translateX(-50%) translateY(100%)",
              zIndex: 50,
              pointerEvents: "none",
              background: "#1c1c1e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "10px 14px",
              maxWidth: 220,
              fontSize: 12,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.9)",
              whiteSpace: "pre-line",
              boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
            }}>
              {TOOLTIP_SLEEP}
            </div>
          )}

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none" style={{ pointerEvents: "none" }}>
            {displayRecovery != null ? (
              <>
                <span
                  className="tabular"
                  style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.04em", color: recoveryColor }}
                >
                  {displayRecovery}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: recoveryColor, opacity: 0.75 }}>%</span>
                <span className="text-caption-1 text-text-tertiary mt-1">
                  {data.recovery != null ? readinessLabel(data.recovery) : ""}
                </span>
              </>
            ) : (
              <span className="text-text-quaternary" style={{ fontSize: 28, fontWeight: 700 }}>–</span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-start justify-around w-full mt-4 px-2">
          <LegendDot
            color={recoveryColor}
            label="Восстановление"
            value={data.recovery != null ? `${Math.round(data.recovery)}%` : "–"}
            tooltip={TOOLTIP_RECOVERY}
          />
          <LegendDot
            color={strainColor}
            label="Нагрузка"
            value={data.strain != null ? `${data.strain.toFixed(1)} / 21` : "–"}
            tooltip={TOOLTIP_STRAIN}
          />
          <LegendDot
            color={sleepColor}
            label="Сон"
            value={data.sleep != null ? `${Math.round(data.sleep)}%` : "–"}
            tooltip={TOOLTIP_SLEEP}
          />
        </div>

        {/* Stats chips */}
        {data.latest && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {data.latest.components.hrv != null && (
              <span className="text-caption-1 text-text-tertiary bg-bg-tertiary rounded-chip px-2.5 py-1">
                HRV {data.latest.components.hrv} мс
              </span>
            )}
            {data.latest.components.rhr != null && (
              <Tooltip content={TOOLTIP_RHR} side="top">
                <span
                  className="text-caption-1 text-text-tertiary bg-bg-tertiary rounded-chip px-2.5 py-1 cursor-default"
                  style={{ transition: "opacity 0.15s" }}
                >
                  ЧСС покоя {data.latest.components.rhr} bpm
                </span>
              </Tooltip>
            )}
            {data.latest.components.spo2 != null && (
              <span className="text-caption-1 text-text-tertiary bg-bg-tertiary rounded-chip px-2.5 py-1">
                SpO₂ {data.latest.components.spo2}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
