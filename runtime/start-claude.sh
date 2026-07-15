#!/usr/bin/env bash
# Idempotently launch a persistent Claude Code session inside tmux.
# The web app drives this session via `tmux send-keys` and receives structured
# output through the health-ui MCP server (not by scraping the terminal).
set -euo pipefail

SESSION="${HEALTH_TMUX_SESSION:-health}"
DATA_DIR="${HEALTH_DATA_DIR:-/opt/health/data}"
CLAUDE_BIN="$(command -v claude || echo claude)"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session '$SESSION' already running"
  exit 0
fi

# Reasonable virtual terminal size so the TUI doesn't wrap prompts oddly.
tmux new-session -d -s "$SESSION" -c "$DATA_DIR" -x 220 -y 50

# Start Claude with bypassed permissions (local self-hosted automation) and the
# health-ui MCP server loaded explicitly so no project-trust prompt appears.
# IS_SANDBOX=1 lets --dangerously-skip-permissions run under root in this
# sandboxed environment. No `exec`: if Claude exits, the pane drops to a shell
# so the error stays visible (tmux capture-pane).
tmux send-keys -t "$SESSION" \
  "cd '$DATA_DIR' && IS_SANDBOX=1 '$CLAUDE_BIN' --dangerously-skip-permissions --mcp-config '$DATA_DIR/.mcp.json'; echo '[claude session ended]'; exec bash -i" \
  Enter

echo "tmux session '$SESSION' started with Claude"
