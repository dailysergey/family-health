// In-memory pub/sub keyed by conversationId.
// Stored on globalThis so it survives Next.js dev HMR module reloads and is
// shared across the /api/chat, /api/ingest and /api/events route modules.
import { EventEmitter } from "node:events";
import type { AguiEnvelope } from "./agui";

type Listener = (event: AguiEnvelope) => void;

class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Many SSE clients may subscribe to the same conversation.
    this.emitter.setMaxListeners(0);
  }

  publish(event: AguiEnvelope): void {
    this.emitter.emit(event.conversationId, event);
  }

  subscribe(conversationId: string, listener: Listener): () => void {
    this.emitter.on(conversationId, listener);
    return () => this.emitter.off(conversationId, listener);
  }
}

const globalForBus = globalThis as unknown as { __healthBus?: EventBus };

export const bus: EventBus = globalForBus.__healthBus ?? new EventBus();
if (!globalForBus.__healthBus) globalForBus.__healthBus = bus;

// Bootstrap the Claude Code transcript watcher so AG-UI gets every assistant
// thought / tool call live. Lazy + idempotent so module init order is safe.
void Promise.resolve()
  .then(() => import("./transcript-watcher"))
  .then((m) => m.startTranscriptWatcher())
  .catch((err) => console.warn("[bus] failed to start transcript watcher:", err));
