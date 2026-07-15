"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

export function UploadDropzone({ memberId, conversationId }: { memberId: string; conversationId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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
        setStatus(`«${file.name}» отправлен на анализ. Сводка появится в чате.`);
      } catch {
        setStatus(`Не удалось загрузить «${file.name}».`);
      }
    }
    setTimeout(() => setStatus(null), 6000);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className="rounded-card border-2 border-dashed py-10 px-6 text-center cursor-pointer transition-colors duration-200"
      style={{
        borderColor: drag ? "var(--color-brand)" : "var(--color-separator)",
        backgroundColor: drag ? "color-mix(in srgb, var(--color-brand) 5%, transparent)" : "transparent",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <UploadCloud size={40} className="mx-auto" style={{ color: drag ? "var(--color-brand)" : "var(--color-text-quaternary)" }} />
      <div className="text-title-3 text-text-primary mt-3">Загрузите медицинские документы</div>
      <div className="text-callout text-text-tertiary mt-1">
        {status ?? "PDF, JPG, PNG · Claude проанализирует и разложит по папкам"}
      </div>
    </div>
  );
}
