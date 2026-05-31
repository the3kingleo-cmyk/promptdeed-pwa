#!/usr/bin/env bash
# ===========================================================================
#  build-theme.sh  —  Have Gemini autonomously build a high-quality Shopify theme.
# ===========================================================================
#  Runs the Gemini CLI in autonomous (--yolo) mode against the detailed theme
#  brief in build-shopify-theme.md. It creates a complete Online Store 2.0
#  theme in a ./theme folder, ready to zip and upload to Shopify.
#
#  Usage (Chromebook Linux / any Linux or Mac terminal):
#       bash build-theme.sh
# ===========================================================================

set -euo pipefail
cd "$(dirname "$0")"

# Install the Gemini CLI if needed
if ! command -v gemini >/dev/null 2>&1; then
  echo "Installing the Gemini CLI (needs Node.js 18+)…"
  command -v npm >/dev/null 2>&1 || { echo "✗ Install Node first: sudo apt install -y nodejs npm"; exit 1; }
  npm install -g @google/gemini-cli
fi

echo "============================================================"
echo "  Building a high-quality Shopify theme with Gemini (auto)"
echo "============================================================"

# You must be authenticated first — either:
#   (a) run  gemini  once interactively and sign in with Google (cached after), or
#   (b) export GEMINI_API_KEY="..."  before running this.
if [ -z "${GEMINI_API_KEY:-}" ] && [ ! -f "$HOME/.gemini/oauth_creds.json" ] && [ ! -f "$HOME/.gemini/google_accounts.json" ]; then
  echo "Note: not signed in yet. If it errors on auth, run 'gemini' once to log in,"
  echo "      or set  export GEMINI_API_KEY=\"your key\"  then re-run."
fi

# Trust the folder so YOLO stays on (otherwise it downgrades to asking for approval).
export GEMINI_CLI_TRUST_WORKSPACE=true

# --yolo + --skip-trust = fully autonomous, no permission prompts. -p = headless run.
exec gemini --yolo --skip-trust -p "$(cat build-shopify-theme.md)"
