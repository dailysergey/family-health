// Tail the active Claude Code session transcript JSONL and republish every
// assistant content block (text, thinking, tool_use) and tool_result back to
// the AG-UI bus as `reasoning` events. The web chat panel renders them inline
// so the user can see what Claude is doing in real time — not just the final
// emit_message output.
//
// The transcript file is appended-to by Claude Code; we keep a byte offset
// per file and only read new bytes. Conversation routing is recovered from
// the `[conv:<id>]` prefix that /api/chat puts on every user prompt.

import fs from "node:fs";
import path from "node:path";
import { bus } from "./bus";
import { ev } from "./agui";

const TRANSCRIPT_DIR =
  process.env.HEALTH_TRANSCRIPT_DIR || "/root/.claude/projects/-opt-health-data";

const globalForWatcher = globalThis as unknown as {
  __healthTranscriptStarted?: boolean;
};

let currentConversationId: string | null = null;
let activeFile: string | null = null;
let offset = 0;
let buffer = "";
let pending = false;
let dirWatcher: fs.FSWatcher | null = null;
let fileWatcher: fs.FSWatcher | null = null;

function pickLatestJsonl(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    if (files.length === 0) return null;
    files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
    return path.join(dir, files[0]);
  } catch {
    return null;
  }
}

/** Build a short, human-readable description of a tool_use input. */
function summarizeToolInput(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof i[k] === "string" ? (i[k] as string) : "");
  switch (name) {
    case "Bash":
      return pick("description") || pick("command").slice(0, 120);
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return pick("file_path");
    case "Glob":
      return pick("pattern");
    case "Grep":
      return pick("pattern") + (pick("path") ? ` in ${pick("path")}` : "");
    case "WebFetch":
    case "WebSearch":
      return pick("url") || pick("query");
    case "Agent":
    case "Task":
      return pick("description") || pick("subagent_type");
    default: {
      // mcp__ tools or anything else: show a few keys/values truncated
      const keys = Object.keys(i).slice(0, 3);
      return keys
        .map((k) => {
          const v = i[k];
          const s = typeof v === "string" ? v : JSON.stringify(v);
          return `${k}=${(s ?? "").slice(0, 80)}`;
        })
        .join(" · ");
    }
  }
}

/** Reduce a tool_result content array to a short text snippet. */
function summarizeToolResult(content: unknown): string {
  if (typeof content === "string") return content.slice(0, 240);
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const x of content) {
    if (typeof x === "string") parts.push(x);
    else if (x && typeof x === "object" && typeof (x as { text?: unknown }).text === "string") {
      parts.push((x as { text: string }).text);
    }
  }
  return parts.join(" ").slice(0, 240);
}

interface TranscriptBlock {
  type?: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
  id?: string;
  tool_use_id?: string;
  content?: unknown;
}

interface TranscriptLine {
  type?: string;
  message?: { content?: unknown };
}

function processLine(line: string): void {
  let e: TranscriptLine;
  try {
    e = JSON.parse(line) as TranscriptLine;
  } catch {
    return;
  }
  const t = e.type;
  const content = e.message?.content;

  if (t === "user") {
    const blocks: TranscriptBlock[] = Array.isArray(content)
      ? (content as TranscriptBlock[])
      : typeof content === "string"
        ? [{ type: "text", text: content }]
        : [];
    for (const b of blocks) {
      if (b.type === "text" && typeof b.text === "string") {
        const m = b.text.match(/\[conv:([^\]]+)\]/);
        if (m) currentConversationId = m[1];
      } else if (b.type === "tool_result" && currentConversationId) {
        const summary = summarizeToolResult(b.content);
        if (summary) {
          bus.publish(
            ev.reasoning(currentConversationId, "tool_result", summary, {
              toolUseId: b.tool_use_id,
            }),
          );
        }
      }
    }
    return;
  }

  if (t === "assistant" && currentConversationId && Array.isArray(content)) {
    for (const b of content as TranscriptBlock[]) {
      if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
        bus.publish(ev.reasoning(currentConversationId, "text", b.text));
      } else if (b.type === "thinking" && typeof b.thinking === "string" && b.thinking.trim()) {
        bus.publish(ev.reasoning(currentConversationId, "thinking", b.thinking));
      } else if (b.type === "tool_use" && typeof b.name === "string") {
        bus.publish(
          ev.reasoning(currentConversationId, "tool_use", summarizeToolInput(b.name, b.input), {
            tool: b.name,
            toolUseId: b.id,
          }),
        );
      }
    }
  }
}

/** Read everything new since `offset` and update offset. */
function drainFile(file: string): void {
  if (pending) return;
  pending = true;
  fs.stat(file, (err, st) => {
    if (err) {
      pending = false;
      return;
    }
    if (st.size < offset) {
      // file rotated/truncated
      offset = 0;
      buffer = "";
    }
    if (st.size === offset) {
      pending = false;
      return;
    }
    const start = offset;
    offset = st.size;
    const stream = fs.createReadStream(file, { start, end: st.size - 1, encoding: "utf8" });
    let chunk = "";
    stream.on("data", (d) => (chunk += d));
    stream.on("end", () => {
      const text = buffer + chunk;
      const lines = text.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) processLine(line);
      pending = false;
    });
    stream.on("error", () => {
      pending = false;
    });
  });
}

function attachFile(file: string): void {
  fileWatcher?.close();
  buffer = "";
  try {
    offset = fs.statSync(file).size; // start at tail
  } catch {
    offset = 0;
  }
  try {
    fileWatcher = fs.watch(file, { persistent: false }, () => drainFile(file));
  } catch {
    fileWatcher = null;
  }
  // Belt-and-suspenders: poll every 1s in case fs.watch misses an event.
  setInterval(() => drainFile(file), 1000).unref?.();
}

function rescanDir(): void {
  const latest = pickLatestJsonl(TRANSCRIPT_DIR);
  if (latest && latest !== activeFile) {
    activeFile = latest;
    attachFile(activeFile);
  }
}

export function startTranscriptWatcher(): void {
  if (globalForWatcher.__healthTranscriptStarted) return;
  globalForWatcher.__healthTranscriptStarted = true;
  if (process.env.HEALTH_REASONING_ENABLED === "0") return;
  try {
    if (!fs.existsSync(TRANSCRIPT_DIR)) return;
    rescanDir();
    dirWatcher = fs.watch(TRANSCRIPT_DIR, { persistent: false }, () => rescanDir());
  } catch (err) {
    console.warn("[transcript-watcher] failed to start:", err);
  }
}

// Make sure the watchers don't keep the process alive.
process.on("exit", () => {
  dirWatcher?.close();
  fileWatcher?.close();
});
