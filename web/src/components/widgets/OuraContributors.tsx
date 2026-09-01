"use client";

import { useEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

// ---- Types ----

interface WearablesDay {
  date: string;
  steps?: number;
  restingHeartRate?: number;
  heartRateAvg?: number;
  activeZoneMinutes?: number;
  sleepMinutes?: number;
  sleepEfficiency?: number;
  hrvRmssd?: number;
  spo2?: number;
  activeEnergyKcal?: number;
  readinessScore?: number;
  skinTempDeviation?: number;   // °C deviation from baseline (Oura daily_temperature)
  // Oura sub-contributor scores 0–100 (available after OAuth)
  ouraHrvBalance?: number;
  ouraRhrScore?: number;
  ouraRecoveryIndex?: number;
  ouraSleepBalance?: number;
  ouraSleepRegularity?: number;
  ouraActivityBalance?: number;
  ouraPrevDayActivity?: number;
}

interface WearablesResponse {
  daily: WearablesDay[];
}

// ---- Contributor config ----

type ContributorColor = "green" | "yellow" | "red" | "gray";

interface ContributorResult {
  score: number; // 0–100
  color: ContributorColor;
  value: string;
  rawValue: number | null;
}

interface ContributorTier {
  label: string;       // bold prefix, e.g. "Оптимально"
  description: string; // rest of the text
}

interface DetailSection {
  heading?: string;    // bold sub-header (optional)
  paragraphs: string[];
}

interface ContributorDef {
  key: string;
  label: string;
  unit: string;
  tooltip: string;
  detail: {
    title: string;
    paragraphs?: string[];           // simple flat list (backward compat)
    sections?: DetailSection[];      // with optional bold sub-headers
    tiers: ContributorTier[];
    learnMoreLabel?: string;
    learnMoreUrl?: string;
  };
  compute: (day: WearablesDay) => ContributorResult;
}

function colorFor(
  value: number | null,
  goodThreshold: number,
  medThreshold: number,
  invert = false,
): ContributorColor {
  if (value == null) return "gray";
  if (!invert) {
    if (value >= goodThreshold) return "green";
    if (value >= medThreshold) return "yellow";
    return "red";
  } else {
    if (value <= goodThreshold) return "green";
    if (value <= medThreshold) return "yellow";
    return "red";
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

const CONTRIBUTORS: ContributorDef[] = [
  {
    key: "rhr",
    label: "ЧСС покоя",
    unit: "уд/мин",
    tooltip: "Пульс в покое. Норма 40–100 bpm.\nЧуть ниже вашего среднего — признак хорошей готовности.",
    detail: {
      title: "ЧСС покоя",
      paragraphs: [
        "ЧСС покоя (RHR) — хороший показатель восстановления. Это количество ударов сердца в минуту, когда вы находитесь в состоянии покоя.",
        "Норма пульса покоя у взрослых — от 40 до 100 уд/мин. Oura нужно около 2 недель, чтобы определить вашу личную базовую линию.",
        "Для Oura пульс покоя немного ниже вашего среднего — признак хорошей готовности. Интенсивные тренировки, поздний ужин, повышенная температура тела, а также мысли и эмоции — стресс или возбуждение — могут держать пульс повышенным во время сна.",
      ],
      tiers: [],
      learnMoreLabel: "Пульс во сне — 4 паттерна, на которые стоит обращать внимание",
      learnMoreUrl: "https://ouraring.com/blog/heart-rate-during-sleep/",
    },
    compute: (day) => {
      const v = day.restingHeartRate ?? null;
      const color = colorFor(v, 65, 80, true);
      const score = v == null ? 0 : clamp(Math.round(((95 - v) / (95 - 50)) * 100), 0, 100);
      return { score, color, value: v != null ? String(Math.round(v)) : "–", rawValue: v };
    },
  },
  {
    key: "hrv",
    label: "HRV balance",
    unit: "мс",
    tooltip: "Вариабельность сердечного ритма.\nСравнивает тренд за 2 недели с трёхмесячным средним.\nВыше = лучше. Норма > 50 мс.",
    detail: {
      title: "HRV balance",
      paragraphs: [
        "HRV balance помогает отслеживать состояние восстановления, сравнивая двухнедельный тренд вариабельности сердечного ритма с трёхмесячным средним.",
      ],
      tiers: [
        { label: "Оптимально", description: "= недавний тренд HRV соответствует среднему или превышает его — как правило, признак хорошего восстановления." },
        { label: "Хорошо", description: "= недавний тренд HRV немного отличается от среднего, но остаётся на хорошем уровне." },
        { label: "Средне", description: "= недавний тренд HRV немного ниже среднего — возможно, что-то вас нагружает." },
        { label: "Внимание", description: "= недавний тренд HRV ниже среднего — возможный признак того, что тело или ум находятся под стрессом." },
      ],
      learnMoreLabel: "Подробнее",
      learnMoreUrl: "https://support.ouraring.com/hc/en-us/articles/360025441974",
    },
    compute: (day) => {
      const v = day.hrvRmssd ?? null;
      const color = colorFor(v, 50, 30);
      const score = v == null ? 0 : clamp(Math.round((v / 80) * 100), 0, 100);
      return { score, color, value: v != null ? String(Math.round(v)) : "–", rawValue: v };
    },
  },
  {
    key: "sleep",
    label: "Сон",
    unit: "%",
    tooltip: "Эффективность сна = минуты сна / минуты в постели.\n≥85% — хорошо.",
    detail: {
      title: "Сон",
      paragraphs: [
        "Сон оказывает большое влияние на вашу готовность к активности в течение дня. Этот показатель учитывает весь сон, включая дневной.",
        "Именно во сне происходит основная часть восстановления организма: синтез белка, регуляция гормонов и консолидация памяти.",
      ],
      tiers: [
        { label: "Оптимально", description: "= сон положительно влияет на вашу готовность сегодня." },
        { label: "Хорошо", description: "= вы получили достаточно качественного сна для ваших нужд." },
        { label: "Средне", description: "= сон был частично качественным, но его могло быть больше." },
        { label: "Внимание", description: "= больше качественного сна улучшит вашу готовность. Проверьте режим и условия сна." },
      ],
    },
    compute: (day) => {
      const v = day.sleepEfficiency ?? null;
      const color = colorFor(v, 85, 70);
      const score = v == null ? 0 : clamp(Math.round(v), 0, 100);
      return { score, color, value: v != null ? String(Math.round(v)) : "–", rawValue: v };
    },
  },
  {
    key: "activity",
    label: "Нагрузка",
    unit: "мин",
    tooltip: "Активные минуты в целевых зонах пульса\n(жиросжигание + кардио + пиковая).\n≥30 мин = норма.",
    detail: {
      title: "Баланс нагрузки",
      paragraphs: [
        "Уровень физической активности за вчерашний день — один из ключевых вкладчиков в вашу готовность.",
        "Слишком высокая нагрузка или полная неактивность одинаково снижают готовность. Если готовность низкая из-за интенсивной тренировки — восстановление со временем даст прирост физической формы.",
      ],
      tiers: [
        { label: "Оптимально", description: "= вы сбалансировали потребность в активности и отдыхе. Это повышает вашу готовность." },
        { label: "Хорошо", description: "= уровень активности поддерживает готовность. Продолжайте в том же духе." },
        { label: "Средне", description: "= активности немного не хватает или было чуть много. Незначительно снижает готовность." },
        { label: "Внимание", description: "= слишком высокая или слишком низкая нагрузка заметно влияет на готовность." },
      ],
    },
    compute: (day) => {
      const v = day.activeZoneMinutes ?? null;
      const color = colorFor(v, 30, 15);
      const score = v == null ? 0 : clamp(Math.round((v / 60) * 100), 0, 100);
      return { score, color, value: v != null ? String(Math.round(v)) : "–", rawValue: v };
    },
  },
  {
    key: "steps",
    label: "Шаги",
    unit: "шаг",
    tooltip: "Общее число шагов за день.\nЦель: ≥8 000 шагов.",
    detail: {
      title: "Ежедневные шаги",
      paragraphs: [
        "Ежедневное количество шагов — базовый показатель двигательной активности. Учитывает не только тренировки, но и обычную ходьбу в течение дня.",
        "Ходьба снижает вред от долгого сидения, улучшает кровообращение и поддерживает метаболизм. Польза начинается уже с 6 000–7 000 шагов в день.",
      ],
      tiers: [
        { label: "Отлично", description: "= ≥ 10 000 шагов. Высокая двигательная активность поддерживает здоровье." },
        { label: "Хорошо", description: "= 7 000–10 000 шагов. Достаточный уровень для большинства людей." },
        { label: "Средне", description: "= 4 000–7 000 шагов. Активности немного не хватает для оптимального самочувствия." },
        { label: "Мало", description: "= < 4 000 шагов. Постарайтесь добавить прогулки или небольшие перерывы в движение." },
      ],
    },
    compute: (day) => {
      const v = day.steps ?? null;
      const color = colorFor(v, 8000, 4000);
      const score = v == null ? 0 : clamp(Math.round((v / 12000) * 100), 0, 100);
      const fmt =
        v != null ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : "–";
      return { score, color, value: fmt, rawValue: v };
    },
  },
  {
    key: "sleep_regularity",
    label: "Регулярность сна",
    unit: "",
    tooltip: "Насколько регулярно вы засыпаете и просыпаетесь.\nОценивается за последние 2 недели.",
    detail: {
      title: "Регулярность сна",
      paragraphs: [
        "Регулярность сна показывает, насколько стабильно вы ложитесь спать и просыпаетесь на протяжении последних 2 недель. Учитываются оба показателя — время засыпания и время подъёма.",
        "Стабильный режим сна — основа хорошего качества отдыха. Он также помогает поддерживать здоровое пищеварение, гормональный баланс и дневную энергию.",
      ],
      tiers: [
        { label: "Оптимально", description: "= вы ложитесь и встаёте в одно и то же время каждый день. Продолжайте — это полезно и для тела, и для ума." },
        { label: "Хорошо", description: "= режим в целом стабильный. Редкие сдвиги — не проблема, главное — возвращаться к привычному ритму." },
        { label: "Средне", description: "= режим мог бы быть стабильнее. Начните с фиксированного времени подъёма, остальное подстроится само." },
        { label: "Внимание", description: "= режим нестабилен. Если жёсткий график невозможен — просто следите за тем, чтобы спать достаточно в любом формате." },
      ],
    },
    compute: (day) => {
      const v = day.ouraSleepRegularity ?? null;
      const color = colorFor(v, 80, 60);
      return { score: v ?? 0, color, value: v != null ? String(v) : "–", rawValue: v };
    },
  },
  {
    key: "recovery_index",
    label: "Индекс восстановления",
    unit: "",
    tooltip: "Когда ночью достигается минимальный ЧСС.\nЧем раньше — тем лучше восстановление.",
    detail: {
      title: "Индекс восстановления",
      paragraphs: [
        "Индекс восстановления отслеживает момент наступления минимального пульса в течение ночи. Это косвенный индикатор качества восстановления.",
        "Признак хорошего восстановления — когда пульс достигает минимума в первой половине ночи: организм успевает восстановиться до подъёма. Алкоголь, тяжёлый ужин или поздняя тренировка задерживают снижение пульса и ухудшают качество восстановления.",
      ],
      tiers: [
        { label: "Оптимально", description: "= минимальный пульс достигнут в первой половине ночи. Организм полностью восстановился до утра." },
        { label: "Хорошо", description: "= минимальный пульс достигнут достаточно рано. Восстановление прошло нормально." },
        { label: "Средне", description: "= минимальный пульс достигнут поздно. Возможно влияние еды, алкоголя или нагрузки перед сном." },
        { label: "Внимание", description: "= организм восстанавливался слишком медленно. Избегайте алкоголя и тяжёлой пищи за 3 часа до сна." },
      ],
    },
    compute: (day) => {
      const v = day.ouraRecoveryIndex ?? null;
      const color = colorFor(v, 80, 60);
      return { score: v ?? 0, color, value: v != null ? String(v) : "–", rawValue: v };
    },
  },
  {
    key: "activity_balance",
    label: "Баланс активности",
    unit: "",
    tooltip: "Баланс нагрузки за последние 2 недели.\nОптимально — активность без перетренированности.",
    detail: {
      title: "Баланс активности",
      paragraphs: [
        "Баланс активности оценивает уровень физической нагрузки за последние 2 недели и её влияние на вашу готовность.",
        "Оптимальный баланс означает, что вы были активны, но не превышали свои возможности восстановления. Это одновременно повышает готовность и помогает накапливать физическую форму.",
      ],
      tiers: [
        { label: "Оптимально", description: "= вы нашли баланс между нагрузкой и отдыхом. Это повышает вашу готовность." },
        { label: "Хорошо", description: "= уровень активности поддерживает готовность. Продолжайте в том же духе." },
        { label: "Средне", description: "= нагрузка немного высоковата или низковата. Незначительно снижает готовность." },
        { label: "Внимание", description: "= слишком высокая или слишком низкая нагрузка заметно влияет на готовность. Скорректируйте режим." },
      ],
    },
    compute: (day) => {
      const v = day.ouraActivityBalance ?? null;
      // Fallback: estimate from activeZoneMinutes if no Oura score
      const fallback = day.activeZoneMinutes != null
        ? clamp(Math.round((day.activeZoneMinutes / 60) * 100), 0, 100)
        : null;
      const score = v ?? fallback ?? 0;
      const color = colorFor(score, 80, 60);
      return { score, color, value: v != null ? String(v) : fallback != null ? "~" + fallback : "–", rawValue: v ?? fallback };
    },
  },
  {
    key: "body_temperature",
    label: "Температура тела",
    unit: "°C",
    tooltip: "Отклонение температуры кожи от вашей нормы.\nОколо 0°C — норма. > ±1°C — внимание.",
    detail: {
      title: "Температура тела",
      sections: [
        {
          paragraphs: [
            "Изменения температуры тела могут многое рассказать о вашем восстановлении и здоровье. Нормально, если температура поднимается после еды, алкоголя, поздней тренировки или сна в тёплом помещении.",
            "Резкий подъём температуры может сигнализировать о начале болезни. В таком случае стоит измерить температуру термометром и дать себе отдых.",
          ],
        },
        {
          heading: "Как измеряется температура",
          paragraphs: [
            "Oura Ring измеряет температуру кожи во время сна и показывает среднее отклонение от вашей личной нормы. Если отклонение явно выходит за пределы нормального диапазона (выше или ниже 0°C), показатель переходит в статус «Внимание».",
            "Кольцо обучает вашу личную норму в течение первых нескольких недель и при необходимости корректирует её.",
          ],
        },
      ],
      tiers: [
        { label: "Норма", description: "= отклонение близко к 0°C. Температура в пределах вашего обычного диапазона." },
        { label: "Небольшое отклонение", description: "= ±0.3–0.7°C. Возможно влияние физической нагрузки или окружающей среды." },
        { label: "Внимание", description: "= > ±1°C. Значительное отклонение от нормы. Проверьте самочувствие и дайте себе отдых." },
      ],
    },
    compute: (day) => {
      const v = day.skinTempDeviation ?? null;
      // Score: centered at 0, penalty for deviation
      const absV = v != null ? Math.abs(v) : null;
      const color = absV == null ? "gray" : absV < 0.3 ? "green" : absV < 0.7 ? "yellow" : "red";
      const score = absV == null ? 0 : clamp(Math.round((1 - absV / 2) * 100), 0, 100);
      const display = v != null ? (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) : "–";
      return { score, color, value: display, rawValue: v };
    },
  },
  {
    key: "spo2",
    label: "SpO₂",
    unit: "%",
    tooltip: "Насыщение крови кислородом.\nНорма ≥ 95%.\nНиже 93% — тревожный сигнал.",
    detail: {
      title: "Насыщение кислородом (SpO₂)",
      paragraphs: [
        "SpO₂ — процент гемоглобина в крови, насыщенного кислородом. Измеряется ночью, когда тело в покое и влияние внешних факторов минимально.",
        "Кратковременные снижения во сне могут быть нормой. Систематически низкие значения — повод проконсультироваться с врачом.",
      ],
      tiers: [
        { label: "Норма", description: "= ≥ 95%. Кислородное насыщение в порядке, дыхание во сне без нарушений." },
        { label: "Пограничное", description: "= 93–94%. Стоит понаблюдать за динамикой в течение нескольких ночей." },
        { label: "Внимание", description: "= < 93% систематически. Возможны нарушения дыхания во сне (апноэ). Рекомендуется консультация врача." },
      ],
    },
    compute: (day) => {
      const v = day.spo2 ?? null;
      const color = colorFor(v, 95, 93);
      const score = v == null ? 0 : clamp(Math.round(((v - 90) / 10) * 100), 0, 100);
      return { score, color, value: v != null ? `${v.toFixed(0)}` : "–", rawValue: v };
    },
  },
];

// ---- Color map ----

const COLOR_VAR: Record<ContributorColor, string> = {
  green: "var(--color-status-normal)",
  yellow: "var(--color-status-borderline)",
  red: "var(--color-status-high)",
  gray: "var(--color-fill-quaternary)",
};

// ---- Progress bar (animated on mount) ----

function ProgressBar({
  score,
  color,
  animate,
  height = 5,
}: {
  score: number;
  color: ContributorColor;
  animate: boolean;
  height?: number;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: height / 2,
        background: "var(--color-fill-quaternary)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: height / 2,
          background: COLOR_VAR[color],
          width: animate ? `${score}%` : "0%",
          transition: animate ? "width 0.7s ease" : "none",
        }}
      />
    </div>
  );
}

// ============================================================
// MetricDetailSheet — Oura-style bottom sheet
// ============================================================

interface MetricDetailSheetProps {
  contributorKey: string | null;
  contributors: Array<{ def: ContributorDef; result: ContributorResult }>;
  onClose: () => void;
}

function MetricDetailSheet({ contributorKey, contributors, onClose }: MetricDetailSheetProps) {
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(contributorKey);

  // Animate in when opened
  useEffect(() => {
    if (contributorKey != null) {
      setKey(contributorKey);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
    }
  }, [contributorKey]);

  // Swipe-to-close
  const startY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (startY.current == null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy > 80) handleClose();
    startY.current = null;
  }

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  const idx = contributors.findIndex((c) => c.def.key === key);
  const current = idx >= 0 ? contributors[idx] : null;

  function navigate(dir: -1 | 1) {
    const next = (idx + dir + contributors.length) % contributors.length;
    setKey(contributors[next].def.key);
  }

  if (contributorKey == null && !visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 101,
          background: "#1c1c1e",
          borderRadius: "20px 20px 0 0",
          maxHeight: "78vh",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          boxShadow: "0 -4px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.2)",
            }}
          />
        </div>

        {/* Thin progress bar */}
        {current && (
          <div style={{ padding: "0 20px 12px" }}>
            <ProgressBar score={current.result.score} color={current.result.color} animate height={6} />
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>
          {current && (
            <>
              {/* Title */}
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.95)",
                  textAlign: "center",
                  marginBottom: 18,
                  lineHeight: 1.25,
                }}
              >
                {current.def.detail.title}
              </h2>

              {/* Current value badge */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 5,
                    background: `${COLOR_VAR[current.result.color]}22`,
                    border: `1px solid ${COLOR_VAR[current.result.color]}44`,
                    borderRadius: 12,
                    padding: "6px 14px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      color: COLOR_VAR[current.result.color],
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {current.result.value}
                  </span>
                  {current.result.rawValue != null && (
                    <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}>
                      {current.def.unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Content: sections with optional bold sub-headers, or flat paragraphs */}
              {(current.def.detail.sections ?? (current.def.detail.paragraphs ? [{ paragraphs: current.def.detail.paragraphs }] : [])).map((section, si) => (
                <div key={si}>
                  {section.heading && (
                    <p
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.95)",
                        marginBottom: 10,
                        marginTop: si > 0 ? 4 : 0,
                        lineHeight: 1.35,
                      }}
                    >
                      {section.heading}
                    </p>
                  )}
                  {section.paragraphs.map((p, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: "0.9375rem",
                        lineHeight: 1.6,
                        color: "rgba(255,255,255,0.78)",
                        marginBottom: 14,
                      }}
                    >
                      {p}
                    </p>
                  ))}
                </div>
              ))}

              {/* Tiers — Oura style: Bold label = description */}
              {current.def.detail.tiers.length > 0 && (
                <div style={{ marginTop: 4, marginBottom: 4 }}>
                  {current.def.detail.tiers.map((tier, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: "0.9375rem",
                        lineHeight: 1.6,
                        color: "rgba(255,255,255,0.78)",
                        marginBottom: 12,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
                        {tier.label}
                      </span>
                      {" "}{tier.description}
                    </p>
                  ))}
                </div>
              )}

              {/* Learn more link */}
              {current.def.detail.learnMoreUrl && (
                <a
                  href={current.def.detail.learnMoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    fontSize: "0.9375rem",
                    color: "rgba(255,255,255,0.6)",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  {current.def.detail.learnMoreLabel ?? "Подробнее"}
                </a>
              )}

              <div style={{ height: 8 }} />
            </>
          )}
        </div>

        {/* Bottom navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 28px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              fontSize: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            ‹
          </button>

          <button
            onClick={handleClose}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "rgba(255,255,255,0.8)",
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 500,
            }}
          >
            ✕
          </button>

          <button
            onClick={() => navigate(1)}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              fontSize: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            ›
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Key Metric tile (2×2 grid, Oura-style) ----

interface KeyMetricTileProps {
  label: string;
  currentValue: number | null;
  unit: string;
  tooltip?: string;
  onClick?: () => void;
}

function KeyMetricTile({ label, currentValue, unit, tooltip, onClick }: KeyMetricTileProps) {
  const [hovered, setHovered] = useState(false);
  const displayVal = currentValue != null ? Math.round(currentValue) : "–";

  const inner = (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(255,255,255,0.06)" : "var(--color-bg-tertiary)",
        borderRadius: 12,
        padding: "12px 14px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flex: "1 1 calc(50% - 5px)",
        minWidth: 0,
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.15s",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--color-text-secondary)",
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        <span style={{ color: "var(--color-text-tertiary)", fontSize: 13, lineHeight: 1 }}>›</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span
          className="tabular"
          style={{
            fontSize: currentValue != null ? "1.5rem" : "1.25rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: currentValue != null ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            lineHeight: 1,
          }}
        >
          {displayVal}
        </span>
        {currentValue != null && (
          <span style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", lineHeight: 1 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} side="top">
        {inner}
      </Tooltip>
    );
  }

  return inner;
}

// ---- 14-day trend line chart with hover + touch crosshair ----

interface TrendPoint {
  date: string;
  value: number | null;
}

interface TrendLineChartProps {
  points: TrendPoint[];
  lineColor: string;
  height?: number;
  noDataText?: string;
  unit?: string;
}

function TrendLineChart({ points, lineColor, height = 84, noDataText = "Нет данных", unit = "" }: TrendLineChartProps) {
  const valid = points.filter((p): p is { date: string; value: number } => p.value != null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; date: string; value: number } | null>(null);

  if (valid.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-tertiary)",
          fontSize: "0.8125rem",
          background: "rgba(0,0,0,0.18)",
          borderRadius: 8,
        }}
      >
        {noDataText}
      </div>
    );
  }

  const W = 300;
  const yAxisW = 32;
  const xPad = 6;
  const innerW = W - yAxisW - xPad;
  const topPad = 6;
  const bottomPad = 20;
  const innerH = height - topPad - bottomPad;

  const values = valid.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin || 1;
  const vMin = rawMin - range * 0.1;
  const vMax = rawMax + range * 0.1;
  const vRange = vMax - vMin || 1;

  const n = points.length;
  const xScale = (i: number) => xPad + (i / (n - 1)) * innerW;
  const yScale = (v: number) => topPad + (1 - (v - vMin) / vRange) * innerH;

  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  points.forEach((p, i) => {
    const x = xScale(i);
    if (p.value != null) {
      const y = yScale(p.value);
      current.push({ x, y });
    } else {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
  });
  if (current.length >= 2) segments.push(current);

  function toPath(pts: Array<{ x: number; y: number }>) {
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }

  function toArea(pts: Array<{ x: number; y: number }>) {
    const baseline = topPad + innerH;
    const line = toPath(pts);
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L${last.x.toFixed(1)},${baseline.toFixed(1)} L${first.x.toFixed(1)},${baseline.toFixed(1)} Z`;
  }

  const gridCount = 3;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const frac = i / (gridCount - 1);
    const v = vMax - frac * vRange;
    const y = topPad + frac * innerH;
    return { y, label: Math.round(v) };
  });

  const step = Math.max(1, Math.ceil(n / 4));
  const xLabels = points
    .map((p, i) => ({ i, date: p.date }))
    .filter((_, i) => i === 0 || i === n - 1 || i % step === 0);

  const gradientId = `trendGrad_${lineColor.replace(/[^a-z0-9]/gi, "")}`;

  function computeCrosshair(clientX: number, rect: DOMRect) {
    const scaleX = W / rect.width;
    const svgX = (clientX - rect.left) * scaleX;

    let nearest = 0;
    let minDist = Infinity;
    points.forEach((_, i) => {
      const dist = Math.abs(xScale(i) - svgX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    });

    const pt = points[nearest];
    if (pt.value == null) {
      setCrosshair(null);
      return;
    }
    setCrosshair({ x: xScale(nearest), y: yScale(pt.value), date: pt.date, value: pt.value });
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    computeCrosshair(e.clientX, svg.getBoundingClientRect());
  }

  function handleTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    e.preventDefault();
    computeCrosshair(e.touches[0].clientX, svg.getBoundingClientRect());
  }

  function handleTouchEnd() {
    setCrosshair(null);
  }

  function fmtDate(d: string) {
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}` : d;
  }

  return (
    <div
      style={{
        borderRadius: 8,
        overflow: "visible",
        background: "rgba(0,0,0,0.22)",
        padding: "4px 0 0",
        position: "relative",
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        height={height}
        style={{ display: "block", overflow: "visible", touchAction: "none" }}
        aria-hidden="true"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCrosshair(null)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.30" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={xPad} y1={g.y} x2={xPad + innerW} y2={g.y}
              stroke="rgba(255,255,255,0.08)" strokeWidth={1}
            />
            <text x={W - 4} y={g.y + 4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.35)" fontFamily="inherit">
              {g.label}
            </text>
          </g>
        ))}

        {segments.map((seg, si) => (
          <path key={`area-${si}`} d={toArea(seg)} fill={`url(#${gradientId})`} />
        ))}
        {segments.map((seg, si) => (
          <path key={`line-${si}`} d={toPath(seg)} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {valid.map((p, i) => {
          const xi = points.findIndex((pt) => pt.date === p.date && pt.value === p.value);
          return <circle key={i} cx={xScale(xi)} cy={yScale(p.value)} r={2.5} fill={lineColor} />;
        })}

        {crosshair && (
          <>
            <line x1={crosshair.x} x2={crosshair.x} y1={topPad} y2={topPad + innerH}
              stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={crosshair.x} cy={crosshair.y} r={4} fill={lineColor} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
          </>
        )}

        {xLabels.map(({ i, date }) => {
          const parts = date.split("-");
          const label = parts.length === 3 ? `${parts[2]}.${parts[1]}` : date;
          const x = xScale(i);
          const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
          return (
            <text key={i} x={x} y={height - 4} textAnchor={anchor} fontSize={9} fill="rgba(255,255,255,0.35)" fontFamily="inherit">
              {label}
            </text>
          );
        })}
      </svg>

      {crosshair && (
        <div
          style={{
            position: "absolute",
            top: 4,
            left: `${(crosshair.x / W) * 100}%`,
            transform: crosshair.x > W * 0.65 ? "translateX(-110%)" : "translateX(8px)",
            pointerEvents: "none",
            zIndex: 20,
            background: "#1c1c1e",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.9)",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{fmtDate(crosshair.date)}</div>
          <div style={{ fontWeight: 600, color: lineColor }}>
            {Math.round(crosshair.value)}{unit ? ` ${unit}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}


// ---- Range Selector ----

const RANGE_OPTIONS = [7, 14, 30] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

function RangeSelector({ value, onChange }: { value: RangeDays; onChange: (v: RangeDays) => void }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: 3,
      }}
    >
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            flex: 1,
            padding: "4px 8px",
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 600,
            transition: "all 0.15s",
            background: value === opt ? "rgba(255,255,255,0.15)" : "transparent",
            color: value === opt ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)",
          }}
        >
          {opt}д
        </button>
      ))}
    </div>
  );
}

// ---- Main component ----

interface OuraContributorsProps {
  memberId: string;
}


export function OuraContributors({ memberId }: OuraContributorsProps) {
  const [wearables, setWearables] = useState<WearablesDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);
  const animRef = useRef(false);
  const [rangeDays, setRangeDays] = useState<RangeDays>(14);
  const [openContributor, setOpenContributor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAnimated(false);
    animRef.current = false;

    fetch(`/api/wearables?member=${encodeURIComponent(memberId)}&days=${rangeDays}`)
      .then<WearablesResponse>((r) => (r.ok ? r.json() : { daily: [] }))
      .then((w) => {
        if (!cancelled) setWearables(w.daily ?? []);
      })
      .catch(() => {
        if (!cancelled) setWearables([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [memberId, rangeDays]);

  useEffect(() => {
    if (!loading && wearables && !animRef.current) {
      animRef.current = true;
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => setAnimated(true));
        return () => cancelAnimationFrame(raf2);
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [loading, wearables]);

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-card shadow-card" style={{ padding: "16px 0 0" }}>
        <div style={{ padding: "0 16px 12px" }}>
          <div className="animate-pulse" style={{ height: 10, width: 80, borderRadius: 5, background: "var(--color-fill-quaternary)" }} />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ padding: "14px 16px", borderBottom: i < 5 ? "1px solid var(--color-separator)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="animate-pulse" style={{ height: 14, width: 110, borderRadius: 6, background: "var(--color-fill-quaternary)" }} />
              <div className="animate-pulse" style={{ height: 14, width: 44, borderRadius: 6, background: "var(--color-fill-quaternary)" }} />
            </div>
            <div className="animate-pulse" style={{ height: 5, borderRadius: 2.5, background: "var(--color-fill-quaternary)" }} />
          </div>
        ))}
      </div>
    );
  }

  const days = wearables ?? [];

  const today = [...days].reverse().find(
    (d) =>
      d.restingHeartRate != null ||
      d.hrvRmssd != null ||
      d.sleepEfficiency != null ||
      d.activeZoneMinutes != null ||
      d.steps != null ||
      d.spo2 != null,
  );

  if (!today) {
    return (
      <div className="bg-bg-secondary rounded-card shadow-card p-5 text-callout text-text-secondary">
        Нет данных от носимого устройства. Синхронизируйте Google Fit или Fitbit.
      </div>
    );
  }

  const contributors = CONTRIBUTORS.map((def) => ({ def, result: def.compute(today) }));

  const rhrCurrent = today.restingHeartRate ?? null;
  const hrvCurrent = today.hrvRmssd ?? null;
  const spo2Current = today.spo2 ?? null;
  const azmCurrent = today.activeZoneMinutes ?? null;

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const rhrPoints: TrendPoint[] = days.map((d) => ({ date: d.date, value: d.restingHeartRate ?? null }));
  const hrvPoints: TrendPoint[] = days.map((d) => ({ date: d.date, value: d.hrvRmssd ?? null }));
  const sleepPoints: TrendPoint[] = days.map((d) => ({ date: d.date, value: d.sleepEfficiency ?? null }));
  const stepsPoints: TrendPoint[] = days.map((d) => ({ date: d.date, value: d.steps ?? null }));
  const spo2Points: TrendPoint[] = days.map((d) => ({ date: d.date, value: d.spo2 ?? null }));
  const azmPoints: TrendPoint[] = days.map((d) => ({ date: d.date, value: d.activeZoneMinutes ?? null }));

  const rhrValues = days.map((d) => d.restingHeartRate).filter((v): v is number => v != null);
  const hrvValues = days.map((d) => d.hrvRmssd).filter((v): v is number => v != null);
  const sleepValues = days.map((d) => d.sleepEfficiency).filter((v): v is number => v != null);
  const stepsValues = days.map((d) => d.steps).filter((v): v is number => v != null);
  const spo2Values = days.map((d) => d.spo2).filter((v): v is number => v != null);
  const azmValues = days.map((d) => d.activeZoneMinutes).filter((v): v is number => v != null);

  const rhrAvg = avg(rhrValues);
  const rhrMax = rhrValues.length ? Math.max(...rhrValues) : null;
  const hrvAvg = avg(hrvValues);
  const hrvMax = hrvValues.length ? Math.max(...hrvValues) : null;
  const sleepAvg = avg(sleepValues);
  const sleepMax = sleepValues.length ? Math.max(...sleepValues) : null;
  const stepsAvg = avg(stepsValues);
  const stepsMax = stepsValues.length ? Math.max(...stepsValues) : null;
  const spo2Avg = spo2Values.length ? Math.round(spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length * 10) / 10 : null;
  const spo2Max = spo2Values.length ? Math.max(...spo2Values) : null;
  const azmAvg = avg(azmValues);
  const azmMax = azmValues.length ? Math.max(...azmValues) : null;

  // Build detail cards only for metrics that have at least 2 data points
  const detailCards = [
    { title: "LOWEST HEART RATE", tooltip: "ЧСС покоя за период. Тренд вниз = улучшение. Норма: 50–65 bpm.", value: rhrCurrent, unit: "уд/мин", avg: rhrAvg, max: rhrMax, points: rhrPoints, color: "#ff375f", subLabel: "Среднее" },
    { title: "AVERAGE HRV", tooltip: "HRV за период. Тренд вверх = лучше. Норма > 50 мс.", value: hrvCurrent, unit: "мс", avg: hrvAvg, max: hrvMax, points: hrvPoints, color: "#30d158", subLabel: "Макс." },
    { title: "SLEEP EFFICIENCY", tooltip: "Эффективность сна. ≥85% — хорошо.", value: today.sleepEfficiency ?? null, unit: "%", avg: sleepAvg, max: sleepMax, points: sleepPoints, color: "#5e5ce6", subLabel: "Среднее" },
    { title: "STEPS", tooltip: "Шаги за день. Цель: 8 000+.", value: today.steps ?? null, unit: "шаг", avg: stepsAvg, max: stepsMax, points: stepsPoints, color: "#ffd60a", subLabel: "Среднее" },
    { title: "SpO₂", tooltip: "Насыщение кислородом. Норма ≥95%.", value: today.spo2 ?? null, unit: "%", avg: spo2Avg, max: spo2Max, points: spo2Points, color: "#64d2ff", subLabel: "Среднее" },
    { title: "ACTIVE ZONE MINUTES", tooltip: "Активные минуты в зонах пульса. Норма: ≥30 мин/день.", value: azmCurrent, unit: "мин", avg: azmAvg, max: azmMax, points: azmPoints, color: "#ff9f0a", subLabel: "Среднее" },
  ].filter((c) => c.points.filter((p) => p.value != null).length >= 1);

  return (
    <>
      <div className="bg-bg-secondary rounded-card shadow-card">
        {/* Header + range selector */}
        <div style={{ padding: "16px 16px 4px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
              Готовность
            </p>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", marginTop: 2 }}>
              {today.date}
            </p>
          </div>
          <RangeSelector value={rangeDays} onChange={setRangeDays} />
        </div>

        {/* Contributors */}
        <div style={{ marginTop: 8 }}>
          {contributors.map(({ def, result }, idx) => {
            const isLast = idx === contributors.length - 1;
            return (
              <div
                key={def.key}
                onClick={() => setOpenContributor(def.key)}
                style={{
                  padding: "14px 16px",
                  borderBottom: isLast ? undefined : "1px solid var(--color-separator)",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  WebkitTapHighlightColor: "transparent",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span
                      style={{
                        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                        background: COLOR_VAR[result.color], flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                      {def.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                      <span
                        className="tabular"
                        style={{
                          fontSize: "0.9375rem", fontWeight: 600,
                          color: result.rawValue != null ? "var(--color-text-primary)" : "var(--color-text-quaternary)",
                        }}
                      >
                        {result.value}
                      </span>
                      {result.rawValue != null && (
                        <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>{def.unit}</span>
                      )}
                    </div>
                    <span style={{ color: "var(--color-text-quaternary)", fontSize: 14 }}>›</span>
                  </div>
                </div>
                <ProgressBar score={result.score} color={result.color} animate={animated} />
              </div>
            );
          })}
        </div>

        {/* Key Metrics */}
        <div style={{ borderTop: "1px solid var(--color-separator)", padding: "14px 16px" }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: 10 }}>
            Ключевые метрики
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <KeyMetricTile
              label="ЧСС покоя" currentValue={rhrCurrent} unit="уд/мин"
              tooltip="Пульс в покое. Норма < 65 bpm. Выше — стресс или усталость."
              onClick={() => setOpenContributor("rhr")}
            />
            <KeyMetricTile
              label="Вариабельность сердечного ритма" currentValue={hrvCurrent} unit="мс"
              tooltip="HRV — вариабельность ритма. Выше = лучше. Норма > 50 мс."
              onClick={() => setOpenContributor("hrv")}
            />
            <KeyMetricTile
              label="SpO₂" currentValue={spo2Current} unit="%"
              tooltip="Насыщение крови кислородом. Норма ≥ 95%. Ниже 93% — тревога."
              onClick={() => setOpenContributor("spo2")}
            />
            <KeyMetricTile
              label="Активные минуты" currentValue={azmCurrent} unit="мин"
              tooltip="Минуты в целевых зонах пульса. ≥30 мин в день = норма ВОЗ."
              onClick={() => setOpenContributor("activity")}
            />
          </div>
        </div>

        {/* Details charts — full-width stacked, Oura style */}
        <div style={{ borderTop: "1px solid var(--color-separator)" }}>
          <div style={{ padding: "14px 16px 4px" }}>
            <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
              Детали · {rangeDays} дн
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {detailCards.map((card, idx) => (
              <div
                key={card.title}
                style={{
                  borderTop: idx === 0 ? undefined : "1px solid var(--color-separator)",
                  padding: "14px 16px",
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  {card.tooltip ? (
                    <Tooltip content={card.tooltip} side="top">
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-secondary)", cursor: "default", borderBottom: "1px dashed rgba(255,255,255,0.18)" }}>
                        {card.title}
                      </span>
                    </Tooltip>
                  ) : (
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
                      {card.title}
                    </span>
                  )}
                  <span style={{ color: "var(--color-text-quaternary)", fontSize: 14 }}>›</span>
                </div>

                {/* Current value */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 3 }}>
                  <span className="tabular" style={{ fontSize: card.value != null ? "1.75rem" : "1.375rem", fontWeight: 700, letterSpacing: "-0.02em", color: card.value != null ? "var(--color-text-primary)" : "var(--color-text-tertiary)", lineHeight: 1 }}>
                    {card.value != null
                      ? (card.unit === "шаг" && card.value >= 1000
                          ? `${(card.value / 1000).toFixed(1)}k`
                          : Math.round(card.value))
                      : "–"}
                  </span>
                  {card.value != null && (
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>{card.unit}</span>
                  )}
                </div>

                {/* Sub-stats */}
                <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>
                    {card.subLabel} {card.avg != null ? (card.unit === "шаг" && card.avg >= 1000 ? `${(card.avg / 1000).toFixed(1)}k` : card.avg) : "–"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>
                    Макс. {card.max != null ? (card.unit === "шаг" && card.max >= 1000 ? `${(card.max / 1000).toFixed(1)}k` : Math.round(card.max)) : "–"}
                  </span>
                </div>

                {/* Chart — full width, taller */}
                <TrendLineChart points={card.points} lineColor={card.color} height={96} noDataText="Нет данных" unit={card.unit === "шаг" ? "" : card.unit} />
              </div>
            ))}
          </div>
          <div style={{ height: 8 }} />
        </div>
      </div>

      {/* Detail bottom sheet */}
      <MetricDetailSheet
        contributorKey={openContributor}
        contributors={contributors}
        onClose={() => setOpenContributor(null)}
      />
    </>
  );
}
