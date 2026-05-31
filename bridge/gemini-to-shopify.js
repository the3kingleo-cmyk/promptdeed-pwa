#!/usr/bin/env node
/* ===========================================================================
 *  GEMINI  →  SHOPIFY  BRIDGE   (single file, from scratch, no libraries)
 * ===========================================================================
 *  This script connects Google Gemini to your Shopify store and proves it,
 *  step by step. Run it from a terminal:
 *
 *      node gemini-to-shopify.js
 *
 *  It needs three values (set them as environment variables first):
 *
 *      export GEMINI_API_KEY="AIza..."                 # from aistudio.google.com/apikey
 *      export SHOPIFY_STORE_DOMAIN="prokitdigital.shop" # or your *.myshopify.com
 *      export SHOPIFY_ADMIN_TOKEN="shpat_..."           # Shopify admin -> Develop apps
 *
 *  What it does:
 *      1. Checks you supplied the three values.
 *      2. Tests the Gemini connection (says hello, prints the reply).
 *      3. Tests the Shopify connection (prints your store name).
 *      4. Bridges them: pulls one product from Shopify, sends it to Gemini,
 *         and prints fresh marketing copy. With --write it saves the copy
 *         back onto the product in Shopify.
 *
 *  No npm install. Uses Node 18+'s built-in fetch. That's it.
 * ========================================================================= */

'use strict';

const GEMINI_API_KEY      = process.env.GEMINI_API_KEY || '';
const SHOPIFY_STORE_DOMAIN= (process.env.SHOPIFY_STORE_DOMAIN || '').replace(/^https?:\/\//, '');
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || '';
const GEMINI_MODEL        = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const WRITE_BACK          = process.argv.includes('--write');

// ---- tiny console helpers -------------------------------------------------
const ok   = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad  = (m) => console.log('  \x1b[31m✗\x1b[0m ' + m);
const step = (m) => console.log('\n\x1b[1m' + m + '\x1b[0m');

// ===========================================================================
//  GEMINI SIDE  — one function, talks to Google's Generative Language API
// ===========================================================================
async function askGemini(promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/`
            + `${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  }
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

// ===========================================================================
//  SHOPIFY SIDE  — one function, talks to the Shopify Admin GraphQL API
// ===========================================================================
async function shopify(query, variables = {}) {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  if (!res.ok)        throw new Error(`Shopify HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  if (data.errors)    throw new Error(`Shopify GraphQL: ${JSON.stringify(data.errors).slice(0, 300)}`);
  return data.data;
}

// ===========================================================================
//  THE BRIDGE
// ===========================================================================
async function main() {
  console.log('\n===========================================');
  console.log('   GEMINI  →  SHOPIFY  BRIDGE');
  console.log('===========================================');

  // --- 1. config check ----------------------------------------------------
  step('1) Checking your three values');
  const missing = [];
  if (!GEMINI_API_KEY)       missing.push('GEMINI_API_KEY');
  if (!SHOPIFY_STORE_DOMAIN) missing.push('SHOPIFY_STORE_DOMAIN');
  if (!SHOPIFY_ADMIN_TOKEN)  missing.push('SHOPIFY_ADMIN_TOKEN');
  if (missing.length) {
    bad('Missing: ' + missing.join(', '));
    console.log('\n  Set them and re-run, for example:');
    console.log('    export GEMINI_API_KEY="AIza..."');
    console.log('    export SHOPIFY_STORE_DOMAIN="prokitdigital.shop"');
    console.log('    export SHOPIFY_ADMIN_TOKEN="shpat_..."');
    console.log('    node gemini-to-shopify.js\n');
    process.exit(1);
  }
  ok('All three values are set.');

  // --- 2. test Gemini -----------------------------------------------------
  step('2) Connecting to Google Gemini');
  try {
    const reply = await askGemini('Reply with exactly one word: connected');
    ok(`Gemini answered: "${reply}"`);
  } catch (e) {
    bad(e.message);
    process.exit(1);
  }

  // --- 3. test Shopify ----------------------------------------------------
  step('3) Connecting to Shopify');
  let storeName = '';
  try {
    const d = await shopify('{ shop { name myshopifyDomain } }');
    storeName = d.shop.name;
    ok(`Connected to store: ${storeName} (${d.shop.myshopifyDomain})`);
  } catch (e) {
    bad(e.message);
    process.exit(1);
  }

  // --- 4. bridge them: one real product -> Gemini -> copy -----------------
  step('4) Bridging: pulling a product from Shopify and writing copy with Gemini');
  const pdata = await shopify(`
    { products(first: 1, sortKey: UPDATED_AT, reverse: true) {
        nodes { id title productType descriptionHtml }
    } }`);
  const product = pdata.products.nodes[0];
  if (!product) { bad('No products found in the store.'); process.exit(0); }
  ok(`Product: ${product.title}`);

  const current = (product.descriptionHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const prompt =
    `You are an expert e-commerce copywriter. Improve this Shopify product.\n` +
    `Title: ${product.title}\nType: ${product.productType || 'n/a'}\n` +
    `Current description: ${current || '(none)'}\n\n` +
    `Write a polished HTML product description (2 short paragraphs + a <ul> of benefits).`;

  const copy = await askGemini(prompt);
  console.log('\n--- Gemini wrote: -------------------------------------------');
  console.log(copy);
  console.log('-------------------------------------------------------------');

  // --- 5. optional: write it back to Shopify ------------------------------
  if (WRITE_BACK) {
    step('5) Saving the new copy back onto the product in Shopify');
    await shopify(
      `mutation($input: ProductInput!){ productUpdate(input:$input){ userErrors{ message } } }`,
      { input: { id: product.id, descriptionHtml: copy } }
    );
    ok('Saved. Refresh the product in your Shopify admin to see it.');
  } else {
    console.log('\n  (Preview only. Re-run with  --write  to save it into Shopify.)');
  }

  console.log('\n\x1b[32m✓ Bridge complete. Gemini and Shopify are connected.\x1b[0m\n');
}

main().catch((e) => { console.error('\n\x1b[31mFATAL:\x1b[0m ' + (e.stack || e.message)); process.exit(1); });
