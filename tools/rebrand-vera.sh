#!/usr/bin/env bash
#
# rebrand-vera.sh — turn a clone of OpenClaw (MIT) into your own "Vera North" fork.
#
# OpenClaw is MIT-licensed, which permits forking, modifying and renaming.
# The ONLY thing MIT asks you to keep is the original copyright/license notice
# in the source tree — so this script deliberately never touches:
#     LICENSE, LICENSE.*, THIRD_PARTY_NOTICES.md, NOTICE*
# and it appends a fork notice instead of deleting attribution.
#
# USAGE:
#   1. Get the source yourself (this script does not download it):
#        git clone https://github.com/openclaw/openclaw vera-north
#        cd vera-north
#   2. Run this script against that clone:
#        bash /path/to/rebrand-vera.sh .
#
#   Flags:
#     --deep    Also rename package identifiers: the npm "name", the bin
#               command, @openclaw/* workspace scopes, and import specifiers.
#               This WILL require `pnpm install && pnpm build` afterward and
#               may need manual import fixups. Off by default.
#     --emoji   Also swap the 🦞 mascot emoji for ✴ (off by default).
#     -n        Dry run: show what would change, write nothing.
#
# It is safe to run more than once.

set -euo pipefail

# ---- Your brand. Change these two lines if you want a different name. --------
NEW_NAME="Vera North"     # display name
NEW_SLUG="vera-north"     # package / kebab name
NEW_SCOPE="vera-north"    # replacement for the @openclaw npm scope (--deep)
# -----------------------------------------------------------------------------

TARGET="${1:-}"; shift || true
DEEP=0; EMOJI=0; DRY=0
for arg in "$@"; do
  case "$arg" in
    --deep) DEEP=1 ;;
    --emoji) EMOJI=1 ;;
    -n|--dry-run) DRY=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "$TARGET" || ! -d "$TARGET" ]]; then
  echo "Usage: bash rebrand-vera.sh <path-to-openclaw-clone> [--deep] [--emoji] [-n]" >&2
  exit 2
fi
if [[ ! -f "$TARGET/package.json" ]]; then
  echo "Refusing: $TARGET doesn't look like the OpenClaw repo (no package.json)." >&2
  exit 2
fi

cd "$TARGET"

# Files we never rewrite: VCS internals, deps, build output, lockfiles,
# binaries, and — importantly — the license/attribution files.
PRUNE_DIRS='-name .git -o -name node_modules -o -name dist -o -name build -o -name .next -o -name coverage'
KEEP_REGEX='(^|/)(LICENSE|LICENSE\..*|THIRD_PARTY_NOTICES\.md|NOTICE.*|.*lock.*|npm-shrinkwrap\.json|pnpm-lock\.yaml)$'
# Only touch text we can safely edit.
TEXT_EXT='-e \.(md|markdown|txt|json|jsonc|ts|tsx|js|jsx|mjs|cjs|vue|svelte|css|scss|html|htm|yml|yaml|toml|env\.example|webmanifest)$'

mapfile -t FILES < <(
  find . \( $PRUNE_DIRS \) -prune -o -type f -print \
  | sed 's|^\./||' \
  | grep -Ev "$KEEP_REGEX" \
  | grep -E $TEXT_EXT || true
)

echo "Rebranding to: $NEW_NAME ($NEW_SLUG)"
echo "Files in scope: ${#FILES[@]}   deep=$DEEP emoji=$EMOJI dry-run=$DRY"
echo "Preserving: LICENSE, THIRD_PARTY_NOTICES.md, NOTICE*, lockfiles"
echo

# Build the sed program.
# Layer 1 (always): display branding only.
PROG="s/OpenClaw/${NEW_NAME}/g;"
# Legacy display names OpenClaw shipped under:
PROG+="s/Moltbot/${NEW_NAME}/g; s/Clawdbot/${NEW_NAME}/g; s/Clawd\b/${NEW_NAME}/g;"
if [[ $EMOJI -eq 1 ]]; then PROG+=$'s/\xF0\x9F\xA6\x9E/\xE2\x9C\xB4/g;'; fi

# Layer 2 (--deep): package identifiers. Order matters (scope before bare slug).
if [[ $DEEP -eq 1 ]]; then
  PROG+="s/@openclaw\//@${NEW_SCOPE}\//g;"   # workspace scope
  PROG+="s/\bopenclaw\b/${NEW_SLUG}/g;"      # npm name, bin, import specifiers
fi

changed=0
for f in "${FILES[@]}"; do
  match=0
  grep -Eqi 'openclaw|moltbot|clawdbot|clawd' "$f" && match=1
  if [[ $EMOJI -eq 1 ]] && grep -q $'\xF0\x9F\xA6\x9E' "$f"; then match=1; fi
  if [[ $match -eq 1 ]]; then
    if [[ $DRY -eq 1 ]]; then
      echo "would edit: $f"
    else
      sed -i.bak -E "$PROG" "$f" && rm -f "$f.bak"
      echo "edited: $f"
    fi
    changed=$((changed+1))
  fi
done

echo
echo "Touched $changed file(s)."

# Append a fork notice next to the preserved license (MIT good-citizenship).
if [[ $DRY -eq 0 ]]; then
  NOTICE="NOTICE-FORK.md"
  if [[ ! -f "$NOTICE" ]]; then
    cat > "$NOTICE" <<EOF
# About this fork

**${NEW_NAME}** is a personal fork/rebrand of **OpenClaw**
(https://github.com/openclaw/openclaw), used under the MIT License.

The original copyright and MIT license terms are retained in \`LICENSE\` and
\`THIRD_PARTY_NOTICES.md\` in this repository, as the license requires. This
file only records that ${NEW_NAME} is a renamed derivative; it does not
replace or alter those notices.
EOF
    echo "Wrote $NOTICE (records the fork; LICENSE left intact)."
  fi
fi

echo
if [[ $DEEP -eq 1 ]]; then
  cat <<EOF
NEXT (because you used --deep):
  pnpm install
  pnpm build
  # If the build complains about unresolved imports, a few internal modules
  # may reference the old package name in ways sed can't see (template strings,
  # dynamic import()). Search and fix:
  #   grep -rn "openclaw" src apps packages --include=*.ts | grep -i import
EOF
else
  cat <<EOF
Display branding done. Package identifiers (npm name, bin command, @openclaw
scopes, imports) were left intact so the build still works. When you're ready
to rename those too, re-run with --deep and rebuild.
EOF
fi
