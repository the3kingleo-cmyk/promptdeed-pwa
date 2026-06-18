#!/usr/bin/env node
// Upload play/build/promptdeed-release.aab to Google Play via the Developer API
// and assign it to a release track (internal | alpha | beta | production).
//
// Prereqs (one-time, on your Chromebook):
//   npm i -g googleapis
//   mkdir -p ~/.secrets && chmod 700 ~/.secrets
//   # save the service-account JSON to ~/.secrets/play-service-account.json
//   chmod 600 ~/.secrets/play-service-account.json
//
// In Play Console, the service account email must be granted access:
//   Play Console → Users and permissions → Invite the service account email
//   → Permission set: "Release manager" (or "Admin" if you want it to also
//     write the store listing).
// Then for THIS app: Apps → (your app) → grant the service account.
//
// Usage:
//   PACKAGE=ai.promptdeed.app TRACK=internal node play/scripts/upload.mjs
//
// First push should be TRACK=internal so you can install it on your phone
// via the internal-test link before going to production.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { google } from 'googleapis';

const DEFAULT_KEY = path.join(os.homedir(), '.secrets', 'play-service-account.json');
const KEY_PATH = process.env.PLAY_KEY || DEFAULT_KEY;
const PACKAGE = process.env.PACKAGE || 'ai.promptdeed.app';
const TRACK = process.env.TRACK || 'internal';
const AAB = process.env.AAB || path.resolve('play/build/promptdeed-release.aab');
const WHATS_NEW = fs.readFileSync(
  path.resolve('play/listing/whats-new.txt'), 'utf8'
).trim();

const VALID_TRACKS = new Set(['internal', 'alpha', 'beta', 'production']);
if (!VALID_TRACKS.has(TRACK)) {
  console.error(`✖ TRACK must be one of: ${[...VALID_TRACKS].join(', ')}`);
  process.exit(1);
}
if (!fs.existsSync(KEY_PATH)) {
  console.error(`✖ Service-account JSON not found at: ${KEY_PATH}`);
  console.error(`  Save the JSON there, then chmod 600 it.`);
  process.exit(1);
}
if (!fs.existsSync(AAB)) {
  console.error(`✖ AAB not found at: ${AAB}`);
  console.error(`  Build it first:  bash play/scripts/build.sh`);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const androidpublisher = google.androidpublisher({ version: 'v3', auth });

async function main() {
  console.log(`→ Package:   ${PACKAGE}`);
  console.log(`→ Track:     ${TRACK}`);
  console.log(`→ AAB:       ${AAB}`);
  console.log(`→ Auth file: ${KEY_PATH}`);

  console.log('→ Opening edit...');
  const { data: edit } = await androidpublisher.edits.insert({
    packageName: PACKAGE,
    requestBody: {},
  });
  const editId = edit.id;
  console.log(`  edit id: ${editId}`);

  console.log('→ Uploading AAB...');
  const upload = await androidpublisher.edits.bundles.upload({
    packageName: PACKAGE,
    editId,
    media: {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(AAB),
    },
  });
  const versionCode = upload.data.versionCode;
  console.log(`  uploaded version code: ${versionCode}`);

  console.log(`→ Assigning to "${TRACK}" track...`);
  await androidpublisher.edits.tracks.update({
    packageName: PACKAGE,
    editId,
    track: TRACK,
    requestBody: {
      track: TRACK,
      releases: [{
        name: `${versionCode}`,
        status: TRACK === 'production' ? 'completed' : 'completed',
        versionCodes: [String(versionCode)],
        releaseNotes: [{
          language: 'en-US',
          text: WHATS_NEW.slice(0, 500),
        }],
      }],
    },
  });

  console.log('→ Committing edit...');
  await androidpublisher.edits.commit({
    packageName: PACKAGE,
    editId,
  });

  console.log('');
  console.log('✓ Done.');
  console.log(`  Open https://play.google.com/console → ${PACKAGE} → Testing → ${TRACK}`);
  console.log(`  Version ${versionCode} is now staged to the ${TRACK} track.`);
  if (TRACK === 'production') {
    console.log('  Production submission: a human still has to click "Send X for review"');
    console.log('  the first time, per Play policy.');
  }
}

main().catch((err) => {
  console.error('✖ Upload failed:');
  if (err?.response?.data) {
    console.error(JSON.stringify(err.response.data, null, 2));
  } else {
    console.error(err.stack || err.message || err);
  }
  process.exit(1);
});
