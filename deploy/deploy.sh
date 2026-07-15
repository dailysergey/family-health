#!/usr/bin/env bash
# One-shot deploy for family-health.
#
#   bash deploy/deploy.sh
#
# On first run: creates deploy/.env from .env.example, prompts for a PIN,
# generates HEALTH_INGEST_SECRET, seeds data/ from data.example/, checks that
# Claude Code CLI is authenticated on the host, then builds and starts the
# container. Subsequent runs just re-build and restart.

set -euo pipefail

cd "$(dirname "$0")"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'
say() { printf "%s[deploy]%s %s\n" "${BLUE}" "${NC}" "$1"; }
ok()  { printf "%s[  ok  ]%s %s\n" "${GREEN}" "${NC}" "$1"; }
warn(){ printf "%s[ warn ]%s %s\n" "${YELLOW}" "${NC}" "$1"; }
die() { printf "%s[ fail ]%s %s\n" "${RED}"    "${NC}" "$1" >&2; exit 1; }

# --- 1. dependencies --------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker not installed"
docker compose version >/dev/null 2>&1 || die "docker compose plugin missing"

# --- 2. .env ---------------------------------------------------------------
if [ ! -f .env ]; then
  say "Creating deploy/.env from template."
  cp .env.example .env

  # Generate a real ingest secret so nobody ships the placeholder.
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -base64 32 | tr -d '\n')
    # sed -i is portable enough between GNU/BSD if we avoid `-i''` variants.
    sed -i.bak "s|^HEALTH_INGEST_SECRET=.*|HEALTH_INGEST_SECRET=${SECRET}|" .env
    rm -f .env.bak
    ok "Generated HEALTH_INGEST_SECRET."
  else
    warn "openssl not found — edit HEALTH_INGEST_SECRET in deploy/.env manually."
  fi

  # Prompt for PIN if stdin is a tty (skip in CI).
  if [ -t 0 ]; then
    read -r -p "Choose a PIN for web login [1234]: " PIN
    PIN=${PIN:-1234}
    sed -i.bak "s|^HEALTH_PIN=.*|HEALTH_PIN=${PIN}|" .env
    rm -f .env.bak
    ok "Set HEALTH_PIN=${PIN}."
  fi
else
  say "Using existing deploy/.env."
fi

# Load .env so we can validate paths below.
# shellcheck disable=SC1091
set -a; . ./.env; set +a

# --- 3. data volume --------------------------------------------------------
: "${HEALTH_DATA_DIR:=./data}"
# Expand relative path against deploy/.
case "$HEALTH_DATA_DIR" in
  /*) DATA_ABS="$HEALTH_DATA_DIR" ;;
  *)  DATA_ABS="$(pwd)/$HEALTH_DATA_DIR" ;;
esac
mkdir -p "$DATA_ABS"

if [ -z "$(ls -A "$DATA_ABS" 2>/dev/null || true)" ]; then
  if [ -d ../data.example ]; then
    cp -a ../data.example/. "$DATA_ABS/"
    ok "Seeded $DATA_ABS from data.example/."
  else
    warn "$DATA_ABS is empty and data.example/ missing — set up manually."
  fi
fi

# --- 4. Claude credentials --------------------------------------------------
# Expand ~ manually because compose won't do it inside quoted paths.
expand() { case "$1" in "~"*) printf '%s' "$HOME${1#~}" ;; *) printf '%s' "$1" ;; esac; }
CLAUDE_DIR_ABS=$(expand "${CLAUDE_DIR:-~/.claude}")
CLAUDE_JSON_ABS=$(expand "${CLAUDE_JSON:-~/.claude.json}")

if [ ! -d "$CLAUDE_DIR_ABS" ] && [ ! -f "$CLAUDE_JSON_ABS" ]; then
  warn "Claude Code credentials not found at $CLAUDE_DIR_ABS / $CLAUDE_JSON_ABS."
  warn "Run \`claude\` on the host once (OAuth flow), then re-run this script."
  warn "The web will still start, but the chat won't work until credentials are present."
fi

# --- 5. build + up ----------------------------------------------------------
say "Building image (this takes a couple of minutes on first run)."
docker compose build

say "Starting container."
docker compose up -d

# --- 6. wait for health ----------------------------------------------------
say "Waiting for /api/members to come alive."
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:${HEALTH_PORT:-3100}/api/members" >/dev/null 2>&1; then
    ok "Container is up at http://localhost:${HEALTH_PORT:-3100}"
    exit 0
  fi
  sleep 2
done
warn "Container did not become healthy in 60s. Check logs: docker compose logs -f"
exit 1
