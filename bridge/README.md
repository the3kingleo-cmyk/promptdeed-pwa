# Shopify ↔ Google Gemini Bridge

This is an automated **bridge** that connects your **Shopify store** to **Google Gemini** (AI),
and runs **every single day** all by itself.

## What it does, every day

1. Logs into your Shopify store and reads your products.
2. Sends each product to Google Gemini and asks the AI to write fresh, sales-ready:
   - a polished product description,
   - an SEO page title + meta description,
   - a ready-to-post social media caption.
3. Saves the results to `bridge/output/` (a dated `.json` file plus a readable `latest.md`).
4. *(Optional)* writes the new descriptions straight back into your Shopify store.

It runs through GitHub Actions on a daily schedule — you don't have to do anything once it's set up.
You can also run it on demand from the **Actions** tab → *Daily Shopify ↔ Gemini Bridge* → *Run workflow*.

---

## One-time setup (≈5 minutes)

You need to give it **two keys**. You paste them once into GitHub as "Secrets" — they stay private.

### 1. Get your Google Gemini API key
- Go to **https://aistudio.google.com/apikey**
- Click **Create API key**, copy it.

### 2. Get your Shopify Admin API token
- In Shopify admin: **Settings → Apps and sales channels → Develop apps → Create an app**.
- Under **Configuration → Admin API**, grant scopes: `read_products` (and `write_products` only if you
  want it to update your store automatically).
- **Install app**, then copy the **Admin API access token** (starts with `shpat_`).
- Also note your store domain, e.g. `your-store.myshopify.com`.

### 3. Add them to GitHub
In this repository: **Settings → Secrets and variables → Actions → New repository secret**.
Add these three:

| Secret name             | Value                                  |
|-------------------------|----------------------------------------|
| `SHOPIFY_STORE_DOMAIN`  | `your-store.myshopify.com`             |
| `SHOPIFY_ADMIN_TOKEN`   | `shpat_xxxxxxxxxxxxxxxx`               |
| `GEMINI_API_KEY`        | your Gemini key from step 1            |

That's it. The bridge will run automatically each morning.

---

## Safety: it does NOT change your store by default

By default the bridge runs in **preview mode** — it only generates copy and saves it to
`bridge/output/` so you can review it. It does **not** touch your live store.

When you're happy with the results and want it to update Shopify automatically, add one more secret:

| Secret name  | Value  |
|--------------|--------|
| `WRITE_BACK` | `true` |

(You'll also need the `write_products` scope on your Shopify app.)

---

## Optional settings

Set these as GitHub Secrets (or local env vars) to override the defaults:

| Name                  | Default            | Meaning                                   |
|-----------------------|--------------------|-------------------------------------------|
| `GEMINI_MODEL`        | `gemini-2.0-flash` | Which Gemini model to use                 |
| `SHOPIFY_API_VERSION` | `2025-01`          | Shopify Admin API version                 |
| `MAX_PRODUCTS`        | `25`               | How many products to process per run      |
| `WRITE_BACK`          | `false`            | `true` to push copy back into Shopify     |

---

## Running it locally (for testing)

```bash
cd bridge
export SHOPIFY_STORE_DOMAIN="your-store.myshopify.com"
export SHOPIFY_ADMIN_TOKEN="shpat_..."
export GEMINI_API_KEY="..."
node shopify-gemini-bridge.js
```

No `npm install` needed — it uses Node 18+'s built-in `fetch`.
