import type { Diagnosis } from "@/lib/types";
import { Section } from "./primitives";

const STATUS: Record<Diagnosis["status"], { label: string; tag: string }> = {
  active: { label: "активен", tag: "tag tag-accent" },
  remission: { label: "ремиссия", tag: "tag tag-accent-2" },
  resolved: { label: "разрешён", tag: "tag tag-neutral" },
};

const ORDER: Record<Diagnosis["status"], number> = { active: 0, remission: 1, resolved: 2 };

function since(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // day+month gives the genitive («мая»), then drop the day
  const s = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  return `с ${s.replace(/^\d+\s/, "").replace(" г.", "")}`;
}

export function DiagnosesSection({ diagnoses }: { diagnoses: Diagnosis[] }) {
  if (diagnoses.length === 0) return null;
  const sorted = [...diagnoses].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.date.localeCompare(a.date));
  return (
    <Section id="diagnoses" title="Диагнозы">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {sorted.map((d) => {
          const s = STATUS[d.status] ?? STATUS.active;
          return (
            <div key={d.id} className="o-card px-5 py-[18px] gap-2.5 flex flex-col">
              <div className="flex justify-between gap-2.5 items-start">
                <span className="text-[15px] font-semibold leading-snug">{d.title}</span>
                <span className={`${s.tag} shrink-0`}>{s.label}</span>
              </div>
              <span className="text-xs text-muted">
                {[d.icd10, since(d.date), d.doctor].filter(Boolean).join(" · ")}
              </span>
              {d.description && (
                <p className="text-[13px] leading-snug line-clamp-3 m-0" style={{ color: "var(--color-neutral-800)" }} title={d.description}>
                  {d.description}
                </p>
              )}
              {d.medications?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {d.medications.map((m) => (
                    <span key={m} className="text-xs px-2.5 py-[3px] rounded-full" style={{ background: "var(--color-neutral-200)" }}>
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
