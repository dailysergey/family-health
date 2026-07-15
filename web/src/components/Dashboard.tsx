import type { MemberBundle } from "@/lib/types";
import { ageLabel, groupLabs } from "@/lib/ui";
import { LabGroup } from "@/components/LabGroup";
import { DiagnosisCard } from "@/components/widgets/DiagnosisCard";
import { TrendChartCard } from "@/components/widgets/TrendChartCard";
import { MetricRing } from "@/components/widgets/MetricRing";
import { DocumentList } from "@/components/DocumentList";
import { UploadDropzone } from "@/components/UploadDropzone";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-title-1 text-text-primary mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function Dashboard({ bundle, conversationId }: { bundle: MemberBundle; conversationId: string }) {
  const { member, diagnoses, labs, metrics, documents } = bundle;
  const activeDx = diagnoses.filter((d) => d.status === "active");
  const normal = labs.filter((l) => l.status === "normal").length;
  const normalPct = labs.length ? Math.round((normal / labs.length) * 100) : 0;
  const attention = labs.filter((l) => l.status !== "normal").length;

  return (
    <main className="flex-1 min-w-0 md:h-screen md:overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-large-title text-text-primary">{member.name}</h1>
          <p className="text-callout text-text-secondary mt-1">
            {[member.relation, ageLabel(member.birthDate)].filter(Boolean).join(" · ")}
          </p>
        </header>

        {/* Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricRing
            label="Анализы в норме"
            value={`${normalPct}%`}
            percent={normalPct}
            category="nutrition"
            caption={`${normal} из ${labs.length}`}
            size={104}
          />
          <div className="bg-bg-secondary rounded-card shadow-card p-5 flex flex-col justify-center">
            <div className="text-large-title tabular text-text-primary">{activeDx.length}</div>
            <div className="text-callout text-text-secondary mt-1">Активных диагнозов</div>
          </div>
          <div className="bg-bg-secondary rounded-card shadow-card p-5 flex flex-col justify-center">
            <div className="text-large-title tabular" style={{ color: attention ? "var(--color-status-high)" : "var(--color-status-normal)" }}>
              {attention}
            </div>
            <div className="text-callout text-text-secondary mt-1">Требуют внимания</div>
          </div>
        </div>

        {diagnoses.length > 0 && (
          <Section title="Диагнозы">
            <div className="space-y-4">
              {diagnoses.map((d) => (
                <DiagnosisCard key={d.id} {...d} />
              ))}
            </div>
          </Section>
        )}

        {labs.length > 0 && (
          <Section title="Анализы и обследования">
            <div className="space-y-2">
              {groupLabs(labs).map((g) => (
                <LabGroup key={g.title} title={g.title} labs={g.labs} />
              ))}
            </div>
          </Section>
        )}

        {metrics.length > 0 && (
          <Section title="Динамика">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {metrics.map((m) => {
                const delta =
                  m.series.length >= 2 ? m.series[m.series.length - 1].value - m.series[m.series.length - 2].value : undefined;
                return (
                  <TrendChartCard
                    key={m.id}
                    title={m.name}
                    unit={m.unit}
                    category={m.category}
                    data={m.series}
                    delta={delta}
                  />
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Документы">
          <div className="space-y-4">
            <UploadDropzone memberId={member.id} conversationId={conversationId} />
            <DocumentList documents={documents} memberId={member.id} />
          </div>
        </Section>
      </div>
    </main>
  );
}
