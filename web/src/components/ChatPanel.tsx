"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  Archive,
  ArrowUp,
  CornerDownRight,
  Lightbulb,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useAguiStream } from "@/hooks/useAguiStream";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useTypewriterText } from "@/hooks/useTypewriterText";
import { MicButton } from "./MicButton";
import { TypingIndicator } from "./TypingIndicator";
import { WidgetRenderer } from "./WidgetRenderer";
import type { ChatStoredItem } from "@/lib/types";
import { ASK_EVENT } from "./dashboard/primitives";

const SUGGESTIONS = [
  "Что не так в моих анализах?",
  "Что пересдать и когда?",
  "Объясни диагноз проще",
];

// ── Markdown renderer (completed messages) ──────────────────────────────────
function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="markdown text-sm leading-normal">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

// ── Single message bubble ────────────────────────────────────────────────────
// Organic: user — терракотовая «капля» справа, assistant — тёплый серый слева.
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
      <div
        className="self-end max-w-[82%] px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words"
        style={{
          background: "var(--color-accent)",
          color: "var(--color-bg)",
          borderRadius: "18px 18px 6px 18px",
          animation: "msgIn 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <div
      className="max-w-[94%] px-4 py-3.5 min-w-0"
      style={{
        background: "var(--color-neutral-200)",
        borderRadius: "18px 18px 18px 6px",
        animation: "msgIn 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {streaming ? (
        // Streaming: plain pre-wrap until finish so markdown doesn't flicker
        <p className="text-sm leading-normal whitespace-pre-wrap break-words m-0" style={{ minHeight: "1.4em" }}>
          {text}
          <span
            className="inline-block align-middle ml-[1px]"
            style={{
              width: 2,
              height: "1em",
              background: "var(--color-accent)",
              opacity: 0.85,
              animation: "caretBlink 0.9s ease infinite",
            }}
          />
        </p>
      ) : (
        <AssistantMarkdown text={text} />
      )}
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
      className="flex gap-2 items-start text-text-tertiary text-caption-1 leading-snug pl-1"
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
  onClose,
}: {
  conversationId: string;
  memberId: string;
  memberName: string;
  initialItems?: ChatStoredItem[];
  onClose?: () => void;
}) {
  const router = useRouter();
  const { items, running, sendMessage, sendCommand } = useAguiStream(conversationId, {
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

  // The panel stays mounted while CSS hides it (mobile drawer, collapsed
  // column) and then has no height; jump to the latest message once shown.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let wasHidden = el.clientHeight === 0;
    const ro = new ResizeObserver(() => {
      const hidden = el.clientHeight === 0;
      if (wasHidden && !hidden) el.scrollTop = el.scrollHeight;
      wasHidden = hidden;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Typewriter ──────────────────────────────────────────────────────────
  const typewriter = useTypewriterText();

  // Only a reply that arrived during the current run streams. Without this the
  // previous answer is pulled down and re-typed while the new run (a message
  // or a file upload) is still waiting for its first token. Snapshot the
  // replies already on screen at the moment the run starts.
  const seenAtRunStart = useRef<Set<string>>(new Set());
  const wasRunning = useRef(false);
  if (running && !wasRunning.current) {
    seenAtRunStart.current = new Set(items.filter((i) => i.kind === "text").map((i) => i.id));
  }
  wasRunning.current = running;
  const streamingItem = running
    ? (items.findLast(
        (i) => i.kind === "text" && i.role === "assistant" && !seenAtRunStart.current.has(i.id),
      ) ?? null)
    : null;

  const streamingText = streamingItem?.kind === "text" ? streamingItem.text : null;
  const streamingId = streamingItem?.id ?? null;

  // A new message within the run starts its typewriter from scratch.
  useEffect(() => {
    if (streamingId) typewriter.reset();
  }, [streamingId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (streamingText != null) {
      typewriter.update(streamingText);
    }
  }, [streamingText, streamingId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running && streamingText == null) {
      typewriter.reset();
    }
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Input ───────────────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  // Questions asked from dashboard buttons («Спросить ассистента»).
  const runningRef = useRef(running);
  runningRef.current = running;
  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<string>).detail?.trim();
      if (!text) return;
      if (runningRef.current) {
        setInput(text);
        return;
      }
      typewriter.reset();
      void sendMessage(text);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [sendMessage]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!files?.length || uploading) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("memberId", memberId);
        fd.append("conversationId", conversationId);
        await fetch("/api/upload", { method: "POST", body: fd });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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
          0%, 50% { opacity: 0.85; }
          51%, 100% { opacity: 0; }
        }
        @keyframes chatAttachSpin { to { transform: rotate(360deg); } }
      `}</style>

      <section className="flex flex-col h-full w-full min-h-0">
        {/* ── Header ── */}
        <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-4">
          <span
            className="w-10 h-10 rounded-full grid place-items-center shrink-0"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            <Sparkles size={18} strokeWidth={2.5} />
          </span>
          <span className="flex flex-col flex-1 min-w-0">
            <span className="font-heading text-lg leading-tight">Ассистент</span>
            <span className="text-xs text-muted truncate">о здоровье: {memberName.split(" ").slice(1).join(" ") || memberName}</span>
          </span>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="btn btn-ghost btn-icon"
              title="Действия с диалогом"
            >
              <MoreHorizontal size={18} strokeWidth={2.5} />
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
                <div
                  className="absolute right-0 top-11 z-20 w-60 rounded-[20px] p-1.5 animate-scale-in origin-top-right"
                  style={{ background: "var(--color-bg)", boxShadow: "var(--shadow-lg)" }}
                >
                  <button
                    type="button"
                    onClick={compactContext}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-[14px] text-left hover:bg-[var(--color-neutral-200)] transition-colors"
                  >
                    <Archive size={18} className="text-muted mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm">Сжать контекст</span>
                      <span className="block text-xs text-muted">/compact — Claude ужмёт историю</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-[14px] text-left transition-colors hover:bg-[var(--color-accent-100)]"
                    style={{ color: "var(--color-accent-700)" }}
                  >
                    <Trash2 size={18} className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm">Очистить историю</span>
                      <span className="block text-xs text-muted">Данные здоровья не затрагиваются</span>
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
          {onClose && (
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Скрыть">
              <X size={18} strokeWidth={2.5} />
            </button>
          )}
        </header>

        {/* ── Message list ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-1 pb-5 flex flex-col gap-3.5">
          {isEmpty ? (
            <div className="my-auto flex flex-col gap-2.5 items-start pt-10">
              <span className="font-heading text-[22px] leading-tight">Спросите про анализы или загрузите документ</span>
              <span className="text-sm text-muted">Я объясню результаты простыми словами и подскажу, что пересдать.</span>
            </div>
          ) : (
            <>
              {displayItems.map((item) => {
                if (item.kind === "text") {
                  return <MessageBubble key={item.id} role={item.role} text={item.text} />;
                }
                if (item.kind === "widget") {
                  return (
                    <div
                      key={item.id}
                      style={
                        {
                          animation: "msgIn 0.3s cubic-bezier(0.16,1,0.3,1)",
                          // widget cards sit on the cream ground, as in the mockup
                          "--color-bg-secondary": "var(--color-bg)",
                        } as React.CSSProperties
                      }
                    >
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
        <div className="shrink-0 px-5 pt-3 pb-5 flex flex-col gap-2.5">
          {!running && (
            <div className="flex gap-1.5 flex-wrap">
              {SUGGESTIONS.slice(isEmpty ? 0 : 1).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    typewriter.reset();
                    void sendMessage(s);
                  }}
                  className="btn btn-secondary text-xs px-3 py-1.5"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
          <div
            className="flex items-end gap-1.5 rounded-[22px] pl-2 pr-1.5 py-1.5 transition-shadow duration-200 focus-within:shadow-[inset_0_0_0_1.5px_var(--color-accent)]"
            style={{ background: "var(--color-bg)", boxShadow: "inset 0 0 0 1px var(--color-divider)" }}
          >
            {/* Attach */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || running}
              className="btn btn-ghost btn-icon shrink-0"
              title="Загрузить документ"
              aria-label="Прикрепить"
            >
              {uploading ? (
                <Loader2 size={17} style={{ animation: "chatAttachSpin 0.8s linear infinite" }} />
              ) : (
                <Paperclip size={17} strokeWidth={2.5} />
              )}
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
              placeholder="Спросите ассистента…"
              className="flex-1 min-w-0 bg-transparent outline-none py-[7px] resize-none placeholder:text-[var(--color-neutral-600)]"
              style={{ maxHeight: 200, fontSize: 16 /* prevents iOS zoom */, color: "inherit" }}
            />

            {/* Mic */}
            <MicButton onTranscription={onTranscription} />

            {/* Send */}
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || running}
              className="btn btn-primary btn-icon shrink-0"
              aria-label="Отправить"
            >
              <ArrowUp size={17} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
