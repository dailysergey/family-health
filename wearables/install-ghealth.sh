#!/usr/bin/env bash
# Build the `ghealth` binary from source and drop it into /usr/local/bin.
# Requires Go 1.21+ on the host.

set -euo pipefail

REPO="https://github.com/Google-Health-API/google-health-cli.git"
DEST="${GHEALTH_BIN:-/usr/local/bin/ghealth}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if ! command -v go >/dev/null 2>&1; then
  echo "go not found. Install Go 1.21+ first: https://go.dev/doc/install" >&2
  exit 1
fi

echo "[wearables] cloning $REPO"
git clone --depth 1 "$REPO" "$TMP/src"

echo "[wearables] building ghealth"
(cd "$TMP/src" && go build -o "$TMP/ghealth" .)

echo "[wearables] installing to $DEST (may need sudo)"
if [ -w "$(dirname "$DEST")" ]; then
  install -m 0755 "$TMP/ghealth" "$DEST"
else
  sudo install -m 0755 "$TMP/ghealth" "$DEST"
fi

echo "[wearables] $DEST → $("$DEST" --version 2>/dev/null || echo installed)"
echo
echo "Next: run 'ghealth setup' once per family member to authenticate with Google Health API."
echo "Then: bash wearables/sync.sh --member <memberId>"
