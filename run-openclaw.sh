#!/usr/bin/env bash
#
# run-openclaw.sh — install Ollama (if needed) and launch OpenClaw as a LOCAL model.
#
# A local model runs entirely on YOUR computer:
#   - No API keys.
#   - No sign-in / account.
#   - Works offline after the one-time model download.
#
# Usage:
#   bash run-openclaw.sh            # install (if needed) + launch OpenClaw's terminal UI
#   bash run-openclaw.sh --verify   # run 3 quick non-interactive prompts to prove it's local
#
set -euo pipefail

MODEL="openclaw"

say()  { printf '\n\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# 1. Install Ollama if it isn't already on this machine.
if ! command -v ollama >/dev/null 2>&1; then
  say "Ollama not found — installing it locally..."
  case "$(uname -s)" in
    Linux)
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        brew install ollama
      else
        die "Please install the Ollama app from https://ollama.com/download, then re-run this script."
      fi
      ;;
    *)
      die "Unsupported OS. Download Ollama from https://ollama.com/download, then re-run this script."
      ;;
  esac
else
  say "Ollama already installed: $(ollama --version 2>/dev/null || echo present)"
fi

# 2. Make sure the local engine is running (it listens on localhost only).
if ! curl -fsS -m 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
  say "Starting the local Ollama engine (localhost:11434)..."
  (ollama serve >/dev/null 2>&1 &) || true
  for _ in $(seq 1 20); do
    curl -fsS -m 2 http://localhost:11434/api/tags >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

# Friendly reminder: stay local.
warn "Reminder: this is a LOCAL model — no API key, no sign-in needed."
warn "Avoid any model tagged with '-cloud' if you want to stay 100% on this computer."

# 3a. Verify mode: prove it runs locally with 3 quick prompts.
if [[ "${1:-}" == "--verify" ]]; then
  say "Pulling '$MODEL' locally (one-time download)..."
  ollama pull "$MODEL"
  say "Running 3 local test prompts..."
  for i in 1 2 3; do
    echo "===== run $i ====="
    ollama run "$MODEL" "Reply with exactly: local run $i OK"
  done
  say "Done. Models stored on THIS computer:"
  ollama list
  warn "Want proof it's local? Turn off Wi-Fi and run this again — it still answers."
  exit 0
fi

# 3b. Default: launch the OpenClaw terminal UI.
say "Launching OpenClaw (local)..."
ollama launch "$MODEL"
