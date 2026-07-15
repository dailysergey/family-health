#!/usr/bin/env bash
# Bootstraps the tmux+claude session, then execs the given command
# (Next.js by default). Sanity-checks that Claude Code credentials are
# actually mounted, since without them the assistant can't start.
set -euo pipefail

# 1. Seed data folder on first run if empty.
if [ -z "$(ls -A "$HEALTH_DATA_DIR" 2>/dev/null || true)" ]; then
  echo "[entrypoint] $HEALTH_DATA_DIR is empty — seeding from data.example/"
  cp -a /app/data.example/. "$HEALTH_DATA_DIR/" 2>/dev/null || true
fi

# 2. Sanity-check Claude CLI credentials (mounted from host).
if [ ! -d "$HOME/.claude" ] && [ ! -f "$HOME/.claude.json" ]; then
  echo "[entrypoint] warning: no Claude Code credentials at ~/.claude — the chat"
  echo "[entrypoint] will fail until you mount them (see deploy/docker-compose.yml)."
fi

# 3. Start Claude REPL inside a persistent tmux session. Idempotent.
bash /app/runtime/start-claude.sh || {
  echo "[entrypoint] warning: could not start tmux session '$HEALTH_TMUX_SESSION'."
  echo "[entrypoint] chat will not work until it's up. Common cause: missing Claude CLI OAuth."
}

# 4. Hand over to Next.js (from working dir web/ so relative paths work).
cd /app/web
exec "$@"
