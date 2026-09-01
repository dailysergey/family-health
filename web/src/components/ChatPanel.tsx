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
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useTypewriterText } from "@/hooks/useTypewriterText";
import { MicButton } from "./MicButton";
import { TypingIndicator } from "./TypingIndicator";
import { WidgetRenderer } from "./WidgetRenderer";
import type { ChatStoredItem } from "@/lib/types";

const SUGGESTIONS = [
  "Что не так в моих анализах?",
  "Покажи динамику давления",
  "Объясни мой диагноз простыми словами",
];

// ── Markdown renderer (completed messages) ──────────────────────────────────
function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="markdown text-callout text-text-primary leading-relaxed">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

// ── Single message bubble ────────────────────────────────────────────────────
function MessageBubble({
  role,
  text,
  streaming = false,
}: {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end" style={{ animation: "msgIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
        <div
          className="max-w-[80%] text-white text-body rounded-[18px] rounded-br-[4px] px-3.5 py-2.5 whitespace-pre-wrap break-words"
          style={{ background: "var(--color-brand)" }}
        >
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start" style={{ animation: "msgIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <span
        className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "var(--color-brand)" }}
      >
        <Sparkles size={14} color="#fff" />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="rounded-[18px] rounded-bl-[4px] px-4 py-3 shadow-card"
          style={{
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-separator)",
          }}
        >
          {streaming ? (
            // Streaming: plain pre-wrap until finish so markdown doesn't flicker
            <p
              className="text-callout text-text-primary leading-relaxed whitespace-pre-wrap break-words"
              style={{ minHeight: "1.4em" }}
            >
              {text}
              <span
                className="inline-block align-middle ml-[1px]"
                style={{
                  width: 2,
                  height: "1em",
                  background: "var(--color-brand)",
                  opacity: 0.8,
                  animation: "caretBlink 0.9s ease infinite",
                }}
              />
            </p>
          ) : (
            <AssistantMarkdown text={text} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reasoning / tool-use row ─────────────────────────────────────────────────
function ReasoningRow({
  subkind,
  text,
  tool,
}: {
  subkind: string;
  text: string;
  tool?: string;
}) {
  const Icon =
    subkind === "thinking"
      ? Lightbulb
      : subkind === "tool_use"
        ? Terminal
        : subkind === "tool_result"
          ? CornerDownRight
          : Sparkles;
  const label =
    subkind === "tool_use"
      ? (tool ?? "tool")
      : subkind === "tool_result"
        ? "результат"
        : subkind === "thinking"
          ? "размышляет"
          : "пишет";
  return (
    <div
      className="flex gap-2 items-start text-text-tertiary text-caption-1 leading-snug pl-9"
      style={{ animation: "fadeIn 0.2s ease" }}
      title={subkind}
    >
      <Icon size={12} className="mt-[3px] shrink-0 opacity-70" />
      <div className="min-w-0">
        <span className="font-medium text-text-secondary mr-1.5">{label}</span>
        <span className="break-words whitespace-pre-wrap italic opacity-80">
          {text.length > 280 ? text.slice(0, 280) + "…" : text}
        </span>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function ChatPanel({
  conversationId,
  memberId,
  memberName,
  initialItems,
  hideHeader,
}: {
  conversationId: string;
  memberId: string;
  memberName: string;
  initialItems?: ChatStoredItem[];
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const { items, running, toolLabel, sendMessage, sendCommand } = useAguiStream(conversationId, {
    memberId,
    initialItems,
    onMemberUpdated: () => router.refresh(),
  });

  // ── Scroll ──────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollDown = useAutoScroll(scrollRef);

  useEffect(() => {
    scrollDown(true);
  }, [items, running, scrollDown]);

  // ── Typewriter ──────────────────────────────────────────────────────────
  const typewriter = useTypewriterText();

  // Find the currently streaming assistant item
  const streamingItem = running
    ? (items.findLast((i) => i.kind === "text" && i.role === "assistant") ?? null)
    : null;

  const streamingText = streamingItem?.kind === "text" ? streamingItem.text : null;

  useEffect(() => {
    if (streamingText != null) {
      typewriter.update(streamingText);
    }
  }, [streamingText]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running && streamingText == null) {
      typewriter.reset();
    }
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Input ───────────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const send = () => {
    const text = input.trim();
    if (!text || running) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    typewriter.reset();
    void sendMessage(text);
  };

  const onTranscription = (text: string) => {
    setInput((prev) => (prev ? prev.trimEnd() + " " + text : text));
    textareaRef.current?.focus();
    setTimeout(autoResize, 0);
  };

  const clearHistory = () => {
    setMenuOpen(false);
    if (confirm(`Очистить историю чата для «${memberName.split(" ")[0]}»?`)) {
      void sendCommand("clear");
    }
  };

  const compactContext = () => {
    setMenuOpen(false);
    void sendCommand("compact");
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

  // Items excluding the streaming one (it's shown via typewriter separately)
  const displayItems = streamingItem ? items.filter((i) => i.id !== streamingItem.id) : items;
  const isEmpty = displayItems.length === 0 && !streamingItem && !running;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Global keyframe definitions */}
      <style>{`
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes caretBlink {
          0%, 50% { opacity: 0.8; }
          51%, 100% { opacity: 0; }
        }
      `}</style>

      <section
        className={`flex flex-col bg-bg-primary border-separator ${
          hideHeader
            ? "h-full"
            : "w-full md:w-[400px] md:shrink-0 h-[85vh] md:h-screen border-t md:border-t-0 md:border-l"
        }`}
      >
        {/* ── Header ── */}
        {!hideHeader && (
          <header
            className="h-16 shrink-0 border-b border-separator px-4 flex items-center gap-3"
            style={{ background: "var(--color-bg-secondary)" }}
          >
            <span
              className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0"
              style={{ background: "var(--color-brand)" }}
            >
              <Sparkles size={16} color="#fff" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-headline text-text-primary">Анализ с Claude</div>
              <div className="text-subheadline text-text-tertiary truncate">{memberName}</div>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-fill-quaternary transition-colors"
                title="Действия с диалогом"
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
                  <div className="absolute right-0 top-11 z-20 w-60 rounded-card shadow-modal border border-separator p-1 animate-scale-in origin-top-right" style={{ background: "var(--color-bg-elevated)" }}>
                    <button
                      type="button"
                      onClick={compactContext}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-inner text-left hover:bg-fill-quaternary transition-colors"
                    >
                      <Archive size={18} className="text-text-secondary mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-callout text-text-primary">Сжать контекст</span>
                        <span className="block text-caption-1 text-text-tertiary">/compact — Claude ужмёт историю</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={clearHistory}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-inner text-left transition-colors"
                      style={{ color: "var(--color-status-high)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,59,48,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <Trash2 size={18} className="mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-callout">Очистить историю</span>
                        <span className="block text-caption-1 text-text-tertiary">Данные здоровья не затрагиваются</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>
        )}

        {/* ── Message list ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {isEmpty ? (
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
                    style={{ border: "1px solid var(--color-separator)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {displayItems.map((item) => {
                if (item.kind === "text") {
                  return <MessageBubble key={item.id} role={item.role} text={item.text} />;
                }
                if (item.kind === "widget") {
                  return (
                    <div key={item.id} style={{ animation: "msgIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
                      <div className="text-caption-2 uppercase tracking-wide text-text-tertiary mb-1.5 ml-1">
                        AI-виджет
                      </div>
                      <WidgetRenderer widgetType={item.widgetType} props={item.props} />
                    </div>
                  );
                }
                // reasoning / tool_use
                return (
                  <ReasoningRow
                    key={item.id}
                    subkind={item.subkind}
                    text={item.text}
                    tool={item.tool}
                  />
                );
              })}

              {/* Streaming assistant message with typewriter */}
              {streamingItem && (
                <MessageBubble
                  role="assistant"
                  text={typewriter.displayedText}
                  streaming
                />
              )}

              {/* Typing indicator when waiting for first token */}
              {running && !streamingItem && <TypingIndicator />}
            </>
          )}
        </div>

        {/* ── Input area ── */}
        <div
          className="shrink-0 border-t border-separator px-3 py-3"
          style={{ background: "var(--color-bg-secondary)" }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
          <div
            className="flex items-end gap-1 rounded-[22px] px-3 py-1 transition-all duration-200"
            style={{
              border: "1.5px solid var(--color-separator)",
              background: "var(--color-bg-primary)",
            }}
            onFocus={(e) => {
              if (e.currentTarget.contains(e.target))
                e.currentTarget.style.borderColor = "var(--color-brand)";
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                e.currentTarget.style.borderColor = "var(--color-separator)";
            }}
          >
            {/* Attach */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary transition-colors"
              title="Загрузить документ"
            >
              <Paperclip size={18} />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={1}
              placeholder="Спросите про анализы…"
              className="flex-1 bg-transparent text-callout text-text-primary placeholder:text-text-tertiary outline-none py-2.5 resize-none"
              style={{ maxHeight: 200, fontSize: 16 /* prevents iOS zoom */ }}
            />

            {/* Mic */}
            <MicButton onTranscription={onTranscription} />

            {/* Send */}
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || running}
              className="h-9 w-9 shrink-0 rounded-full inline-flex items-center justify-center transition-all duration-150 mb-0.5"
              style={{
                background: input.trim() && !running ? "var(--color-brand)" : "var(--color-fill-quaternary)",
                color: input.trim() && !running ? "#fff" : "var(--color-text-tertiary)",
              }}
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
