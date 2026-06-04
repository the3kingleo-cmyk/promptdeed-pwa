#!/usr/bin/env bash
#
# run-openclaw.sh — install Ollama (if needed) and run OpenClaw as a LOCAL model.
#
# A local model runs entirely on YOUR computer:
#   - No API keys.
#   - No sign-in / account.
#   - Works offline after the one-time model download.
#
# Usage:
#   bash run-openclaw.sh                 # ensure installed + launch OpenClaw's terminal UI
#   bash run-openclaw.sh onboard         # ensure installed + run: openclaw onboard --install-daemon
#   bash run-openclaw.sh --verify        # pull model + run 3 local test prompts, then list models
#   bash run-openclaw.sh --reset-memory  # back up a broken/corrupt OpenClaw memory file, then continue
#
# Flags can combine, e.g.:  bash run-openclaw.sh --reset-memory onboard
#
set -euo pipefail

MODEL="openclaw"
MODE="launch"          # launch | onboard | verify
RESET_MEMORY="false"

say()  { printf '\n\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# ---- parse args -----------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    onboard)         MODE="onboard" ;;
    --verify)        MODE="verify" ;;
    --reset-memory)  RESET_MEMORY="true" ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown argument: $arg  (try --help)" ;;
  esac
done

# ---- 1. install Ollama if missing -----------------------------------------
if ! command -v ollama >/dev/null 2>&1; then
  say "Ollama not found — installing it locally..."
  case "$(uname -s)" in
    Linux)  curl -fsSL https://ollama.com/install.sh | sh ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then brew install ollama
      else die "Install the Ollama app from https://ollama.com/download, then re-run."; fi ;;
    *) die "Unsupported OS. Get Ollama from https://ollama.com/download, then re-run." ;;
  esac
else
  say "Ollama already installed: $(ollama --version 2>/dev/null || echo present)"
fi

# ---- 2. make sure the local engine is up (localhost only) -----------------
if ! curl -fsS -m 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
  say "Starting the local Ollama engine (localhost:11434)..."
  (ollama serve >/dev/null 2>&1 &) || true
  for _ in $(seq 1 20); do
    curl -fsS -m 2 http://localhost:11434/api/tags >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

# ---- 3. (optional) repair a broken/corrupt memory file --------------------
# OpenClaw keeps a local "memory" file; if it gets corrupted you'll see errors
# like "memory file loaded has broken or failed". Moving it aside (with a
# backup, never deleted) makes the tool regenerate a fresh one.
reset_memory_if_requested() {
  [[ "$RESET_MEMORY" == "true" ]] || return 0
  say "Looking for an OpenClaw memory file to reset..."
  local found="false" f
  local candidates=(
    "$HOME/.ollama/openclaw/memory.json"
    "$HOME/.config/openclaw/memory.json"
    "$HOME/.openclaw/memory.json"
    "$HOME/Library/Application Support/openclaw/memory.json"
  )
  # Also discover any *memory* file under the likely config dirs.
  while IFS= read -r f; do candidates+=("$f"); done < <(
    find "$HOME/.ollama" "$HOME/.config/openclaw" "$HOME/.openclaw" \
         "$HOME/Library/Application Support/openclaw" \
         -maxdepth 3 -iname "*memory*" -type f 2>/dev/null
  )
  for f in "${candidates[@]}"; do
    if [[ -f "$f" ]]; then
      local backup="$f.broken.$(date +%s)"
      mv "$f" "$backup"
      warn "Backed up possibly-broken memory file:
  $f
  -> $backup"
      found="true"
    fi
  done
  [[ "$found" == "true" ]] || warn "No memory file found yet (nothing to reset) — that's fine."
}
reset_memory_if_requested

warn "Reminder: LOCAL model — no API key, no sign-in. Avoid '-cloud' tagged models."

# ---- 4. do the requested action -------------------------------------------
case "$MODE" in
  onboard)
    command -v openclaw >/dev/null 2>&1 || die "'openclaw' command not found. Finish the Ollama/OpenClaw install first (run this script with no args once)."
    say "Onboarding OpenClaw + installing the local daemon..."
    openclaw onboard --install-daemon
    say "Onboarding complete. Launch it with:  ollama launch $MODEL"
    ;;
  verify)
    say "Pulling '$MODEL' locally (one-time download)..."
    ollama pull "$MODEL"
    say "Running 3 local test prompts..."
    for i in 1 2 3; do
      echo "===== run $i ====="
      ollama run "$MODEL" "Reply with exactly: local run $i OK"
    done
    say "Models stored on THIS computer:"; ollama list
    warn "Proof it's local? Turn off Wi-Fi and run again — it still answers."
    ;;
  launch)
    say "Launching OpenClaw (local)..."
    ollama launch "$MODEL"
    ;;
esac
