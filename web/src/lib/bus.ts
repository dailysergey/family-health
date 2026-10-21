// In-memory pub/sub keyed by conversationId.
// Stored on globalThis so it survives Next.js dev HMR module reloads and is
// shared across the /api/chat, /api/ingest and /api/events route modules.
import { EventEmitter } from "node:events";
import type { AguiEnvelope } from "./agui";

type Listener = (event: AguiEnvelope) => void;

// A run without RUN_FINISHED (agent forgot to call run_finished) stops being
// replayed to new connections after this long.
const ACTIVE_RUN_TTL_MS = 10 * 60 * 1000;

class EventBus {
  private emitter = new EventEmitter();
  // Last RUN_STARTED per conversation, so a (re)connecting client learns that
  // the assistant is still working.
  private activeRuns = new Map<string, AguiEnvelope>();

  constructor() {
    // Many SSE clients may subscribe to the same conversation.
    this.emitter.setMaxListeners(0);
  }

  publish(event: AguiEnvelope): void {
    if (event.type === "RUN_STARTED") this.activeRuns.set(event.conversationId, event);
    else if (
      event.type === "RUN_FINISHED" ||
      event.type === "RUN_ERROR" ||
      (event.type === "CUSTOM" && event.name === "history_cleared")
    )
      this.activeRuns.delete(event.conversationId);
    this.emitter.emit(event.conversationId, event);
  }

  activeRun(conversationId: string): AguiEnvelope | undefined {
    const run = this.activeRuns.get(conversationId);
    if (run && Date.now() - run.timestamp > ACTIVE_RUN_TTL_MS) {
      this.activeRuns.delete(conversationId);
      return undefined;
    }
    return run;
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
