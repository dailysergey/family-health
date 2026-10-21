"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { FileText, Folder, UploadCloud } from "lucide-react";
import type { DocumentMeta } from "@/lib/types";
import { dmy } from "@/lib/labs";
import { Section } from "./primitives";

const FOLDER_TONES = [
  { bg: "var(--color-accent-200)", fg: "var(--color-accent-800)" },
  { bg: "var(--color-accent-2-200)", fg: "var(--color-accent-2-800)" },
  { bg: "var(--color-neutral-300)", fg: "var(--color-neutral-800)" },
  { bg: "var(--color-accent-100)", fg: "var(--color-accent-700)" },
];

function filesLabel(n: number) {
  const m10 = n % 10, m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? "файл" : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? "файла" : "файлов";
  return `${n} ${w}`;
}

const PAGE = 8;

export interface DocumentsHandle {
  pickFiles: () => void;
}

export const DocumentsSection = forwardRef<
  DocumentsHandle,
  { documents: DocumentMeta[]; memberId: string; conversationId: string }
>(function DocumentsSection({ documents, memberId, conversationId }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useImperativeHandle(ref, () => ({ pickFiles: () => inputRef.current?.click() }), []);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      setStatus(`Загружаю «${file.name}»…`);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("memberId", memberId);
      fd.append("conversationId", conversationId);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        setStatus(`«${file.name}» отправлен на анализ — сводка появится в чате.`);
      } catch {
        setStatus(`Не удалось загрузить «${file.name}».`);
      }
    }
    setTimeout(() => setStatus(null), 6000);
  };

  const sorted = [...documents].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const folders = Array.from(new Set(sorted.map((d) => d.category)));
  const filtered = folder ? sorted.filter((d) => d.category === folder) : sorted;
  const visible = showAll ? filtered : filtered.slice(0, PAGE);

  return (
    <Section id="docs" title="Документы">
      {documents.length > 0 && (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            {folders.map((f, i) => {
              const tone = FOLDER_TONES[i % FOLDER_TONES.length];
              const on = folder === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFolder(on ? null : f)}
                  className="o-card px-5 py-[18px] flex flex-col gap-3.5 text-left transition-colors hover:bg-[var(--color-neutral-200)]"
                  style={on ? { boxShadow: "inset 0 0 0 2px var(--color-accent)" } : undefined}
                  aria-pressed={on}
                >
                  <span className="w-10 h-10 rounded-full grid place-items-center" style={{ background: tone.bg, color: tone.fg }}>
                    <Folder size={18} strokeWidth={2.5} />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold text-sm">{f}</span>
                    <span className="text-xs text-muted">{filesLabel(sorted.filter((d) => d.category === f).length)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="o-card px-2.5 py-2">
            {visible.map((d) => (
              <a
                key={d.id}
                href={`/api/document?member=${encodeURIComponent(memberId)}&id=${encodeURIComponent(d.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={d.summary ?? "Открыть в новой вкладке"}
                className="flex items-center gap-3.5 px-3.5 py-3 rounded-[16px] transition-colors hover:bg-[var(--color-neutral-200)] text-inherit no-underline"
                style={{ color: "inherit" }}
              >
                <FileText size={18} strokeWidth={2.5} className="shrink-0" style={{ color: "var(--color-neutral-700)" }} />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-sm font-semibold truncate">{d.filename}</span>
                  {d.summary && <span className="text-xs text-muted truncate">{d.summary}</span>}
                </span>
                <span className="tag tag-neutral hidden sm:inline-flex">{d.category}</span>
                <span className="text-xs text-muted w-20 text-right shrink-0">{dmy(d.addedAt)}</span>
              </a>
            ))}
            {filtered.length > PAGE && (
              <button type="button" className="btn btn-ghost text-[13px] m-1.5" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Свернуть" : `Показать все (${filtered.length})`}
              </button>
            )}
          </div>
        </>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void upload(e.dataTransfer.files);
        }}
        className="rounded-[28px] px-6 py-[22px] flex items-center gap-[18px] flex-wrap transition-colors"
        style={{
          border: `2px dashed ${drag ? "var(--color-accent)" : "var(--color-neutral-400)"}`,
          background: drag ? "var(--color-accent-100)" : "transparent",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
        <span
          className="w-12 h-12 rounded-full grid place-items-center shrink-0"
          style={{ background: "var(--color-accent-200)", color: "var(--color-accent-800)" }}
        >
          <UploadCloud size={22} strokeWidth={2.5} />
        </span>
        <span className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
          <span className="font-semibold text-[15px]">Перетащите медицинские документы</span>
          <span className="text-[13px] text-muted">{status ?? "PDF, JPG, PNG · ассистент разложит по папкам"}</span>
        </span>
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
          Выбрать файлы
        </button>
      </div>
    </Section>
  );
});
