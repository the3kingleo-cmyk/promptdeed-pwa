const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CLEARANCE_URL = 'https://www.homedepot.com/b/Specials-Offers-Clearance/N-5yc1vZar4y?Ns=P_REP_PRC_MODE%7C1';

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  const page = await context.newPage();
  const deals = [];

  try {
    console.log('Loading Home Depot clearance page...');
    await page.goto(CLEARANCE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    // Accept cookies if prompted
    const cookieBtn = page.locator('button:has-text("Accept")').first();
    if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cookieBtn.click();
    }

    // Scroll to load more products
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1200));
      await page.waitForTimeout(800);
    }

    const items = await page.evaluate(() => {
      const results = [];

      const pods = document.querySelectorAll('[class*="product-pod"], [data-testid="product-pod"], .plp-pod');
      pods.forEach(pod => {
        try {
          const titleEl = pod.querySelector('[class*="product-title"], [class*="pod-plp__title"], h2, h3');
          const salePriceEl = pod.querySelector('[class*="price--reduced"], [class*="u__strikethrough"] + *, [class*="special-price"], [aria-label*="Sale Price"]');
          const origPriceEl = pod.querySelector('[class*="u__strikethrough"], [class*="original-price"], [aria-label*="Original Price"]');
          const linkEl = pod.querySelector('a[href*="/p/"]');
          const badgeEl = pod.querySelector('[class*="badge"], [class*="tag"]');

          const title = titleEl?.innerText?.trim();
          const salePrice = salePriceEl?.innerText?.trim();
          const origPrice = origPriceEl?.innerText?.trim();
          const href = linkEl?.getAttribute('href');
          const badge = badgeEl?.innerText?.trim();

          if (title && (salePrice || origPrice)) {
            results.push({ title, salePrice, origPrice, href, badge });
          }
        } catch (e) {}
      });

      // Fallback: JSON-LD structured data
      if (results.length === 0) {
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
          try {
            const data = JSON.parse(s.textContent);
            const items = Array.isArray(data) ? data : [data];
            items.forEach(item => {
              if (item['@type'] === 'Product' && item.offers) {
                const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                results.push({
                  title: item.name,
                  salePrice: offer.price ? `$${offer.price}` : null,
                  origPrice: null,
                  href: item.url || null,
                  badge: 'clearance'
                });
              }
            });
          } catch (e) {}
        });
      }

      return results;
    });

    for (const item of items) {
      const saleNum = parseFloat((item.salePrice || '').replace(/[^0-9.]/g, ''));
      const origNum = parseFloat((item.origPrice || '').replace(/[^0-9.]/g, ''));
      const savings = (!isNaN(origNum) && !isNaN(saleNum)) ? (origNum - saleNum).toFixed(2) : null;
      const pctOff = (!isNaN(origNum) && !isNaN(saleNum) && origNum > 0)
        ? Math.round((1 - saleNum / origNum) * 100)
        : null;

      deals.push({
        title: item.title,
        salePrice: item.salePrice || 'N/A',
        originalPrice: item.origPrice || 'N/A',
        savings: savings ? `$${savings}` : 'N/A',
        percentOff: pctOff ? `${pctOff}%` : 'N/A',
        badge: item.badge || '',
        url: item.href ? `https://www.homedepot.com${item.href.startsWith('/') ? item.href : '/' + item.href}` : 'N/A',
      });
    }

  } finally {
    await browser.close();
  }

  return deals;
}

// Quote any CSV field and neutralize spreadsheet-formula injection (leading = + - @ tab CR).
function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function toCSV(deals) {
  const headers = ['Title', 'Sale Price', 'Original Price', 'Savings', '% Off', 'Badge', 'URL'];
  const rows = deals.map(d => [
    csvCell(d.title),
    csvCell(d.salePrice),
    csvCell(d.originalPrice),
    csvCell(d.savings),
    csvCell(d.percentOff),
    csvCell(d.badge),
    csvCell(d.url),
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

function toMarkdown(deals, date) {
  if (deals.length === 0) {
    return `# Home Depot Clearance Deals — ${date}\n\nNo deals found today.\n`;
  }

  const sorted = [...deals].sort((a, b) => {
    const pa = parseInt(a.percentOff) || 0;
    const pb = parseInt(b.percentOff) || 0;
    return pb - pa;
  });

  const rows = sorted.map(d =>
    `| ${d.title} | ${d.salePrice} | ${d.originalPrice} | ${d.savings} | ${d.percentOff} | [Link](${d.url}) |`
  ).join('\n');

  return `# Home Depot Clearance Deals — ${date}\n\nFound **${deals.length} items** on clearance, sorted by biggest discount first.\n\n| Item | Sale Price | Original | Savings | % Off | Link |\n|------|-----------|----------|---------|-------|------|\n${rows}\n\n_Last updated: ${new Date().toISOString()}_\n`;
}

(async () => {
  console.log('Starting Home Depot clearance scrape...');
  const deals = await scrape();
  console.log(`Found ${deals.length} deals.`);

  const date = new Date().toISOString().split('T')[0];
  const dealsDir = path.join(__dirname, '..', 'deals');
  fs.mkdirSync(dealsDir, { recursive: true });

  const csvPath = path.join(dealsDir, `${date}.csv`);
  fs.writeFileSync(csvPath, toCSV(deals));
  console.log(`Saved CSV: ${csvPath}`);

  const mdPath = path.join(dealsDir, 'latest.md');
  fs.writeFileSync(mdPath, toMarkdown(deals, date));
  console.log(`Saved markdown: ${mdPath}`);

  console.log('\n--- TOP DEALS ---');
  const top = [...deals]
    .filter(d => parseInt(d.percentOff) > 0)
    .sort((a, b) => (parseInt(b.percentOff) || 0) - (parseInt(a.percentOff) || 0))
    .slice(0, 10);
  top.forEach(d => console.log(`${d.percentOff} off | ${d.salePrice} (was ${d.originalPrice}) | ${d.title}`));
})();
