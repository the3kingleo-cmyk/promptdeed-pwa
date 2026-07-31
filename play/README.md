# Promptdeed → Google Play

Everything needed to wrap the Promptdeed PWA as a Trusted Web Activity (TWA)
Android app and publish it to Google Play.

## What's in here

- `twa-manifest.json` — Bubblewrap input that drives the Android build.
- `listing/` — store listing copy (title, short + long description, what's new).
- `scripts/build.sh` — runs Bubblewrap to produce a signed AAB.
- `scripts/upload.mjs` — uploads the AAB to Play via the Developer API.

## One-time setup on your Chromebook

```bash
sudo apt update
sudo apt install -y openjdk-21-jdk git curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm i -g @bubblewrap/cli googleapis
```

Save your Play Developer service-account JSON to `~/.secrets/play-service-account.json`
(`chmod 600`). The upload script reads that path automatically.

## One-time setup in Google Play Console

1. Create the developer account at <https://play.google.com/console/signup>
   ($25, ID verification, 24–48 h wait).
2. **Create app** → Name "Promptdeed" → App / Free → declarations.
3. **Users and permissions → Invite new user** → paste the `client_email`
   from your service-account JSON → permission set **Release manager**
   (or **Admin** if you also want it to write the listing). Grant for this app.
4. **App content** → fill in privacy policy URL, ads declaration, content rating,
   target audience, data safety (Promptdeed collects no data — answer accordingly),
   news app declaration, government app declaration, financial features.
5. **Main store listing** → paste in:
   - `listing/title.txt`
   - `listing/short-description.txt`
   - `listing/description.txt`
   - Screenshots (see "Screenshots" below).
6. **App signing** is handled by Google Play App Signing. The first AAB you
   upload will set the upload key.

## Screenshots (per Play requirements)

You need at least:

- 2 phone screenshots (1080×1920 or larger).
- 1 feature graphic (1024×500 PNG, no transparency).
- App icon: 512×512 PNG (Promptdeed already has `icon-512.png` at repo root).

Easiest path: install the live PWA on your Chromebook
(<https://the3kingleo-cmyk.github.io/promptdeed-pwa/>), use the Files app to
take Ctrl-Show-windows screenshots of the home / category / prompt screens,
then crop to 1080×1920 in Google Photos.

## Build → upload flow

```bash
# Build a signed AAB (first run downloads Android SDK; ~10 min).
bash play/scripts/build.sh

# Push to the INTERNAL TEST track (safe; only invited testers can install).
PACKAGE=ai.promptdeed.app TRACK=internal node play/scripts/upload.mjs

# Install on your phone via the internal-test opt-in link
# (Play Console → Testing → Internal testing → Testers tab → copy link).

# After you've verified it works on a real device:
PACKAGE=ai.promptdeed.app TRACK=production node play/scripts/upload.mjs
```

The first production push requires you to click **"Send for review"** in Play
Console — Google does not allow that step to be automated. Subsequent updates
go through automatically once approved.

## Bumping versions

Before every upload, increment `appVersionCode` (integer) and optionally
`appVersionName` (display string) in `twa-manifest.json`. Play rejects an AAB
whose version code matches a code it has already seen.

## Digital Asset Links (`.well-known/assetlinks.json`)

Once Play accepts your first AAB, Play Console will show you the **SHA-256**
fingerprint of the app-signing certificate (App signing key certificate).
Copy that hash and write it into `.well-known/assetlinks.json` at the root of
the GitHub Pages site:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "ai.promptdeed.app",
    "sha256_cert_fingerprints": ["PASTE_THE_SHA256_FROM_PLAY_CONSOLE_HERE"]
  }
}]
```

Without it the TWA still installs, but Chrome shows the URL bar instead of
running fullscreen.

## Privacy policy

Required by Play before publishing. Paste this URL into the Play Console
**App content → Privacy Policy** field:

> https://the3kingleo-cmyk.github.io/promptdeed-pwa/privacy/

(Create that page in a follow-up — a single static `privacy/index.html` is
enough for what Promptdeed actually does, which is nothing server-side.)
