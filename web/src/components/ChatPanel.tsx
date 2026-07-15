"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  Archive,
  ArrowUp,
  CornerDownRight,
  Lightbulb,
  MoreHorizontal,
  Paperclip,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import { useAguiStream } from "@/hooks/useAguiStream";
import type { ChatStoredItem } from "@/lib/types";
import { WidgetRenderer } from "./WidgetRenderer";

const SUGGESTIONS = [
  "Что не так в моих анализах?",
  "Покажи динамику давления",
  "Объясни мой диагноз простыми словами",
];

export function ChatPanel({
  conversationId,
  memberId,
  memberName,
  initialItems,
}: {
  conversationId: string;
  memberId: string;
  memberName: string;
  initialItems?: ChatStoredItem[];
}) {
  const router = useRouter();
  const { items, running, toolLabel, sendMessage, sendCommand } = useAguiStream(conversationId, {
    memberId,
    initialItems,
    onMemberUpdated: () => router.refresh(),
  });
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items, running]);

  const clearHistory = () => {
    setMenuOpen(false);
    if (confirm(`Очистить историю чата для «${memberName.split(" ")[0]}»? Данные здоровья не затрагиваются.`)) {
      void sendCommand("clear");
    }
  };

  const compactContext = () => {
    setMenuOpen(false);
    void sendCommand("compact");
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void sendMessage(text);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("memberId", memberId);
      fd.append("conversationId", conversationId);
      await fetch("/api/upload", { method: "POST", body: fd });
    }
  };

  return (
    <section className="w-full md:w-[400px] md:shrink-0 h-[85vh] md:h-screen bg-bg-primary border-t md:border-t-0 md:border-l border-separator flex flex-col">
      <header className="h-16 shrink-0 bg-bg-secondary border-b border-separator px-4 flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-brand inline-flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-headline text-text-primary">Анализ с Claude</div>
          <div className="text-subheadline text-text-tertiary truncate">{memberName}</div>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-[rgba(127,127,127,0.08)] transition-colors"
            title="Действия с диалогом"
            aria-label="Действия с диалогом"
          >
            <MoreHorizontal size={20} />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-11 z-20 w-60 bg-bg-elevated rounded-card shadow-modal border border-separator p-1 animate-scale-in origin-top-right">
                <button
                  type="button"
                  onClick={compactContext}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-inner text-left hover:bg-[rgba(127,127,127,0.08)] transition-colors"
                >
                  <Archive size={18} className="text-text-secondary mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-callout text-text-primary">Сжать контекст</span>
                    <span className="block text-caption-1 text-text-tertiary">
                      /compact — Claude ужмёт историю диалога, сохранив суть
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-inner text-left hover:bg-[rgba(255,59,48,0.10)] transition-colors"
                >
                  <Trash2 size={18} className="text-status-high mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-callout text-status-high">Очистить историю</span>
                    <span className="block text-caption-1 text-text-tertiary">
                      Удалить переписку этого профиля (данные здоровья не тронутся)
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {items.length === 0 && !running && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <Sparkles size={40} strokeWidth={1} className="text-text-quaternary" />
            <p className="text-callout text-text-tertiary mt-3">
              Задайте вопрос об анализах {memberName.split(" ")[0]} или загрузите документ
            </p>
            <div className="flex flex-col gap-2 mt-5 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendMessage(s)}
                  className="text-subheadline text-text-secondary bg-bg-secondary rounded-inner px-3 py-2 shadow-card hover:-translate-y-0.5 transition-transform text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.map((item) => {
          if (item.kind === "text") {
            return item.role === "user" ? (
              <div key={item.id} className="flex justify-end animate-slide-right">
                <div className="max-w-[80%] bg-brand text-white text-body rounded-[18px] rounded-br-[4px] px-3.5 py-2.5">
                  {item.text}
                </div>
              </div>
            ) : (
              <div key={item.id} className="flex gap-2 items-start animate-fade-up">
                <span className="w-7 h-7 rounded-full bg-brand inline-flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={14} className="text-white" />
                </span>
                <div className="max-w-[88%] bg-bg-secondary shadow-card text-callout text-text-primary rounded-[18px] rounded-bl-[4px] px-4 py-3 markdown">
                  <ReactMarkdown>{item.text}</ReactMarkdown>
                </div>
              </div>
            );
          }
          if (item.kind === "widget") {
            return (
              <div key={item.id} className="animate-scale-in">
                <div className="text-caption-2 uppercase tracking-wide text-text-tertiary mb-1.5 ml-1">
                  AI-виджет
                </div>
                <WidgetRenderer widgetType={item.widgetType} props={item.props} />
              </div>
            );
          }
          // kind === "reasoning" — Claude's internal step, shown as a dim line
          const Icon =
            item.subkind === "thinking"
              ? Lightbulb
              : item.subkind === "tool_use"
                ? Terminal
                : item.subkind === "tool_result"
                  ? CornerDownRight
                  : Sparkles;
          const label =
            item.subkind === "tool_use"
              ? item.tool ?? "tool"
              : item.subkind === "tool_result"
                ? "результат"
                : item.subkind === "thinking"
                  ? "размышляет"
                  : "пишет";
          return (
            <div
              key={item.id}
              className="flex gap-2 items-start text-text-tertiary text-caption-1 leading-snug animate-fade-in pl-1"
              title={item.subkind}
            >
              <Icon size={12} className="mt-[3px] shrink-0 opacity-70" />
              <div className="min-w-0">
                <span className="font-medium text-text-secondary mr-1.5">{label}</span>
                <span className="break-words whitespace-pre-wrap italic opacity-80">
                  {item.text.length > 280 ? item.text.slice(0, 280) + "…" : item.text}
                </span>
              </div>
            </div>
          );
        })}

        {running && (
          <div className="flex gap-2 items-center text-text-tertiary animate-fade-in">
            <span className="w-7 h-7 rounded-full bg-brand inline-flex items-center justify-center shrink-0">
              <Sparkles size={14} className="text-white" />
            </span>
            <span className="text-subheadline">{toolLabel ? `${toolLabel}…` : "Печатает…"}</span>
          </div>
        )}
      </div>

      <div className="shrink-0 bg-bg-secondary border-t border-separator p-3 px-4">
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors"
            title="Загрузить документ"
          >
            <Paperclip size={20} />
          </button>
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Спросите про анализы…"
              className="w-full max-h-[120px] resize-none bg-bg-tertiary rounded-[20px] text-callout text-text-primary placeholder:text-text-tertiary outline-none py-2.5 pl-4 pr-12"
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim()}
              className="absolute right-1.5 bottom-1.5 h-8 w-8 rounded-full inline-flex items-center justify-center transition-colors disabled:bg-fill-quaternary disabled:text-text-tertiary bg-brand text-white"
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
