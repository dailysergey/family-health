import type { ReactNode } from "react";

interface DeviceCardProps {
  icon: ReactNode;
  name: string;
  description: string;
  connected?: boolean;
  deviceLabel?: string;
  steps: { title: string; body: string }[];
  docsUrl?: string;
}

export function DeviceCard({ icon, name, description, connected, deviceLabel, steps, docsUrl }: DeviceCardProps) {
  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-inner bg-bg-tertiary flex items-center justify-center text-xl shrink-0">
            {icon}
          </div>
          <div>
            <div className="text-headline font-semibold text-text-primary">{name}</div>
            <div className="text-subheadline text-text-tertiary">{description}</div>
          </div>
        </div>
        {connected != null && (
          <span
            className="text-caption-1 font-semibold px-2.5 py-1 rounded-chip shrink-0"
            style={{
              background: connected ? "rgba(48,209,88,0.12)" : "var(--color-bg-tertiary)",
              color: connected ? "var(--color-status-normal)" : "var(--color-text-tertiary)",
            }}
          >
            {connected ? (deviceLabel ?? "Подключено") : "Не подключено"}
          </span>
        )}
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-caption-2 font-bold mt-0.5"
              style={{ background: "var(--color-brand)", color: "#fff" }}
            >
              {i + 1}
            </span>
            <div>
              <div className="text-subheadline font-medium text-text-primary">{s.title}</div>
              <div className="text-subheadline text-text-tertiary mt-0.5">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      {docsUrl && (
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-subheadline font-medium"
          style={{ color: "var(--color-brand)" }}
        >
          Документация →
        </a>
      )}
    </div>
  );
}
