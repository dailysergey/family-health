import type { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { bus } from "@/lib/bus";
import { ev } from "@/lib/agui";
import { sendPrompt } from "@/lib/tmux";
import { DATA_DIR, getMember, memberDir } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitize(name: string): string {
  return path.basename(name).replace(/[/\\]/g, "_").slice(0, 200) || `file-${Date.now()}`;
}

// Save an uploaded medical document to the member's _inbox, then ask the
// persistent Claude session to analyze, summarize and file it.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const memberId = String(form.get("memberId") || "");
  const conversationId = String(form.get("conversationId") || `conv-${memberId}`);

  if (!(file instanceof File) || !memberId) {
    return new Response("file and memberId required", { status: 400 });
  }
  if (!(await getMember(memberId))) {
    return new Response("unknown member", { status: 404 });
  }

  const filename = sanitize(file.name);
  const inboxDir = path.join(memberDir(memberId), "_inbox");
  await fs.mkdir(inboxDir, { recursive: true });
  const abs = path.join(inboxDir, filename);
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()));

  const runId = randomUUID();
  bus.publish(ev.runStarted(conversationId, runId));

  const prompt =
    `[conv:${conversationId}][run:${runId}][member:${memberId}] ` +
    `Новый документ загружен: ${abs}. Прочитай его, извлеки показатели/диагнозы, ` +
    `сохрани данные через инструменты (add_lab_results / save_diagnosis), затем вызови file_document, ` +
    `чтобы переместить файл из _inbox в нужную папку категории со сводкой. ` +
    `Покажи краткую сводку через emit_message и при необходимости emit_widget.`;

  try {
    await sendPrompt(prompt);
  } catch (err) {
    bus.publish(ev.runError(conversationId, `Не удалось отправить документ на анализ: ${String(err)}`));
    bus.publish(ev.runFinished(conversationId, runId));
    return new Response("failed to dispatch", { status: 502 });
  }

  return Response.json({ ok: true, runId, path: path.relative(DATA_DIR, abs) });
}
