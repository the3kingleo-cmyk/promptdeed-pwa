#!/usr/bin/env bash
# ===========================================================================
#  run-bridge.sh  —  ONE command that runs the Gemini → Shopify bridge.
# ===========================================================================
#  Usage:
#       bash run-bridge.sh            # asks you for your 3 keys, then runs
#       bash run-bridge.sh --write    # also saves the new copy into Shopify
#
#  If the 3 values are already set as environment variables, it skips the
#  questions and runs straight away.
# ===========================================================================

set -euo pipefail

# Always work from the folder this script lives in (so it finds the .js file)
cd "$(dirname "$0")"

echo "==========================================="
echo "   GEMINI  ->  SHOPIFY  BRIDGE  (setup)"
echo "==========================================="

# --- collect the three values (prompt only if not already provided) --------
if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo
  echo "Get a free Gemini key at: https://aistudio.google.com/apikey"
  read -r -p "Paste your GEMINI_API_KEY: " GEMINI_API_KEY
fi

if [ -z "${SHOPIFY_STORE_DOMAIN:-}" ]; then
  read -r -p "Your Shopify store domain (e.g. prokitdigital.shop): " SHOPIFY_STORE_DOMAIN
fi

if [ -z "${SHOPIFY_ADMIN_TOKEN:-}" ]; then
  # -s hides the token as you paste it
  read -r -s -p "Paste your SHOPIFY_ADMIN_TOKEN (hidden): " SHOPIFY_ADMIN_TOKEN
  echo
fi

export GEMINI_API_KEY SHOPIFY_STORE_DOMAIN SHOPIFY_ADMIN_TOKEN

# --- make sure Node is available -------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is not installed. Install it from https://nodejs.org (LTS), then re-run."
  exit 1
fi

# --- run the bridge --------------------------------------------------------
echo
echo "Starting the bridge..."
exec node gemini-to-shopify.js "$@"
