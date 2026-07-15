"use client";

import type { WidgetType } from "@/lib/agui";
import { LabCard, type LabCardProps } from "@/components/widgets/LabCard";
import { MetricRing, type MetricRingProps } from "@/components/widgets/MetricRing";
import { TrendChartCard, type TrendChartProps } from "@/components/widgets/TrendChartCard";
import { SummaryCard, type SummaryCardProps } from "@/components/widgets/SummaryCard";
import { DiagnosisCard, type DiagnosisCardProps } from "@/components/widgets/DiagnosisCard";
import { ReportCard, type ReportCardProps } from "@/components/widgets/ReportCard";

// LLMs sometimes pass widget props as a JSON string instead of an object.
// Normalize so spreading {...props} yields real keys (a spread string would
// otherwise produce character-indexed keys and undefined fields → crashes).
function normalizeProps(props: unknown): Record<string, unknown> {
  if (typeof props === "string") {
    try {
      const parsed = JSON.parse(props);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return props && typeof props === "object" ? (props as Record<string, unknown>) : {};
}

export function WidgetRenderer({ widgetType, props }: { widgetType: WidgetType; props: unknown }) {
  const p = normalizeProps(props);
  switch (widgetType) {
    case "lab_card":
      return <LabCard {...(p as unknown as LabCardProps)} />;
    case "metric_ring":
      return <MetricRing {...(p as unknown as MetricRingProps)} />;
    case "trend_chart":
      return <TrendChartCard {...(p as unknown as TrendChartProps)} />;
    case "summary":
      return <SummaryCard {...(p as unknown as SummaryCardProps)} />;
    case "diagnosis_card":
      return <DiagnosisCard {...(p as unknown as DiagnosisCardProps)} />;
    case "report":
      return <ReportCard {...(p as unknown as ReportCardProps)} />;
    default:
      return <FallbackWidget widgetType={widgetType} props={props} />;
  }
}

function FallbackWidget({ widgetType, props }: { widgetType: string; props: unknown }) {
  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-4">
      <div className="text-caption-2 uppercase tracking-wide text-text-tertiary mb-2">{widgetType}</div>
      <pre className="text-footnote text-text-secondary whitespace-pre-wrap break-words">
        {JSON.stringify(props, null, 2)}
      </pre>
    </div>
  );
}
