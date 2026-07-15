// AG-UI protocol event helpers.
// We use the standard AG-UI EventType names (from @ag-ui/core) on the wire,
// wrapped in a thin envelope that always carries `conversationId` so the SSE
// bus can route events to the right browser connection.
import { EventType } from "@ag-ui/core";

export { EventType };

export type WidgetType =
  | "lab_card"
  | "metric_ring"
  | "trend_chart"
  | "summary"
  | "diagnosis_card"
  | "report";

/** Every event sent over our SSE transport. */
export interface AguiEnvelope {
  type: EventType;
  conversationId: string;
  timestamp: number;
  [key: string]: unknown;
}

function base(type: EventType, conversationId: string, extra: Record<string, unknown>): AguiEnvelope {
  return { type, conversationId, timestamp: Date.now(), ...extra };
}

export const ev = {
  runStarted: (conversationId: string, runId: string) =>
    base(EventType.RUN_STARTED, conversationId, { runId }),

  runFinished: (conversationId: string, runId: string) =>
    base(EventType.RUN_FINISHED, conversationId, { runId }),

  runError: (conversationId: string, message: string) =>
    base(EventType.RUN_ERROR, conversationId, { message }),

  textMessageStart: (conversationId: string, messageId: string, role: "user" | "assistant") =>
    base(EventType.TEXT_MESSAGE_START, conversationId, { messageId, role }),

  textMessageContent: (conversationId: string, messageId: string, delta: string) =>
    base(EventType.TEXT_MESSAGE_CONTENT, conversationId, { messageId, delta }),

  textMessageEnd: (conversationId: string, messageId: string) =>
    base(EventType.TEXT_MESSAGE_END, conversationId, { messageId }),

  toolCallStart: (conversationId: string, toolCallId: string, toolCallName: string) =>
    base(EventType.TOOL_CALL_START, conversationId, { toolCallId, toolCallName }),

  toolCallEnd: (conversationId: string, toolCallId: string) =>
    base(EventType.TOOL_CALL_END, conversationId, { toolCallId }),

  /** A generative UI widget rendered inline in the chat. */
  widget: (conversationId: string, widgetType: WidgetType, props: unknown, messageId?: string) =>
    base(EventType.CUSTOM, conversationId, {
      name: "widget",
      value: { widgetType, props },
      messageId,
    }),

  /** Signal that a member's stored data changed so the dashboard can refresh. */
  memberUpdated: (conversationId: string, memberId: string) =>
    base(EventType.CUSTOM, conversationId, { name: "member_updated", value: { memberId } }),

  /** Tell open chat clients to drop their visible transcript (after /clear). */
  historyCleared: (conversationId: string) =>
    base(EventType.CUSTOM, conversationId, { name: "history_cleared", value: {} }),

  /**
   * Internal Claude Code reasoning step (one block from the session transcript).
   * `kind`: text | thinking | tool_use | tool_result. Surfaces in the chat as a
   * dimmed "behind the scenes" line so the user can see what the assistant is
   * doing between emit_message turns.
   */
  reasoning: (
    conversationId: string,
    kind: "text" | "thinking" | "tool_use" | "tool_result",
    text: string,
    meta?: { tool?: string; toolUseId?: string },
  ) =>
    base(EventType.CUSTOM, conversationId, {
      name: "reasoning",
      value: { kind, text, meta: meta ?? {} },
    }),
} as const;
