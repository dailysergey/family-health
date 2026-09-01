import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { bus } from "@/lib/bus";
import { ev } from "@/lib/agui";
import { sendPrompt } from "@/lib/tmux";
import { appendChatItems, getWearables } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Accept a user message, echo it to the conversation, and forward it to the
// persistent Claude session in tmux.
export async function POST(req: NextRequest) {
  let body: { conversationId?: string; memberId?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const { conversationId, memberId, text } = body;
  if (!conversationId || !memberId || !text?.trim()) {
    return new Response("conversationId, memberId and text are required", { status: 400 });
  }

  const runId = randomUUID();
  const messageId = randomUUID();

  // Echo the user's message immediately so it appears in the chat.
  bus.publish(ev.textMessageStart(conversationId, messageId, "user"));
  bus.publish(ev.textMessageContent(conversationId, messageId, text));
  bus.publish(ev.textMessageEnd(conversationId, messageId));
  // Signal "assistant is working" until the agent calls run_finished.
  bus.publish(ev.runStarted(conversationId, runId));

  // Persist the user message so the transcript survives reloads/member switches.
  // (Assistant replies are persisted in /api/ingest as they arrive.)
  void appendChatItems(memberId, [
    { id: messageId, kind: "text", role: "user", text: text.trim(), ts: Date.now() },
  ]);

  // Build compact wearables context for the last 7 days
  let wearablesCtx = "";
  try {
    const rollups = await getWearables(memberId, 7);
    if (rollups.length > 0) {
      const compact = rollups.map((d) => {
        const parts: string[] = [d.date];
        if (d.steps            != null) parts.push(`steps:${d.steps}`);
        if (d.activeEnergyKcal != null) parts.push(`kcal:${d.activeEnergyKcal}`);
        if (d.activeZoneMinutes!= null) parts.push(`azm:${d.activeZoneMinutes}`);
        if (d.restingHeartRate != null) parts.push(`rhr:${d.restingHeartRate}`);
        if (d.hrvRmssd         != null) parts.push(`hrv:${d.hrvRmssd.toFixed(1)}`);
        if (d.sleepMinutes     != null) parts.push(`sleep:${d.sleepMinutes}min`);
        if (d.sleepEfficiency  != null) parts.push(`eff:${d.sleepEfficiency}%`);
        if (d.spo2             != null) parts.push(`spo2:${d.spo2}%`);
        if ((d as Record<string,unknown>).readinessScore != null) parts.push(`ready:${(d as Record<string,unknown>).readinessScore}`);
        return parts.join("|");
      });
      wearablesCtx = ` [wearables:${compact.join(",")}]`;
    }
  } catch {
    // non-fatal — proceed without wearables context
  }

  try {
    await sendPrompt(`[conv:${conversationId}][run:${runId}][member:${memberId}]${wearablesCtx} ${text}`);
  } catch (err) {
    bus.publish(ev.runError(conversationId, `Не удалось отправить запрос ассистенту: ${String(err)}`));
    bus.publish(ev.runFinished(conversationId, runId));
    return new Response("failed to dispatch to claude", { status: 502 });
  }

  return Response.json({ runId });
}
