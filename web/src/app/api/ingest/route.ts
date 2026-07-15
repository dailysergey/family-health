import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { bus } from "@/lib/bus";
import { INGEST_SECRET } from "@/lib/config";
import type { AguiEnvelope } from "@/lib/agui";
import { appendChatItems, memberIdFromConversation } from "@/lib/store";
import type { ChatStoredItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Assemble streamed assistant text (START → CONTENT… → END) across ingest calls.
// The MCP currently batches all three in one POST, but buffering keeps us robust
// if that ever changes.
type TextBuf = { conversationId: string; role: "user" | "assistant"; text: string };
const globalForBuf = globalThis as unknown as { __healthChatBuf?: Map<string, TextBuf> };
const textBuf = globalForBuf.__healthChatBuf ?? new Map<string, TextBuf>();
if (!globalForBuf.__healthChatBuf) globalForBuf.__healthChatBuf = textBuf;

// Receives AG-UI events from the health-ui MCP server and fans them out to
// the browser SSE connections via the in-memory bus.
export async function POST(req: NextRequest) {
  if (req.headers.get("x-ingest-secret") !== INGEST_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const events: AguiEnvelope[] = Array.isArray(body) ? body : [body as AguiEnvelope];

  // Buffer text fragments and collect finished items to persist per member.
  const toPersist = new Map<string, ChatStoredItem[]>();
  const queue = (conversationId: string, item: ChatStoredItem) => {
    const memberId = memberIdFromConversation(conversationId);
    const list = toPersist.get(memberId) ?? [];
    list.push(item);
    toPersist.set(memberId, list);
  };

  for (const event of events) {
    if (!event || typeof event.conversationId !== "string" || !event.type) continue;
    bus.publish(event);

    const messageId = event.messageId as string | undefined;
    switch (event.type) {
      case "TEXT_MESSAGE_START":
        if (messageId) {
          textBuf.set(messageId, {
            conversationId: event.conversationId,
            role: (event.role as "user" | "assistant") ?? "assistant",
            text: "",
          });
        }
        break;
      case "TEXT_MESSAGE_CONTENT":
        if (messageId && typeof event.delta === "string") {
          const buf = textBuf.get(messageId);
          if (buf) buf.text += event.delta;
        }
        break;
      case "TEXT_MESSAGE_END":
        if (messageId) {
          const buf = textBuf.get(messageId);
          textBuf.delete(messageId);
          // Only assistant replies arrive here; user echoes are persisted in /api/chat.
          if (buf && buf.role === "assistant" && buf.text.trim()) {
            queue(buf.conversationId, {
              id: messageId,
              kind: "text",
              role: "assistant",
              text: buf.text,
              ts: Date.now(),
            });
          }
        }
        break;
      case "CUSTOM":
        if (event.name === "widget") {
          const v = event.value as { widgetType?: string; props?: unknown } | undefined;
          if (v?.widgetType) {
            // Parse stringified props before persisting so the transcript stays clean.
            let props = v.props;
            if (typeof props === "string") {
              try {
                props = JSON.parse(props);
              } catch {
                /* keep raw string; renderer normalizes/falls back */
              }
            }
            queue(event.conversationId, {
              id: (messageId as string) ?? randomUUID(),
              kind: "widget",
              widgetType: v.widgetType,
              props,
              ts: Date.now(),
            });
          }
        }
        break;
    }
  }

  await Promise.all(
    Array.from(toPersist.entries()).map(([memberId, items]) => appendChatItems(memberId, items)),
  );

  return Response.json({ ok: true, count: events.length });
}
