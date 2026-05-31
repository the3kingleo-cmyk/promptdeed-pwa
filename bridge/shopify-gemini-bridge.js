/**
 * Shopify ↔ Google Gemini Bridge
 * --------------------------------
 * Runs once per day (via GitHub Actions, or manually with `node shopify-gemini-bridge.js`).
 *
 * What it does, in plain English:
 *   1. Connects to your Shopify store and pulls down your products.
 *   2. Sends each product to Google Gemini and asks the AI to write fresh,
 *      sales-ready marketing copy + SEO text + a social caption.
 *   3. Saves everything to a dated report in bridge/output/ (and updates latest.md).
 *   4. OPTIONALLY writes the new copy back into Shopify (off by default — safe).
 *
 * It needs three things, given as environment variables / GitHub Secrets:
 *   SHOPIFY_STORE_DOMAIN   e.g.  your-store.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN    a Shopify Admin API access token (shpat_...)
 *   GEMINI_API_KEY         a Google AI Studio / Gemini API key
 *
 * Optional knobs (all have sensible defaults):
 *   GEMINI_MODEL           default: gemini-2.0-flash
 *   SHOPIFY_API_VERSION    default: 2025-01
 *   MAX_PRODUCTS           default: 25   (how many products to process per run)
 *   WRITE_BACK             default: false (set "true" to push copy back to Shopify)
 *
 * No npm dependencies required — uses Node 18+ built-in fetch.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CONFIG = {
  shopDomain: process.env.SHOPIFY_STORE_DOMAIN || '',
  adminToken: process.env.SHOPIFY_ADMIN_TOKEN || '',
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  apiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
  maxProducts: parseInt(process.env.MAX_PRODUCTS || '25', 10),
  writeBack: String(process.env.WRITE_BACK || 'false').toLowerCase() === 'true',
};

const OUTPUT_DIR = path.join(__dirname, 'output');

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function log(...args) {
  console.log(...args);
}

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function checkConfig() {
  const missing = [];
  if (!CONFIG.shopDomain) missing.push('SHOPIFY_STORE_DOMAIN');
  if (!CONFIG.adminToken) missing.push('SHOPIFY_ADMIN_TOKEN');
  if (!CONFIG.geminiKey) missing.push('GEMINI_API_KEY');

  if (missing.length) {
    // The robot is installed but not yet given its administrative access.
    // Exit cleanly (success) so the daily workflow stays GREEN and quiet —
    // it simply skips until the keys are pasted in. No error emails.
    log(
      `\n⏸️  Robot is installed but idle — waiting for its administrative access.\n` +
      `   Missing: ${missing.join(', ')}\n\n` +
      `   Add these as GitHub Secrets (one time) to switch it on. Exact steps:\n` +
      `   bridge/README.md → "Give the robot its administrative access".\n` +
      `   Skipping this run.`
    );
    process.exit(0);
  }

  // Normalize: allow either "store" or "store.myshopify.com"
  if (!CONFIG.shopDomain.includes('.')) {
    CONFIG.shopDomain = `${CONFIG.shopDomain}.myshopify.com`;
  }
}

// ---------------------------------------------------------------------------
// Shopify side of the bridge (Admin GraphQL API)
// ---------------------------------------------------------------------------
async function shopifyGraphQL(query, variables = {}) {
  const url = `https://${CONFIG.shopDomain}/admin/api/${CONFIG.apiVersion}/graphql.json`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': CONFIG.adminToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Shopify API ${resp.status}: ${body.slice(0, 500)}`);
  }

  const json = await resp.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors).slice(0, 500)}`);
  }
  return json.data;
}

async function fetchProducts(limit) {
  log(`→ Fetching up to ${limit} products from ${CONFIG.shopDomain}...`);
  const query = `
    query Products($first: Int!) {
      products(first: $first, sortKey: UPDATED_AT, reverse: true) {
        nodes {
          id
          title
          handle
          productType
          tags
          descriptionHtml
          onlineStoreUrl
          featuredImage { url altText }
        }
      }
    }`;
  const data = await shopifyGraphQL(query, { first: limit });
  const products = data.products?.nodes || [];
  log(`  Got ${products.length} products.`);
  return products;
}

async function updateProductDescription(productId, descriptionHtml) {
  const mutation = `
    mutation UpdateProduct($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id }
        userErrors { field message }
      }
    }`;
  const data = await shopifyGraphQL(mutation, {
    input: { id: productId, descriptionHtml },
  });
  const errors = data.productUpdate?.userErrors || [];
  if (errors.length) {
    throw new Error(`productUpdate errors: ${JSON.stringify(errors)}`);
  }
}

// ---------------------------------------------------------------------------
// Gemini side of the bridge (Generative Language API)
// ---------------------------------------------------------------------------
async function callGemini(promptText) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiKey}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${body.slice(0, 500)}`);
  }

  const json = await resp.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini returned no text: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return text.trim();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(product) {
  const current = stripHtml(product.descriptionHtml) || '(no description yet)';
  return [
    `You are an expert e-commerce copywriter and SEO specialist.`,
    `Improve the marketing content for the following Shopify product.`,
    ``,
    `Product title: ${product.title}`,
    `Product type: ${product.productType || 'n/a'}`,
    `Tags: ${(product.tags || []).join(', ') || 'none'}`,
    `Current description: ${current}`,
    ``,
    `Return STRICT JSON only (no markdown fences) with exactly these keys:`,
    `{`,
    `  "description_html": "a polished, persuasive product description as clean HTML (2-3 short paragraphs, may include a <ul> of benefits)",`,
    `  "seo_title": "<= 60 character SEO page title",`,
    `  "seo_description": "<= 155 character meta description",`,
    `  "social_caption": "an upbeat social media caption with 2-4 relevant hashtags"`,
    `}`,
  ].join('\n');
}

function parseGeminiJson(text) {
  // Gemini sometimes wraps JSON in ```json fences — strip them defensively.
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null; // caller falls back to raw text
  }
}

// ---------------------------------------------------------------------------
// Report writers
// ---------------------------------------------------------------------------
function writeReport(date, results) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Full machine-readable record
  const jsonPath = path.join(OUTPUT_DIR, `${date}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        date,
        store: CONFIG.shopDomain,
        model: CONFIG.geminiModel,
        wroteBackToShopify: CONFIG.writeBack,
        count: results.length,
        results,
      },
      null,
      2
    )
  );
  log(`✓ Wrote ${jsonPath}`);

  // Human-friendly markdown summary
  const lines = [
    `# Shopify ↔ Gemini Bridge — ${date}`,
    ``,
    `**Store:** ${CONFIG.shopDomain}  `,
    `**AI model:** ${CONFIG.geminiModel}  `,
    `**Products processed:** ${results.length}  `,
    `**Wrote changes back to Shopify:** ${CONFIG.writeBack ? 'yes' : 'no (preview only)'}  `,
    ``,
  ];

  for (const r of results) {
    lines.push(`## ${r.title}`);
    if (r.error) {
      lines.push(``, `> ⚠️ ${r.error}`, ``);
      continue;
    }
    const ai = r.generated || {};
    lines.push(``);
    if (ai.seo_title) lines.push(`**SEO title:** ${ai.seo_title}  `);
    if (ai.seo_description) lines.push(`**SEO description:** ${ai.seo_description}  `);
    if (ai.social_caption) lines.push(`**Social caption:** ${ai.social_caption}  `);
    if (ai.description_html) {
      lines.push(``, `**New description (HTML):**`, ``, '```html', ai.description_html, '```');
    } else if (r.raw) {
      lines.push(``, '```', r.raw, '```');
    }
    lines.push(``);
  }

  lines.push(`_Last updated: ${new Date().toISOString()}_`);

  const mdPath = path.join(OUTPUT_DIR, 'latest.md');
  fs.writeFileSync(mdPath, lines.join('\n'));
  log(`✓ Wrote ${mdPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  log('🌉 Shopify ↔ Gemini bridge starting...');
  checkConfig();

  const products = await fetchProducts(CONFIG.maxProducts);
  if (!products.length) {
    log('No products found — nothing to do. Writing empty report.');
    writeReport(new Date().toISOString().split('T')[0], []);
    return;
  }

  const results = [];
  for (const product of products) {
    log(`→ Generating copy for: ${product.title}`);
    try {
      const raw = await callGemini(buildPrompt(product));
      const generated = parseGeminiJson(raw);

      const record = {
        id: product.id,
        title: product.title,
        handle: product.handle,
        url: product.onlineStoreUrl || null,
        generated: generated || null,
        raw: generated ? undefined : raw,
      };

      if (CONFIG.writeBack && generated?.description_html) {
        log(`  ✏️  Writing new description back to Shopify...`);
        await updateProductDescription(product.id, generated.description_html);
        record.writtenBack = true;
      }

      results.push(record);
    } catch (err) {
      log(`  ⚠️  ${err.message}`);
      results.push({ id: product.id, title: product.title, error: err.message });
    }

    // Gentle pacing so we stay well under Gemini + Shopify rate limits.
    await new Promise((r) => setTimeout(r, 600));
  }

  const date = new Date().toISOString().split('T')[0];
  writeReport(date, results);

  const ok = results.filter((r) => !r.error).length;
  log(`\n✅ Done. ${ok}/${results.length} products processed successfully.`);
  if (!CONFIG.writeBack) {
    log('   (Preview mode — set WRITE_BACK=true to push the new copy into Shopify.)');
  }
})().catch((err) => fail(err.stack || err.message));
