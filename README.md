# HD Penny Finder

Real-time Home Depot penny item scraper. Monitors $0.01 clearance items across 100+ US stores and sends push notifications the moment a find is confirmed.

## How It Works

1. **Backend** (`scraper/server.js`) — Node.js Express server that:
   - Polls Home Depot's product pricing API for each tracked SKU × each monitored store
   - Flags any item whose store price is exactly `$0.01`
   - Stores results in a local SQLite database
   - Sends Web Push notifications to subscribed browsers
   - Runs automatically on a cron schedule (default: every 30 minutes)

2. **Frontend** (`index.html`) — PWA dashboard that:
   - Shows all currently discovered penny items with product image, store name, and location
   - Lets you manage which stores (by ZIP code lookup or manual ID) and SKUs to track
   - Displays scan history logs
   - Accepts push notification subscriptions

## Quick Start

### 1. Install & start the backend
```bash
cd scraper
npm install
node server.js
```

The server runs at **http://localhost:3001** by default.

### 2. Open the frontend
Open `index.html` in a browser (or serve the repo root via any static server).
The dashboard auto-connects to `http://localhost:3001`.

### 3. Add stores
Go to **Config → Add Stores by ZIP Code**, enter your ZIP, and click **Find Stores** to discover nearby Home Depot locations. Toggle them on/off individually.

### 4. Add SKUs to track
Go to **Config → Add SKU to Track** and paste Home Depot item IDs.
You can find an item's ID in the URL on homedepot.com:
`https://www.homedepot.com/p/product-name/`**`206403861`**

### 5. Start a scan
Click **▶ Scan** to run immediately, or wait for the 30-minute auto-scan.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `SCAN_CRON` | `*/30 * * * *` | Cron schedule for auto-scans |
| `DELAY_MS` | `800` | Milliseconds between API requests (rate-limit protection) |
| `VAPID_PUBLIC_KEY` | auto-generated | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | auto-generated | Web Push VAPID private key |

> **Important:** Generate stable VAPID keys once and set them as env vars.
> Otherwise push subscriptions break every time the server restarts.
>
> ```bash
> node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2))"
> ```

---

## Adding SKUs to Track

The best sources for known penny SKUs:
- Search Reddit `/r/HomeDepot` for "penny item" threads
- Community sites that share clearance SKUs
- Items you already own — check the SKU on the product sticker or HD receipt
- Seasonal clearance items after major holidays (Halloween, Christmas, Easter)

Common penny item categories:
- **Post-holiday seasonal decor** — Halloween, Christmas, Spring
- **Discontinued paint colors** (check clearance bins)
- **Discontinued outdoor furniture**
- **Superseded tool models** when new versions launch

---

## Deployment (Production)

To run 24/7:

```bash
# Install PM2
npm install -g pm2

# Start the scraper
cd scraper && pm2 start server.js --name hd-penny

# Serve the PWA frontend (from repo root)
pm2 start "npx serve -l 8080 .." --name hd-penny-ui

pm2 save
pm2 startup
```

Or deploy the scraper to any Node.js host (Railway, Fly.io, Render) and point the frontend's API URL to the deployed address in **Config → Backend Server**.
