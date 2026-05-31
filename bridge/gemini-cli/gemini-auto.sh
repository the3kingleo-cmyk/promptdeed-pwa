#!/usr/bin/env bash
# ===========================================================================
#  gemini-auto.sh  —  Launch the Gemini CLI in fully autonomous mode.
# ===========================================================================
#  Starts Google's Gemini CLI agent with:
#    * --yolo            : auto-approve every action (NO permission prompts)
#    * GEMINI.md         : the agentic operating brief (in this folder)
#    * .gemini/settings  : auto-accept settings (in this folder)
#
#  Run it from a Chromebook Linux (Crostini) terminal, or any Linux/Mac:
#       bash gemini-auto.sh
#  Then just type what you want done — it works without asking permission.
# ===========================================================================

set -euo pipefail
cd "$(dirname "$0")"   # run from this folder so it picks up GEMINI.md + .gemini/

# --- make sure the Gemini CLI is installed ---------------------------------
if ! command -v gemini >/dev/null 2>&1; then
  echo "Gemini CLI not found. Installing it now (needs Node.js 18+)…"
  if ! command -v npm >/dev/null 2>&1; then
    echo "✗ Node.js/npm not installed. On Chromebook Linux run:"
    echo "    sudo apt update && sudo apt install -y nodejs npm"
    exit 1
  fi
  npm install -g @google/gemini-cli
fi

echo "============================================================"
echo "  Gemini CLI — AUTONOMOUS MODE (no permission prompts)"
echo "  Reading agentic brief: GEMINI.md"
echo "============================================================"
echo

# Trust this folder so YOLO is not downgraded back to "ask for approval".
export GEMINI_CLI_TRUST_WORKSPACE=true

# --yolo       = auto-approve every action (no permission prompts)
# --skip-trust = don't gate YOLO behind the trusted-folder prompt
exec gemini --yolo --skip-trust "$@"
