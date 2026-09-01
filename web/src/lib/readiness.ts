import type { WearablesDaily } from "@/lib/store";

/**
 * Readiness score (0–100) — взвешенная комбинация из wearables:
 *   40% HRV RMSSD  (норма ~80 мс = 100 баллов)
 *   30% Resting HR (50 bpm = 100, 80 bpm = 0)
 *   20% Sleep efficiency (0–100, как есть)
 *   10% SpO₂       (95% = 50, 100% = 100)
 *
 * Если данных нет — компонент берёт нейтральное значение 50,
 * чтобы отсутствие одного сенсора не обнуляло весь score.
 * Если нет ни HRV, ни RHR — возвращает null (данных недостаточно).
 */
export function calculateReadiness(day: WearablesDaily): number | null {
  const { hrvRmssd, restingHeartRate, sleepEfficiency, spo2 } = day;

  // Без хотя бы одного кардио-показателя score бессмысленен
  if (hrvRmssd == null && restingHeartRate == null) return null;

  const hrvScore   = hrvRmssd        != null ? Math.min(hrvRmssd / 80 * 100, 100)              : 50;
  const rhrScore   = restingHeartRate != null ? Math.max((80 - restingHeartRate) / 30 * 100, 0) : 50;
  const sleepScore = sleepEfficiency  != null ? sleepEfficiency                                  : 50;
  const spo2Score  = spo2             != null ? Math.max((spo2 - 90) / 10 * 100, 0)             : 90;

  const raw = 0.4 * hrvScore + 0.3 * rhrScore + 0.2 * sleepScore + 0.1 * spo2Score;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}

/** Цвет кольца/точки по значению score */
export function readinessColor(score: number): "status-normal" | "status-borderline" | "status-high" {
  if (score >= 67) return "status-normal";
  if (score >= 33) return "status-borderline";
  return "status-high";
}

/** Текстовое описание уровня */
export function readinessLabel(score: number): string {
  if (score >= 80) return "Отличная";
  if (score >= 67) return "Хорошая";
  if (score >= 50) return "Средняя";
  if (score >= 33) return "Пониженная";
  return "Низкая";
}
