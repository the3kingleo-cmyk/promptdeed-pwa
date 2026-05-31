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

# Feed the brief to Gemini in autonomous mode. -y / --yolo = no permission prompts.
exec gemini --yolo -p "$(cat build-shopify-theme.md)"
