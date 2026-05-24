'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'penny.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      state TEXT,
      zip TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      added_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS skus (
      item_id TEXT PRIMARY KEY,
      label TEXT,
      added_by TEXT NOT NULL DEFAULT 'system',
      enabled INTEGER NOT NULL DEFAULT 1,
      added_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS penny_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      product_label TEXT,
      model_number TEXT,
      brand_name TEXT,
      image_url TEXT,
      hd_url TEXT,
      buyable INTEGER,
      first_seen INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      last_seen INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      notified INTEGER NOT NULL DEFAULT 0,
      UNIQUE(item_id, store_id)
    );

    CREATE TABLE IF NOT EXISTS scan_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      stores_checked INTEGER DEFAULT 0,
      items_checked INTEGER DEFAULT 0,
      penny_found INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running'
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_penny_store ON penny_items(store_id);
    CREATE INDEX IF NOT EXISTS idx_penny_item ON penny_items(item_id);
    CREATE INDEX IF NOT EXISTS idx_penny_seen ON penny_items(last_seen DESC);
  `);
}

// ----- STORES -----

function upsertStore(store) {
  getDb().prepare(`
    INSERT INTO stores (id, name, city, state, zip, enabled)
    VALUES (@id, @name, @city, @state, @zip, 1)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, city=excluded.city,
      state=excluded.state, zip=excluded.zip
  `).run(store);
}

function getStores(enabledOnly = true) {
  const q = enabledOnly
    ? 'SELECT * FROM stores WHERE enabled=1 ORDER BY state, name'
    : 'SELECT * FROM stores ORDER BY state, name';
  return getDb().prepare(q).all();
}

function setStoreEnabled(id, enabled) {
  getDb().prepare('UPDATE stores SET enabled=? WHERE id=?').run(enabled ? 1 : 0, id);
}

function deleteStore(id) {
  getDb().prepare('DELETE FROM stores WHERE id=?').run(id);
}

// ----- SKUS -----

function upsertSku(itemId, label = null, addedBy = 'user') {
  getDb().prepare(`
    INSERT INTO skus (item_id, label, added_by, enabled)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(item_id) DO UPDATE SET label=COALESCE(excluded.label, label), enabled=1
  `).run(String(itemId), label, addedBy);
}

function getSkus(enabledOnly = true) {
  const q = enabledOnly
    ? 'SELECT * FROM skus WHERE enabled=1 ORDER BY added_at DESC'
    : 'SELECT * FROM skus ORDER BY added_at DESC';
  return getDb().prepare(q).all();
}

function setSkuEnabled(itemId, enabled) {
  getDb().prepare('UPDATE skus SET enabled=? WHERE item_id=?').run(enabled ? 1 : 0, itemId);
}

function deleteSku(itemId) {
  getDb().prepare('DELETE FROM skus WHERE item_id=?').run(itemId);
}

// ----- PENNY ITEMS -----

function upsertPennyItem(item) {
  const existing = getDb().prepare(
    'SELECT id, notified FROM penny_items WHERE item_id=? AND store_id=?'
  ).get(item.item_id, item.store_id);

  if (existing) {
    getDb().prepare(`
      UPDATE penny_items SET price=?, original_price=?, product_label=?,
        model_number=?, brand_name=?, image_url=?, hd_url=?, buyable=?,
        last_seen=strftime('%s','now')
      WHERE id=?
    `).run(
      item.price, item.original_price, item.product_label,
      item.model_number, item.brand_name, item.image_url,
      item.hd_url, item.buyable ? 1 : 0, existing.id
    );
    return { id: existing.id, isNew: false, wasNotified: existing.notified === 1 };
  }

  const result = getDb().prepare(`
    INSERT INTO penny_items
      (item_id, store_id, price, original_price, product_label, model_number,
       brand_name, image_url, hd_url, buyable)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    item.item_id, item.store_id, item.price, item.original_price,
    item.product_label, item.model_number, item.brand_name,
    item.image_url, item.hd_url, item.buyable ? 1 : 0
  );
  return { id: result.lastInsertRowid, isNew: true, wasNotified: false };
}

function getPennyItems({ limit = 200, storeId = null, hours = null } = {}) {
  let q = `
    SELECT p.*, s.name as store_name, s.city, s.state, s.zip
    FROM penny_items p
    LEFT JOIN stores s ON s.id = p.store_id
    WHERE 1=1
  `;
  const params = [];
  if (storeId) { q += ' AND p.store_id=?'; params.push(storeId); }
  if (hours) { q += ' AND p.last_seen >= strftime(\'%s\',\'now\') - ?'; params.push(hours * 3600); }
  q += ' ORDER BY p.last_seen DESC LIMIT ?';
  params.push(limit);
  return getDb().prepare(q).all(...params);
}

function markNotified(itemDbId) {
  getDb().prepare('UPDATE penny_items SET notified=1 WHERE id=?').run(itemDbId);
}

function removeStalePennyItems(olderThanHours = 48) {
  const cutoff = Math.floor(Date.now() / 1000) - olderThanHours * 3600;
  getDb().prepare('DELETE FROM penny_items WHERE last_seen < ?').run(cutoff);
}

// ----- SCAN LOG -----

function startScanLog() {
  const result = getDb().prepare(
    "INSERT INTO scan_log (started_at) VALUES (strftime('%s','now'))"
  ).run();
  return result.lastInsertRowid;
}

function finishScanLog(logId, stats) {
  getDb().prepare(`
    UPDATE scan_log SET finished_at=strftime('%s','now'),
      stores_checked=?, items_checked=?, penny_found=?, errors=?, status='done'
    WHERE id=?
  `).run(stats.storesChecked, stats.itemsChecked, stats.pennyFound, stats.errors, logId);
}

function getRecentScanLogs(n = 10) {
  return getDb().prepare(
    'SELECT * FROM scan_log ORDER BY started_at DESC LIMIT ?'
  ).all(n);
}

// ----- PUSH SUBSCRIPTIONS -----

function savePushSubscription(sub) {
  getDb().prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth
  `).run(sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}

function getPushSubscriptions() {
  return getDb().prepare('SELECT * FROM push_subscriptions').all().map((row) => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }));
}

function deletePushSubscription(endpoint) {
  getDb().prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(endpoint);
}

module.exports = {
  getDb,
  upsertStore, getStores, setStoreEnabled, deleteStore,
  upsertSku, getSkus, setSkuEnabled, deleteSku,
  upsertPennyItem, getPennyItems, markNotified, removeStalePennyItems,
  startScanLog, finishScanLog, getRecentScanLogs,
  savePushSubscription, getPushSubscriptions, deletePushSubscription,
};
