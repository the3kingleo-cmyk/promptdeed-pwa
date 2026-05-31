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

## Give the robot its administrative access (≈5 minutes, one time)

The robot runs in the cloud, by itself, every day. To do that it needs **its own
administrative access** to your accounts — because nobody is around to log it in.

You give it that access by pasting **three values** into GitHub once. They stay
private (GitHub hides them). **Important:** these keys can ONLY be created by you,
the account owner, on the official websites — for security, no one else (not even
this assistant) can generate them for you.

### 1. Gemini administrative access (the AI brain)
- Open **https://aistudio.google.com/apikey** and sign in with your Google account.
- Tap **Create API key** → copy the long code. (Free.)

### 2. Shopify administrative access (the store)
- Open your Shopify admin (the website, or the Shopify phone app's **Settings**).
- Go to **Settings → Apps and sales channels → Develop apps → Create an app**.
- Name it e.g. `Gemini Bridge Robot`.
- Click **Configure Admin API scopes** → tick **`read_products`** (and **`write_products`**
  too, only if you want the robot to update your store automatically).
- Click **Save** → **Install app** → copy the **Admin API access token** (starts with `shpat_`).
- Your store domain is `prokitdigital.shop`'s myshopify address, e.g. `your-store.myshopify.com`.

### 3. Paste them into GitHub (this is the only "techy" part)
In this repository on github.com: **Settings → Secrets and variables → Actions →
New repository secret**. Add these three (name on the left, your value on the right):

| Secret name             | Value                                  |
|-------------------------|----------------------------------------|
| `SHOPIFY_STORE_DOMAIN`  | `your-store.myshopify.com`             |
| `SHOPIFY_ADMIN_TOKEN`   | `shpat_xxxxxxxxxxxxxxxx`               |
| `GEMINI_API_KEY`        | your Gemini key from step 1            |

That's it. The robot turns itself on and runs automatically each morning.

> Until you add these, the robot is **installed but idle** — it skips its daily run
> quietly (no errors, no emails) and waits for its access.

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
