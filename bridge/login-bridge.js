#!/usr/bin/env node
/* ===========================================================================
 *  LOGIN-PAGE BRIDGE  —  Google Gemini  →  Shopify   (NO API KEYS)
 * ===========================================================================
 *  This does NOT use any API keys. It opens a real browser, you log in on the
 *  real Google Gemini login page and the real Shopify login page (just like
 *  normal), and then it drives those logged-in pages for you:
 *
 *     1. Opens Shopify admin  -> you log in on Shopify's own login page.
 *     2. Opens Google Gemini  -> you log in with your Google account.
 *     3. Bridges them: it reads the product you have open in Shopify, asks
 *        Gemini (in the Gemini web app) to write new copy, then drops that
 *        copy into the product's description for you to review and Save.
 *
 *  Your logins are remembered in a local browser profile folder, so you only
 *  sign in once. Nothing is sent anywhere except Google and Shopify, in your
 *  own browser.
 *
 *  Runs on a Chromebook Linux (Crostini) terminal, or any Linux/Mac.
 *  Setup is handled by run-login-bridge.sh (installs the browser, then runs this).
 * ========================================================================= */

'use strict';

const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const PROFILE_DIR = path.join(__dirname, '.browser-profile'); // remembers your logins
const STORE_HANDLE = process.env.SHOPIFY_STORE_HANDLE || 'vyycqv-vf'; // admin.shopify.com/store/<this>

// small helper: wait for the user to press Enter in the terminal
function waitForEnter(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question('\n👉 ' + message + ' — then press ENTER here. ', () => { rl.close(); resolve(); }));
}

// Ask the Gemini web app a question and read its answer (no API key — the web UI).
async function askGeminiWeb(page, promptText) {
  // The Gemini prompt box is a contenteditable rich text area.
  const box = page.locator('div[contenteditable="true"]').last();
  await box.click();
  await box.fill('');                 // clear anything
  await box.type(promptText, { delay: 5 });
  await page.keyboard.press('Enter'); // send

  // Wait until Gemini finishes answering: watch the last response settle.
  const responses = page.locator('message-content, .model-response-text, .markdown');
  let prev = '', stable = 0;
  for (let i = 0; i < 60; i++) {            // up to ~60s
    await page.waitForTimeout(1000);
    const count = await responses.count();
    if (count === 0) continue;
    const text = (await responses.last().innerText().catch(() => '')) || '';
    if (text && text === prev) { stable++; if (stable >= 3) break; } // unchanged 3s = done
    else { stable = 0; prev = text; }
  }
  return prev.trim();
}

async function main() {
  console.log('\n=== LOGIN-PAGE BRIDGE: Gemini → Shopify (no API keys) ===\n');

  // One real browser window, remembering your logins between runs.
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,            // you need to SEE it to log in
    viewport: null,
    args: ['--start-maximized'],
  });

  // ---- 1. Shopify: log in on Shopify's real login page -------------------
  const shop = ctx.pages()[0] || await ctx.newPage();
  await shop.goto(`https://admin.shopify.com/store/${STORE_HANDLE}/products`, { waitUntil: 'domcontentloaded' });
  await waitForEnter('Log in to SHOPIFY in the window if asked, and open the PRODUCT you want to update');

  // ---- 2. Gemini: log in with your Google account ------------------------
  const gem = await ctx.newPage();
  await gem.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
  await waitForEnter('Log in to GOOGLE GEMINI in this new tab (if asked)');

  // ---- 3. Bridge: read the open product, ask Gemini, fill the description -
  await shop.bringToFront();
  // Grab the product title from the open Shopify product page.
  const titleInput = shop.locator('input[name="title"], input[aria-label="Title"]').first();
  const title = (await titleInput.inputValue().catch(() => '')) || (await waitForEnter('Could not auto-read the title. Type the product name in the terminal'), '');

  console.log(`\nProduct: ${title || '(unknown)'}`);
  console.log('Asking Gemini for new copy…');

  await gem.bringToFront();
  const copy = await askGeminiWeb(gem,
    `Write a polished Shopify product description for "${title}". ` +
    `2 short paragraphs plus a short bulleted list of benefits. Plain text is fine.`);

  console.log('\n--- Gemini wrote: -------------------------------------------');
  console.log(copy || '(no response captured — the Gemini page layout may have changed)');
  console.log('-------------------------------------------------------------');

  // Put the copy into the Shopify description editor (you review + click Save).
  if (copy) {
    await shop.bringToFront();
    const desc = shop.locator('[contenteditable="true"]').first(); // description rich-text editor
    await desc.click().catch(() => {});
    await desc.type(copy, { delay: 2 }).catch(() => {});
    console.log('\n✓ Dropped the copy into the description. Review it and click SAVE in Shopify.');
  }

  await waitForEnter('Done. Press ENTER to close the browser');
  await ctx.close();
}

main().catch((e) => { console.error('\nERROR: ' + (e.stack || e.message)); process.exit(1); });
