# Forking OpenClaw into Vera North

OpenClaw is **MIT-licensed**, which explicitly permits forking, modifying, and
renaming it — commercial or private. The only obligation is to keep the
original copyright + license notice in the source (`LICENSE`,
`THIRD_PARTY_NOTICES.md`). `rebrand-vera.sh` honors that automatically.

## Steps

```bash
# 1. Get the source (the script does NOT download anything itself)
git clone https://github.com/openclaw/openclaw vera-north
cd vera-north

# 2. Preview the changes without writing anything
bash ../promptdeed-pwa/tools/rebrand-vera.sh . -n

# 3. Apply the display rebrand (safe: build still works)
bash ../promptdeed-pwa/tools/rebrand-vera.sh .

# 4. (Optional) also rename package identifiers, then rebuild
bash ../promptdeed-pwa/tools/rebrand-vera.sh . --deep
pnpm install && pnpm build
```

## What it does

| Layer | What changes | Safe? |
|-------|--------------|-------|
| Default | Display name `OpenClaw` → `Vera North` (+ legacy names Moltbot/Clawdbot/Clawd) in docs, UI strings, titles, manifests | Yes — build unaffected |
| `--emoji` | 🦞 mascot → ✴ | Yes |
| `--deep` | npm `name`, `bin` command, `@openclaw/*` scopes, `import` specifiers | Needs `pnpm install && pnpm build` after; may need manual import fixups |

## What it never touches

- `LICENSE`, `LICENSE.*`, `THIRD_PARTY_NOTICES.md`, `NOTICE*` (MIT attribution)
- `.git/`, `node_modules/`, `dist/`, `build/`, lockfiles
- Anything non-text/binary

It also drops a `NOTICE-FORK.md` recording that Vera North is a renamed
derivative — good open-source manners, and it keeps you cleanly within the
license.

## Customizing the name

Edit the three variables at the top of `rebrand-vera.sh`:

```sh
NEW_NAME="Vera North"   # display name
NEW_SLUG="vera-north"   # package / kebab name
NEW_SCOPE="vera-north"  # replaces the @openclaw npm scope (--deep)
```
