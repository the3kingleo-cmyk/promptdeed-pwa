#!/usr/bin/env bash
# ===========================================================================
#  run-login-bridge.sh  —  ONE command for the NO-API-KEY login bridge.
# ===========================================================================
#  Opens a real browser. You log in on Google Gemini's and Shopify's own
#  login pages, then it bridges them. No API keys anywhere.
#
#  Run it on a Chromebook Linux (Crostini) terminal, or any Linux/Mac:
#
#       bash run-login-bridge.sh
#
#  First run installs the browser automation engine (one time, ~1 min).
# ===========================================================================

set -euo pipefail
cd "$(dirname "$0")"

echo "==========================================="
echo "  LOGIN BRIDGE: Gemini -> Shopify (no keys)"
echo "==========================================="

# Node check
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js not installed. On Chromebook Linux run:  sudo apt update && sudo apt install -y nodejs npm"
  exit 1
fi

# Install Playwright (the browser engine) locally if it isn't here yet.
if [ ! -d node_modules/playwright ]; then
  echo "First-time setup: installing the browser engine (about a minute)…"
  npm init -y >/dev/null 2>&1 || true
  npm install playwright
  npx playwright install chromium
  # On Chromebook/Debian, also pull in the browser's system libraries:
  npx playwright install-deps chromium 2>/dev/null || \
    echo "(If the browser fails to open, run: sudo npx playwright install-deps chromium)"
fi

echo
echo "Launching the browser. Log in on the pages when they appear."
exec node login-bridge.js "$@"
