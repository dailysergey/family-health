"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { MemberBundle } from "@/lib/types";
import { accentVar, ageLabel, initials } from "@/lib/ui";
import { dmy } from "@/lib/labs";
import { TrendChartCard } from "@/components/widgets/TrendChartCard";
import { FitnessSection } from "@/components/FitnessSection";
import { Overview } from "@/components/dashboard/Overview";
import { TodaySection } from "@/components/dashboard/TodaySection";
import { LabsSection } from "@/components/dashboard/LabsSection";
import { NutritionSection } from "@/components/dashboard/NutritionSection";
import { DiagnosesSection } from "@/components/dashboard/DiagnosesSection";
import { DocumentsSection, type DocumentsHandle } from "@/components/dashboard/DocumentsSection";
import { Section } from "@/components/dashboard/primitives";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Dashboard({
  bundle,
  conversationId,
  assistantButtonClass,
  onOpenAssistant,
}: {
  bundle: MemberBundle;
  conversationId: string;
  /** Responsive visibility of the «Ассистент» button (shown while the chat column is hidden). */
  assistantButtonClass?: string;
  onOpenAssistant?: () => void;
}) {
  const { member, diagnoses, labs, metrics, documents } = bundle;
  const [selectedLab, setSelectedLab] = useState<string | null>(null);
  const docsRef = useRef<DocumentsHandle>(null);
  const hasWearables = !!member.wearables?.enabled;
  const hasData = labs.length > 0 || diagnoses.length > 0;

  const updated = [...labs.map((l) => l.date), ...documents.map((d) => d.addedAt)].sort().pop();
  const meta = [member.relation, ageLabel(member.birthDate)].filter(Boolean).join(" · ");

  const nav = [
    { id: "today", label: "Сегодня", show: true },
    { id: "labs", label: "Анализы", show: true },
    { id: "dynamics", label: "Динамика", show: metrics.length > 0 },
    { id: "meals", label: "Питание", show: true },
    { id: "diagnoses", label: "Диагнозы", show: diagnoses.length > 0 },
    { id: "docs", label: "Документы", show: true },
  ].filter((n) => n.show);

  const pickLab = (id: string) => {
    setSelectedLab(id);
    scrollToId("labs");
  };

  return (
    <main className="flex-1 min-w-0 md:h-screen md:overflow-y-auto">
      <div id="dashboard-top" className="h-px" aria-hidden />
      <div className="max-w-[1040px] px-[18px] sm:px-[clamp(18px,3vw,40px)] pt-8 pb-20 flex flex-col gap-10">
        <header className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-[18px] flex-wrap">
            <span
              className="w-16 h-16 rounded-full grid place-items-center font-bold text-[22px] shrink-0"
              style={{ background: accentVar(member.accent), color: "var(--color-neutral-100)" }}
            >
              {initials(member.name)}
            </span>
            <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <h1 className="font-heading text-[30px] sm:text-[38px] leading-[1.05] m-0">{member.name}</h1>
              <span className="text-sm text-muted">
                {meta}
                {hasData && updated ? ` · данные от ${dmy(updated)}` : hasData ? "" : " · данных пока нет"}
              </span>
            </div>
            {onOpenAssistant && (
              <button type="button" className={`btn btn-primary gap-2 ${assistantButtonClass ?? ""}`} onClick={onOpenAssistant}>
                <Sparkles size={16} strokeWidth={2.5} />
                Ассистент
              </button>
            )}
          </div>
          <nav className="flex gap-2 flex-wrap">
            {nav.map((n) => (
              <button key={n.id} type="button" className="btn btn-secondary text-[13px] px-4 py-[7px]" onClick={() => scrollToId(n.id)}>
                {n.label}
              </button>
            ))}
          </nav>
        </header>

        {hasData && <Overview labs={labs} diagnoses={diagnoses} onPickLab={pickLab} />}

        <TodaySection
          memberId={member.id}
          enabled={hasWearables}
          device={member.wearables?.device}
          extra={hasWearables ? <FitnessSection memberId={member.id} /> : undefined}
        />

        <LabsSection
          labs={labs}
          selectedId={selectedLab}
          onSelect={setSelectedLab}
          onUpload={() => docsRef.current?.pickFiles()}
        />

        {metrics.length > 0 && (
          <Section id="dynamics" title="Динамика">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {metrics.map((m) => {
                const delta =
                  m.series.length >= 2 ? m.series[m.series.length - 1].value - m.series[m.series.length - 2].value : undefined;
                return (
                  <TrendChartCard key={m.id} title={m.name} unit={m.unit} category={m.category} data={m.series} delta={delta} />
                );
              })}
            </div>
          </Section>
        )}

        <NutritionSection memberId={member.id} />

        <DiagnosesSection diagnoses={diagnoses} />

        <DocumentsSection ref={docsRef} documents={documents} memberId={member.id} conversationId={conversationId} />
      </div>
    </main>
  );
}
