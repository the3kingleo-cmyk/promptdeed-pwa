# Promptdeed PWA

Promptdeed is a Progressive Web App that provides 50 production-grade AI prompts for US residential real estate agents. It is wrapped via PWABuilder.com for distribution on Google Play.

## Project structure

```
promptdeed-pwa/
  index.html            # Entire app — HTML, CSS, and JS are all inline (single-file SPA)
  manifest.json         # PWA web app manifest (name, icons, display mode, theme)
  service-worker.js     # Cache-first service worker for offline support
  icon-192.png          # App icon (192x192)
  icon-512.png          # App icon (512x512)
  scraper/
    homedepot.js        # Playwright-based Home Depot clearance scraper (Node.js)
  deals/
    latest.md           # Most recent scrape results in markdown
    YYYY-MM-DD.csv      # Daily CSV snapshots from the scraper
  .github/workflows/
    daily-deals.yml     # GitHub Actions cron job: runs scraper daily at 9 AM EST
```

## Architecture

### PWA (index.html)

The entire front-end is a **single HTML file** with no build step, no framework, and no external dependencies. All CSS is in a `<style>` block; all JS is in a `<script>` block at the bottom.

Key internals:
- **DATA** — A large JSON object at the top of the script block containing brand info, 10 categories, and 50 prompts (with text, example input, and example output).
- **STATE** — Simple object tracking `view`, `catId`, `promptId`, and `unlocked` status.
- **Views** — Four render functions (`renderHome`, `renderCategory`, `renderPrompt`, `renderSettings`) that write directly to `#root` via `innerHTML`.
- **Unlock system** — First 5 prompts are free; the rest require entering an unlock code (`DATA.unlock_code`) which persists via `localStorage` key `promptdeed_unlocked`.
- **Dark mode** — CSS `prefers-color-scheme: dark` media queries; no JS toggle.
- **Service worker** — Cache-first strategy; pre-caches core assets on install, serves from cache with network fallback, falls back to `index.html` for offline navigation.

### Scraper (scraper/homedepot.js)

A Node.js script using Playwright (Chromium) to scrape Home Depot clearance deals. Outputs:
- `deals/YYYY-MM-DD.csv` — daily snapshot
- `deals/latest.md` — markdown summary sorted by discount percentage

The scraper has no `package.json`; dependencies are installed inline during the GitHub Actions workflow (`npm init -y && npm install playwright`).

### GitHub Actions

One workflow: `.github/workflows/daily-deals.yml`
- Runs daily at 14:00 UTC (9 AM EST) via cron, plus manual `workflow_dispatch`
- Installs Node 20, Playwright + Chromium, runs the scraper, then auto-commits results to `deals/` as `deals-bot`

## Development

### No build step

There is no bundler, transpiler, or package manager at the project root. To work on the PWA, edit `index.html` directly and open it in a browser. Any static HTTP server works:

```sh
python3 -m http.server 8000
# or
npx serve .
```

### Running the scraper locally

```sh
cd scraper
npm init -y
npm install playwright
npx playwright install chromium --with-deps
node homedepot.js
```

Results are written to the `deals/` directory.

### No tests or linting configured

There are currently no test suites, linters, or formatting tools in this repository.

## Conventions

- **Single-file app**: All PWA code lives in `index.html`. Do not extract CSS or JS into separate files unless explicitly asked.
- **No external CDN dependencies**: The app is fully self-contained for offline use. Do not add external script or stylesheet links.
- **Prompt data is inline**: The `DATA` JSON object is embedded in the script. There is no API or external data source for prompts.
- **Commit messages**: Prefixed with type (e.g. `feat:`, `fix:`, `deals:`). The scraper bot uses `deals: YYYY-MM-DD Home Depot clearance update`.
- **Cache versioning**: When changing cached assets, bump the `CACHE_NAME` version string in `service-worker.js` (currently `promptdeed-v1`).
- **MLS compliance**: Prompt #1 (and future prompts) must avoid fair-housing violations, exaggerated claims, and steering language. Respect this when editing prompt content.
- **Unlock code**: The current unlock code is stored in `DATA.unlock_code`. Changing it affects all users who haven't already unlocked.

## Color palette

| Token           | Value     | Usage                      |
|-----------------|-----------|----------------------------|
| Navy            | `#1B2B4B` | Header, primary buttons    |
| Warm white      | `#FAF7F2` | Light-mode background      |
| Dark background | `#0E1525` | Dark-mode background       |
| Gold/copper     | `#B8743D` | Accents, category badges   |
| Border light    | `#E6E1D9` | Card borders (light mode)  |
| Border dark     | `#243047` | Card borders (dark mode)   |
