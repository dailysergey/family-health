import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { bus } from "@/lib/bus";
import { ev } from "@/lib/agui";
import { sendPrompt } from "@/lib/tmux";
import { clearChatHistory } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Chat control commands from the UI:
//   clear   — wipe this member's visible transcript (does NOT touch Claude's context)
//   compact — send /compact to the shared Claude session to shrink its context
export async function POST(req: NextRequest) {
  let body: { conversationId?: string; memberId?: string; command?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const { conversationId, memberId, command } = body;
  if (!conversationId || !memberId || !command) {
    return new Response("conversationId, memberId and command are required", { status: 400 });
  }

  if (command === "clear") {
    await clearChatHistory(memberId);
    // Drop the transcript in every open client viewing this member.
    bus.publish(ev.historyCleared(conversationId));
    return Response.json({ ok: true });
  }

  if (command === "compact") {
    const messageId = randomUUID();
    try {
      // Slash command to the persistent Claude REPL (shared across members).
      await sendPrompt("/compact");
    } catch (err) {
      bus.publish(ev.runError(conversationId, `Не удалось выполнить /compact: ${String(err)}`));
      return new Response("failed to dispatch", { status: 502 });
    }
    // Transient notice (not persisted) so the user sees the action took effect.
    bus.publish(ev.textMessageStart(conversationId, messageId, "assistant"));
    bus.publish(
      ev.textMessageContent(conversationId, messageId, "🗜 Сжимаю контекст диалога с Claude…"),
    );
    bus.publish(ev.textMessageEnd(conversationId, messageId));
    return Response.json({ ok: true });
  }

  return new Response("unknown command", { status: 400 });
}
