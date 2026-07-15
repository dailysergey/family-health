"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetType } from "@/lib/agui";
import type { ChatStoredItem } from "@/lib/types";

export type ReasoningKind = "text" | "thinking" | "tool_use" | "tool_result";

export type ChatItem =
  | { id: string; kind: "text"; role: "user" | "assistant"; text: string }
  | { id: string; kind: "widget"; widgetType: WidgetType; props: unknown }
  | { id: string; kind: "reasoning"; subkind: ReasoningKind; text: string; tool?: string };

/** Map a persisted transcript entry to a live chat item. */
function fromStored(s: ChatStoredItem): ChatItem {
  return s.kind === "widget"
    ? { id: s.id, kind: "widget", widgetType: s.widgetType as WidgetType, props: s.props }
    : { id: s.id, kind: "text", role: s.role, text: s.text };
}

interface Envelope {
  type: string;
  conversationId: string;
  messageId?: string;
  role?: "user" | "assistant";
  delta?: string;
  name?: string;
  value?: {
    widgetType?: WidgetType;
    props?: unknown;
    memberId?: string;
    kind?: ReasoningKind;
    text?: string;
    meta?: { tool?: string; toolUseId?: string };
  };
  toolCallName?: string;
  message?: string;
}

export function useAguiStream(
  conversationId: string,
  opts: {
    memberId: string;
    initialItems?: ChatStoredItem[];
    onMemberUpdated?: (memberId: string) => void;
  } = { memberId: "" },
) {
  // Seed from the persisted transcript so history is visible on mount.
  // The hook is keyed by conversationId upstream, so this runs per member.
  const [items, setItems] = useState<ChatItem[]>(() => (opts.initialItems ?? []).map(fromStored));
  const [running, setRunning] = useState(false);
  const [toolLabel, setToolLabel] = useState<string | null>(null);
  const onMemberUpdated = useRef(opts.onMemberUpdated);
  onMemberUpdated.current = opts.onMemberUpdated;

  useEffect(() => {
    setRunning(false);
    setToolLabel(null);
    const es = new EventSource(`/api/events?conversationId=${encodeURIComponent(conversationId)}`);

    es.onmessage = (e) => {
      let ev: Envelope;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (ev.type) {
        case "RUN_STARTED":
          setRunning(true);
          break;
        case "RUN_FINISHED":
          setRunning(false);
          setToolLabel(null);
          break;
        case "RUN_ERROR":
          setRunning(false);
          setToolLabel(null);
          if (ev.message)
            setItems((cur) => [...cur, { id: crypto.randomUUID(), kind: "text", role: "assistant", text: `⚠️ ${ev.message}` }]);
          break;
        case "TOOL_CALL_START":
          setToolLabel(ev.toolCallName ?? null);
          break;
        case "TEXT_MESSAGE_START":
          if (ev.messageId) {
            const id = ev.messageId;
            const role = ev.role ?? "assistant";
            setItems((cur) =>
              cur.some((i) => i.id === id) ? cur : [...cur, { id, kind: "text", role, text: "" }],
            );
          }
          break;
        case "TEXT_MESSAGE_CONTENT":
          if (ev.messageId && ev.delta != null) {
            const id = ev.messageId;
            const delta = ev.delta;
            setItems((cur) =>
              cur.map((i) => (i.id === id && i.kind === "text" ? { ...i, text: i.text + delta } : i)),
            );
          }
          break;
        case "CUSTOM":
          if (ev.name === "widget" && ev.value?.widgetType) {
            const w = ev.value;
            setItems((cur) => [
              ...cur,
              { id: crypto.randomUUID(), kind: "widget", widgetType: w.widgetType!, props: w.props },
            ]);
          } else if (ev.name === "member_updated" && ev.value?.memberId) {
            onMemberUpdated.current?.(ev.value.memberId);
          } else if (ev.name === "history_cleared") {
            setItems([]);
            setRunning(false);
            setToolLabel(null);
          } else if (ev.name === "reasoning" && ev.value?.kind && typeof ev.value.text === "string") {
            const v = ev.value;
            const text = v.text!;
            const subkind = v.kind!;
            const tool = v.meta?.tool;
            // Stream Claude's tool calls into the chat indicator too, so the
            // "Печатает…" hint becomes "Read…" / "Bash…" etc.
            if (subkind === "tool_use" && tool) setToolLabel(tool);
            setItems((cur) => [
              ...cur,
              { id: crypto.randomUUID(), kind: "reasoning", subkind, text, tool },
            ]);
          }
          break;
      }
    };

    return () => es.close();
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const body = JSON.stringify({ conversationId, memberId: opts.memberId, text });
      await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    },
    [conversationId, opts.memberId],
  );

  const sendCommand = useCallback(
    async (command: "clear" | "compact") => {
      const body = JSON.stringify({ conversationId, memberId: opts.memberId, command });
      await fetch("/api/command", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    },
    [conversationId, opts.memberId],
  );

  return { items, running, toolLabel, sendMessage, sendCommand };
}
