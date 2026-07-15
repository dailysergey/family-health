// Controller for the persistent Claude Code session running in tmux.
// Input is sent via `tmux send-keys`; structured output comes back through the
// health-ui MCP server, so we never scrape the terminal here.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { TMUX_SESSION } from "./config";

const exec = promisify(execFile);

const START_SCRIPT =
  process.env.HEALTH_START_SCRIPT || path.join(process.cwd(), "..", "runtime", "start-claude.sh");

let starting: Promise<void> | null = null;

async function hasSession(): Promise<boolean> {
  try {
    await exec("tmux", ["has-session", "-t", TMUX_SESSION]);
    return true;
  } catch {
    return false;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ensure the tmux Claude session exists; starts it once if missing. */
export async function ensureSession(): Promise<void> {
  if (await hasSession()) return;
  if (!starting) {
    starting = (async () => {
      await exec("bash", [START_SCRIPT], {
        env: { ...process.env, HEALTH_TMUX_SESSION: TMUX_SESSION },
      });
      // Give the Claude TUI a moment to become ready for input.
      await delay(6000);
    })().finally(() => {
      starting = null;
    });
  }
  await starting;
}

// Serialize prompt delivery so concurrent requests don't interleave keystrokes.
let queue: Promise<void> = Promise.resolve();

/** Send a single-line prompt to the Claude session and submit it. */
export function sendPrompt(text: string): Promise<void> {
  const oneLine = text.replace(/[\r\n]+/g, " ").trim();
  queue = queue.then(async () => {
    await ensureSession();
    // Send the literal text, then submit with Enter as a separate keystroke.
    await exec("tmux", ["send-keys", "-t", TMUX_SESSION, "-l", oneLine]);
    await delay(150);
    await exec("tmux", ["send-keys", "-t", TMUX_SESSION, "Enter"]);
    await delay(250);
  });
  return queue;
}
