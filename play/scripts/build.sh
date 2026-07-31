#!/usr/bin/env bash
# Build a signed Android App Bundle (AAB) for Promptdeed from the PWA.
#
# Prereqs (one-time, on your Chromebook penguin shell):
#   sudo apt install -y openjdk-21-jdk
#   npm i -g @bubblewrap/cli
#
# What this script does:
#   1. Initializes the Bubblewrap project from play/twa-manifest.json
#      (the first run will download the Android SDK + Gradle to ~/.bubblewrap).
#   2. Builds a release AAB signed with play/android.keystore.
#   3. Copies the output to play/build/promptdeed-release.aab
#
# First run will prompt you to:
#   - confirm/create the signing keystore (use any password you'll remember
#     and write it down; you cannot rotate this without losing the listing).
#   - confirm SDK install (just say yes).
#
# Re-runs reuse the same keystore and just rebuild. Bump appVersionCode in
# play/twa-manifest.json before each upload — Play rejects duplicate codes.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLAY_DIR="$REPO_ROOT/play"
MANIFEST="$PLAY_DIR/twa-manifest.json"
BUILD_DIR="$PLAY_DIR/build"

if ! command -v bubblewrap >/dev/null 2>&1; then
  echo "✖ bubblewrap CLI not installed."
  echo "  Run:  npm i -g @bubblewrap/cli"
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "✖ Java (JDK) not installed."
  echo "  Run:  sudo apt install -y openjdk-21-jdk"
  exit 1
fi

cd "$PLAY_DIR"
mkdir -p "$BUILD_DIR"

if [ ! -f "twa-manifest-bubblewrap.json" ]; then
  echo "→ First-time init: copying manifest into Bubblewrap-managed file."
  cp "$MANIFEST" twa-manifest-bubblewrap.json
fi

echo "→ Running bubblewrap update (refreshes Android project from manifest)..."
bubblewrap update --manifest=twa-manifest-bubblewrap.json --skipVersionUpgrade

echo "→ Building signed release AAB..."
bubblewrap build --manifest=twa-manifest-bubblewrap.json --skipPwaValidation

# Bubblewrap writes app-release-bundle.aab to the play/ dir.
if [ -f "app-release-bundle.aab" ]; then
  mv -f app-release-bundle.aab "$BUILD_DIR/promptdeed-release.aab"
  echo "✓ AAB built: $BUILD_DIR/promptdeed-release.aab"
  ls -la "$BUILD_DIR/promptdeed-release.aab"
else
  echo "✖ Build finished but app-release-bundle.aab not found." >&2
  echo "  Look in $PLAY_DIR for the actual output and adjust this script." >&2
  exit 1
fi
