"use client";

import ReactMarkdown from "react-markdown";

export interface ReportCardProps {
  title: string;
  sections: { heading: string; body: string }[];
}

export function ReportCard({ title, sections }: ReportCardProps) {
  return (
    <div className="bg-bg-secondary rounded-card shadow-card p-5">
      <div className="text-title-3 text-text-primary">{title}</div>
      <div className="mt-3 space-y-4">
        {(Array.isArray(sections) ? sections : []).map((s, i) => (
          <section key={i}>
            <h4 className="text-headline text-text-primary mb-1">{s.heading}</h4>
            <div className="text-callout text-text-secondary markdown">
              <ReactMarkdown>{s.body}</ReactMarkdown>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
