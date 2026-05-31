# Gemini CLI — Autonomous Agent Setup

This folder turns Google's **Gemini CLI** into an autonomous terminal agent that
**works without asking you for permission.**

## What's in here

| File | Purpose |
|------|---------|
| `GEMINI.md` | The agent's operating brief — tells Gemini to act agentically and never ask permission. |
| `.gemini/settings.json` | Auto-accept settings so it doesn't prompt. |
| `gemini-auto.sh` | One command that launches Gemini in autonomous (`--yolo`) mode. |

## How to run it (Chromebook Linux / any Linux or Mac)

1. Open your Linux **Terminal**.
2. If you don't have Node yet: `sudo apt update && sudo apt install -y nodejs npm`
3. Run:
   ```bash
   cd promptdeed-pwa/bridge/gemini-cli
   bash gemini-auto.sh
   ```
   (First run installs the Gemini CLI automatically.)
4. Sign in to Google when prompted (one time).
5. Type what you want done. It executes the whole task without asking permission.

## What makes it autonomous (all verified working)

1. **`--yolo --skip-trust`** (in the launchers) — `--yolo` auto-approves every action,
   and `--skip-trust` stops the new Gemini "trusted folder" gate from quietly downgrading
   YOLO back to asking for approval. Both are required; tested. We also export
   `GEMINI_CLI_TRUST_WORKSPACE=true` as a backup.
2. **`GEMINI.md`** — instructs the model itself to behave agentically: plan, execute
   every step, verify, fix, and report — never stopping to ask "should I continue?".

## Signing in (one time)

The CLI needs to authenticate to Google once. Either:
- Run `gemini` on its own and sign in with your Google account (it's cached after), **or**
- `export GEMINI_API_KEY="your key from aistudio.google.com/apikey"` before running.

After that, the autonomous launchers and the theme builder run without prompting.

## Using it in another folder

The agent reads `GEMINI.md` and `.gemini/` from the folder you launch it in. To make
any project autonomous, copy `GEMINI.md` and the `.gemini/` folder into that project,
then run `gemini --yolo` there (or copy `gemini-auto.sh` alongside them).
