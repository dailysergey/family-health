#!/usr/bin/env bash
# Pull daily-rollup metrics from Google Health API for family members that
# have `wearables.enabled: true` in family.json, and store them as one JSON
# file per day under data/<memberId>/wearables/.
#
#   bash wearables/sync.sh                    # every enabled member, last 2 days
#   bash wearables/sync.sh --member parent1   # single member
#   bash wearables/sync.sh --days 7           # override lookback window
#   bash wearables/sync.sh --dry-run          # print what would happen
#
# Idempotent: overwriting the day's file if it exists is fine.

set -euo pipefail

# --- config ---------------------------------------------------------------
DATA_DIR="${HEALTH_DATA_DIR:-$(cd "$(dirname "$0")/../data" && pwd 2>/dev/null || echo "$(dirname "$0")/../data")}"
DAYS=2
MEMBER=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --member)   MEMBER="$2"; shift 2 ;;
    --days)     DAYS="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    --data-dir) DATA_DIR="$2"; shift 2 ;;
    -h|--help)  sed -n '2,10p' "$0"; exit 0 ;;
    *)          echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

command -v ghealth >/dev/null 2>&1 || { echo "ghealth not installed. Run wearables/install-ghealth.sh first." >&2; exit 1; }
command -v jq      >/dev/null 2>&1 || { echo "jq not installed. apt install jq / brew install jq." >&2; exit 1; }

FAMILY_JSON="$DATA_DIR/family.json"
[ -f "$FAMILY_JSON" ] || { echo "family.json not found at $FAMILY_JSON" >&2; exit 1; }

# --- helpers --------------------------------------------------------------
log() { printf "[wearables] %s\n" "$*"; }

sync_member() {
  local mid="$1"
  local cfg="$2"
  local from="$3"
  local to="$4"

  log "→ $mid  ($from…$to)  GHEALTH_CONFIG_DIR=$cfg"
  local outdir="$DATA_DIR/$mid/wearables"
  mkdir -p "$outdir"

  # Iterate each day in the window (inclusive) — one file per day so the UI can
  # cheaply grab the last N without parsing month blobs.
  local d="$from"
  while : ; do
    local dayfile="$outdir/$d.json"
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "    would write $dayfile"
    else
      # Pull each metric individually; ghealth's daily-rollup schema differs by type.
      # jq -n --slurpfile assembles the aggregate.
      local tmp; tmp=$(mktemp)
      GHEALTH_CONFIG_DIR="$cfg" ghealth data steps                      daily-rollup --from "$d" --to "$d" --json 2>/dev/null > "$tmp.steps"       || echo '{}' > "$tmp.steps"
      GHEALTH_CONFIG_DIR="$cfg" ghealth data heart-rate                 daily-rollup --from "$d" --to "$d" --json 2>/dev/null > "$tmp.hr"          || echo '{}' > "$tmp.hr"
      GHEALTH_CONFIG_DIR="$cfg" ghealth data sleep                      list          --from "$d" --to "$d" --json 2>/dev/null > "$tmp.sleep"       || echo '[]' > "$tmp.sleep"
      GHEALTH_CONFIG_DIR="$cfg" ghealth data active-energy-burned       daily-rollup --from "$d" --to "$d" --json 2>/dev/null > "$tmp.aek"         || echo '{}' > "$tmp.aek"
      GHEALTH_CONFIG_DIR="$cfg" ghealth data active-zone-minutes        daily-rollup --from "$d" --to "$d" --json 2>/dev/null > "$tmp.azm"         || echo '{}' > "$tmp.azm"
      GHEALTH_CONFIG_DIR="$cfg" ghealth data daily-resting-heart-rate   list          --from "$d" --to "$d" --json 2>/dev/null > "$tmp.rhr"         || echo '[]' > "$tmp.rhr"
      GHEALTH_CONFIG_DIR="$cfg" ghealth data daily-heart-rate-variability list        --from "$d" --to "$d" --json 2>/dev/null > "$tmp.hrv"         || echo '[]' > "$tmp.hrv"
      GHEALTH_CONFIG_DIR="$cfg" ghealth data daily-oxygen-saturation    list          --from "$d" --to "$d" --json 2>/dev/null > "$tmp.spo2"        || echo '[]' > "$tmp.spo2"
      GHEALTH_CONFIG_DIR="$cfg" ghealth data vo2-max                    list          --from "$d" --to "$d" --json 2>/dev/null > "$tmp.vo2"         || echo '[]' > "$tmp.vo2"

      jq -n \
        --arg date "$d" --arg member "$mid" \
        --slurpfile steps "$tmp.steps" \
        --slurpfile hr    "$tmp.hr" \
        --slurpfile sleep "$tmp.sleep" \
        --slurpfile aek   "$tmp.aek" \
        --slurpfile azm   "$tmp.azm" \
        --slurpfile rhr   "$tmp.rhr" \
        --slurpfile hrv   "$tmp.hrv" \
        --slurpfile spo2  "$tmp.spo2" \
        --slurpfile vo2   "$tmp.vo2" \
        '{
          date: $date, member: $member, source: "ghealth",
          steps: $steps[0], heart_rate: $hr[0], sleep: $sleep[0],
          active_energy_kcal: $aek[0], active_zone_minutes: $azm[0],
          resting_heart_rate: $rhr[0], hrv: $hrv[0],
          spo2: $spo2[0], vo2max: $vo2[0]
        }' > "$dayfile"

      rm -f "$tmp".*
      log "    ✓ $dayfile"
    fi

    [ "$d" = "$to" ] && break
    # Portable date arithmetic (GNU date). BSD/macOS: replace with `date -j -v+1d`.
    d=$(date -u -d "$d + 1 day" +%F 2>/dev/null || date -j -v+1d -f %F "$d" +%F)
  done

  # Refresh latest.json symlink to the newest day file (portable ln -sfn).
  if [ "$DRY_RUN" -eq 0 ]; then
    ln -sfn "$to.json" "$outdir/latest.json"
  fi
}

# --- main -----------------------------------------------------------------
today=$(date -u +%F)
from=$(date -u -d "$today - $((DAYS-1)) day" +%F 2>/dev/null || date -j -v-$((DAYS-1))d -f %F "$today" +%F)

if [ -n "$MEMBER" ]; then
  cfg=$(jq -r --arg m "$MEMBER" \
    '.[] | select(.id==$m) | (.wearables.ghealth_config_dir // ("~/.config/ghealth/" + .id))' \
    "$FAMILY_JSON")
  cfg=${cfg/#~/$HOME}
  [ -n "$cfg" ] || { echo "member $MEMBER not found in family.json" >&2; exit 1; }
  sync_member "$MEMBER" "$cfg" "$from" "$today"
  exit 0
fi

# All enabled members.
jq -c '.[] | select(.wearables.enabled == true)' "$FAMILY_JSON" | while read -r row; do
  mid=$(jq -r '.id' <<<"$row")
  cfg=$(jq -r '.wearables.ghealth_config_dir // ("~/.config/ghealth/" + .id)' <<<"$row")
  cfg=${cfg/#~/$HOME}
  sync_member "$mid" "$cfg" "$from" "$today"
done
