import type { NextRequest } from "next/server";
import { bus } from "@/lib/bus";
import type { AguiEnvelope } from "@/lib/agui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SSE stream of AG-UI events for a single conversation.
export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return new Response("conversationId required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: AguiEnvelope) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial comment so the client opens the connection immediately.
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = bus.subscribe(conversationId, send);

      // Keep-alive ping to defeat proxy idle timeouts.
      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25000);

      const close = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
