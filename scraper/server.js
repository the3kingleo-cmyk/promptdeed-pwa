'use strict';

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const webpush = require('web-push');
const path = require('path');

const { checkItemPrice, findStoresByZip, sleep } = require('./api');
const db = require('./db');
const { DEFAULT_STORES } = require('./stores');
const { SEED_SKUS } = require('./skus');

// ---------- CONFIG ----------

const PORT = process.env.PORT || 3001;
const SCAN_INTERVAL_CRON = process.env.SCAN_CRON || '*/30 * * * *'; // every 30 min
const DELAY_MS = parseInt(process.env.DELAY_MS || '800', 10);       // ms between API calls
const MAX_ERRORS_PER_SCAN = 20;

// VAPID keys — generate once and persist in env vars for production.
// If not set, auto-generate (push won't survive server restarts without persisting them).
let VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  const keys = webpush.generateVAPIDKeys();
  VAPID_PUBLIC = keys.publicKey;
  VAPID_PRIVATE = keys.privateKey;
  console.log('[vapid] Generated new VAPID keys. Set these as env vars to persist push subscriptions:');
  console.log('  VAPID_PUBLIC_KEY=' + VAPID_PUBLIC);
  console.log('  VAPID_PRIVATE_KEY=' + VAPID_PRIVATE);
}

webpush.setVapidDetails(
  'mailto:admin@pennyfinder.local',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// ---------- SEED DATA ----------

function seedDatabase() {
  // Add default stores if DB is empty
  const existing = db.getStores(false);
  if (existing.length === 0) {
    DEFAULT_STORES.forEach((s) => db.upsertStore(s));
    console.log(`[db] Seeded ${DEFAULT_STORES.length} stores`);
  }

  // Add seed SKUs
  const existingSkus = db.getSkus(false);
  if (existingSkus.length === 0) {
    SEED_SKUS.forEach((sku) => db.upsertSku(sku, null, 'system'));
    console.log(`[db] Seeded ${SEED_SKUS.length} SKUs`);
  }
}

// ---------- SCRAPER LOGIC ----------

let scanRunning = false;

async function runScan() {
  if (scanRunning) {
    console.log('[scan] Already running, skipping');
    return;
  }
  scanRunning = true;

  const stores = db.getStores(true);
  const skus = db.getSkus(true);

  if (stores.length === 0 || skus.length === 0) {
    console.log('[scan] No stores or SKUs configured, skipping');
    scanRunning = false;
    return;
  }

  const logId = db.startScanLog();
  const stats = { storesChecked: 0, itemsChecked: 0, pennyFound: 0, errors: 0 };
  const newPennyItems = [];

  console.log(`[scan] Starting — ${skus.length} SKUs × ${stores.length} stores`);

  outer:
  for (const store of stores) {
    stats.storesChecked++;
    for (const sku of skus) {
      try {
        const result = await checkItemPrice(sku.item_id, store.id);
        stats.itemsChecked++;

        if (result && result.isPenny) {
          console.log(`[PENNY] ${result.productLabel} @ ${store.name} — $${result.price}`);
          const { id, isNew } = db.upsertPennyItem({
            item_id: result.itemId,
            store_id: result.storeId,
            price: result.price,
            original_price: result.originalPrice,
            product_label: result.productLabel,
            model_number: result.modelNumber,
            brand_name: result.brandName,
            image_url: result.imageUrl,
            hd_url: result.hdUrl,
            buyable: result.buyable,
          });
          if (isNew) {
            stats.pennyFound++;
            newPennyItems.push({ dbId: id, result, store });
          }
        }

        await sleep(DELAY_MS);
      } catch (err) {
        stats.errors++;
        console.error(`[scan] Error ${sku.item_id}@${store.id}: ${err.message}`);
        if (stats.errors >= MAX_ERRORS_PER_SCAN) {
          console.error('[scan] Too many errors, aborting scan');
          break outer;
        }
        // Back off on rate limit
        if (err.message === 'RATE_LIMITED') await sleep(10000);
        else await sleep(DELAY_MS * 2);
      }
    }
  }

  db.finishScanLog(logId, stats);
  db.removeStalePennyItems(72);
  console.log(`[scan] Done — ${stats.itemsChecked} checked, ${stats.pennyFound} penny items found`);

  // Send push notifications for new finds
  if (newPennyItems.length > 0) {
    await sendPushNotifications(newPennyItems);
  }

  scanRunning = false;
}

async function sendPushNotifications(items) {
  const subs = db.getPushSubscriptions();
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: `${items.length} Penny Item${items.length > 1 ? 's' : ''} Found!`,
    body: items.slice(0, 3).map((i) =>
      `${i.result.productLabel} @ ${i.store.city}, ${i.store.state}`
    ).join('\n'),
    data: { url: '/' },
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      // Mark items notified
      items.forEach((i) => db.markNotified(i.dbId));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.deletePushSubscription(sub.endpoint);
      } else {
        console.error('[push] Failed:', err.message);
      }
    }
  }
}

// ---------- EXPRESS API ----------

const app = express();
app.use(cors());
app.use(express.json());

// Serve the PWA frontend from repo root
app.use(express.static(path.join(__dirname, '..')));

// ----- STATUS -----
app.get('/api/status', (_req, res) => {
  const logs = db.getRecentScanLogs(5);
  const pennyCount = db.getPennyItems({ hours: 72 }).length;
  const stores = db.getStores(true).length;
  const skus = db.getSkus(true).length;
  res.json({
    ok: true,
    scanRunning,
    vapidPublicKey: VAPID_PUBLIC,
    stats: { pennyCount, storesEnabled: stores, skusEnabled: skus },
    recentScans: logs,
  });
});

// ----- PENNY ITEMS -----
app.get('/api/penny-items', (req, res) => {
  const { storeId, hours, limit } = req.query;
  const items = db.getPennyItems({
    storeId: storeId || null,
    hours: hours ? parseInt(hours, 10) : 72,
    limit: limit ? parseInt(limit, 10) : 500,
  });
  res.json(items);
});

// ----- STORES -----
app.get('/api/stores', (_req, res) => {
  res.json(db.getStores(false));
});

app.post('/api/stores', (req, res) => {
  const { id, name, city, state, zip } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  db.upsertStore({ id: String(id), name, city: city || '', state: state || '', zip: zip || '' });
  res.json({ ok: true });
});

app.post('/api/stores/lookup', async (req, res) => {
  const { zip } = req.body;
  if (!zip) return res.status(400).json({ error: 'zip required' });
  const stores = await findStoresByZip(zip);
  res.json(stores);
});

app.patch('/api/stores/:id', (req, res) => {
  const { enabled } = req.body;
  db.setStoreEnabled(req.params.id, !!enabled);
  res.json({ ok: true });
});

app.delete('/api/stores/:id', (req, res) => {
  db.deleteStore(req.params.id);
  res.json({ ok: true });
});

// ----- SKUS -----
app.get('/api/skus', (_req, res) => {
  res.json(db.getSkus(false));
});

app.post('/api/skus', (req, res) => {
  const { itemId, label } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId required' });
  db.upsertSku(String(itemId), label || null, 'user');
  res.json({ ok: true });
});

app.patch('/api/skus/:itemId', (req, res) => {
  const { enabled } = req.body;
  db.setSkuEnabled(req.params.itemId, !!enabled);
  res.json({ ok: true });
});

app.delete('/api/skus/:itemId', (req, res) => {
  db.deleteSku(req.params.itemId);
  res.json({ ok: true });
});

// ----- SCAN CONTROL -----
app.post('/api/scan/start', async (req, res) => {
  if (scanRunning) return res.json({ ok: false, message: 'Scan already running' });
  res.json({ ok: true, message: 'Scan started' });
  runScan().catch(console.error);
});

app.get('/api/scan/logs', (_req, res) => {
  res.json(db.getRecentScanLogs(20));
});

// ----- PUSH NOTIFICATIONS -----
app.post('/api/push/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  db.savePushSubscription(sub);
  res.json({ ok: true });
});

app.delete('/api/push/subscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.deletePushSubscription(endpoint);
  res.json({ ok: true });
});

// ---------- START ----------

seedDatabase();

app.listen(PORT, () => {
  console.log(`[server] HD Penny Scraper running on http://localhost:${PORT}`);
  console.log(`[server] Scan schedule: ${SCAN_INTERVAL_CRON}`);
});

// Schedule recurring scans
cron.schedule(SCAN_INTERVAL_CRON, () => {
  console.log('[cron] Triggering scheduled scan');
  runScan().catch(console.error);
});

// Run an initial scan shortly after startup
setTimeout(() => {
  console.log('[init] Running initial scan');
  runScan().catch(console.error);
}, 5000);
