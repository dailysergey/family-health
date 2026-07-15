"use client";

import { useState } from "react";
import { ChevronRight, FileText, Folder } from "lucide-react";
import type { DocumentMeta } from "@/lib/types";
import { accentVar, formatDate, tint } from "@/lib/ui";

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export function DocumentList({ documents, memberId }: { documents: DocumentMeta[]; memberId: string }) {
  const categories = Array.from(new Set(documents.map((d) => d.category)));
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map((c) => [c, true])),
  );
  const labs = accentVar("labs");

  if (documents.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-card shadow-card p-8 text-center">
        <FileText size={40} strokeWidth={1} className="mx-auto text-text-quaternary" />
        <p className="text-callout text-text-tertiary mt-3">Документов пока нет</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-card shadow-card overflow-hidden divide-y divide-separator">
      {categories.map((cat) => {
        const docs = documents.filter((d) => d.category === cat);
        const isOpen = open[cat];
        return (
          <div key={cat}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [cat]: !o[cat] }))}
              className="w-full h-14 px-4 flex items-center gap-3 hover:bg-[rgba(127,127,127,0.06)] transition-colors"
            >
              <span
                className="w-8 h-8 rounded-chip inline-flex items-center justify-center"
                style={{ backgroundColor: tint(labs, 10) }}
              >
                <Folder size={18} style={{ color: labs }} />
              </span>
              <span className="text-callout text-text-primary">{cat}</span>
              <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-fill-quaternary text-caption-2 text-text-secondary tabular">
                {docs.length}
              </span>
              <ChevronRight
                size={16}
                className="text-text-quaternary transition-transform duration-200"
                style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
              />
            </button>
            {isOpen &&
              docs.map((d) => (
                <a
                  key={d.id}
                  href={`/api/document?member=${encodeURIComponent(memberId)}&id=${encodeURIComponent(d.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pl-14 pr-4 py-3 flex items-start gap-3 hover:bg-[rgba(127,127,127,0.06)] transition-colors"
                  title="Открыть в новой вкладке"
                >
                  <FileText size={18} className="mt-0.5 shrink-0" style={{ color: labs }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-callout font-semibold text-text-primary truncate">{d.filename}</div>
                    <div className="text-caption-1 text-text-tertiary">
                      {sizeLabel(d.sizeBytes)} · {formatDate(d.addedAt)}
                    </div>
                    {d.summary && <div className="text-footnote text-text-secondary mt-1">{d.summary}</div>}
                  </div>
                </a>
              ))}
          </div>
        );
      })}
    </div>
  );
}
