# PriceTracked

> 📄 **[`PROJECT-INFO.md`](PROJECT-INFO.md)** — machine-readable project facts (stack + exact versions, architecture, metrics, keyword tags) designed so an AI can generate resume entries and portfolio project summaries from it alone.

> **Live demo:** https://pricetracked.vercel.app/
> **Repo:** https://github.com/abustark/pricetracked

PriceTracked is a Vercel-ready ecommerce price tracker with a fast, focused watchlist UI. It has dedicated extraction paths for Amazon India, Flipkart, Myntra and AJIO, plus a generic structured-data adapter for product pages across the wider web.

Paste one product URL to record price snapshots over time and report:

- highest tracked price and date
- lowest tracked price and date
- most common tracked price
- how many times the price changed
- average change frequency once enough history exists
- current price, stock state and scan source for recent observations

The generic adapter first looks for schema.org Product/Offer JSON-LD, then Open Graph price metadata, then common `data-price`, `data-testid` and commerce JSON fields. Dedicated store adapters can be added without changing the watchlist or analytics UI.

## Tech Stack

- Next.js App Router
- MongoDB Atlas
- Vercel Functions
- Vercel Cron Jobs

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these environment variables:

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/price_tracker?retryWrites=true&w=majority
MONGODB_DB=price_tracker
CRON_SECRET=replace-with-a-long-random-secret
AUTH_SECRET=replace-with-a-long-random-auth-secret
AUTH_URL=http://localhost:3010
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

Open `http://localhost:3010`, paste a product URL, and the app will scan and save the first price sample. Signed-out visitors keep a private watchlist in their browser; sign in with Google before tracking if you need access across devices.

## Google Sign In

PriceTracked uses Auth.js/NextAuth Google OAuth so tracked product links are saved to the signed-in user and available across devices.

Create OAuth credentials in Google Cloud Console and add this redirect URI:

```text
http://localhost:3010/api/auth/callback/google
```

For Vercel production, also add:

```text
https://your-vercel-domain.vercel.app/api/auth/callback/google
```

Set the same `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and production `AUTH_URL` in Vercel environment variables.

## Deployment

1. Push this folder to a GitHub repository.
2. Import the repo in Vercel.
3. Add the environment variables from `.env.example`.
4. Deploy.

The included `vercel.json` registers a cron job:

```json
{
  "path": "/api/cron/scan",
  "schedule": "0 0 * * *"
}
```

Vercel Cron sends an HTTP `GET` request to the configured path in production. The schedule runs in UTC. Vercel Hobby projects are limited to daily cron jobs; on Pro you can change the schedule back to every 6 hours with `0 */6 * * *`.

> **Scheduler constraint (Vercel Hobby):** this project runs on the free Hobby plan, which permits **daily cron only** (`0 0 * * *`). Scans therefore happen at most once per day in production regardless of the per-product `scanEveryHours` setting. Do not advertise a 6-hour cadence while on Hobby; the product default and UI copy must say 24h (see `AGENTS.md`). Only after upgrading to Pro may the schedule become `0 */6 * * *`.

## Price History Provenance

All statistics, charts and buy advice are computed from **genuine observations only** — samples with source `direct` or `proxy` written by real scans (`OBSERVED_SOURCES` in `lib/analytics.ts`). The former six-point synthetic baseline (sources `historical` / `mrp-baseline`, generated from MRP factors) was removed in `2.0.2`: it is no longer created, no longer displayed, and excluded from every statistic. A newly tracked product starts with exactly one real observation and an honest "Gathering baseline" advice state until more scans accumulate.

Legacy synthetic rows in existing databases are removed with:

```bash
# 1. Dry run (default) — prints counts by source, deletes nothing
node scripts/migrate-synthetic-history.mjs

# 2. Execute — writes a JSON backup, deletes matching synthetic samples,
#    unsets the retired historyBackfilled flags on affected products
node scripts/migrate-synthetic-history.mjs --execute

# 3. Rollback — re-inserts the backed-up documents (original _ids preserved)
node scripts/migrate-synthetic-history.mjs --restore=backup-synthetic-history-<timestamp>.json
```

The script only deletes records whose `source` is `historical` or `mrp-baseline` (with a positive numeric price and a past `capturedAt`); `direct`/`proxy` observations are never touched. It is idempotent — re-running `--execute` after success deletes 0 documents. Requires `MONGODB_URI` (and optionally `MONGODB_DB`, default `price_tracker`).

## Scraping Notes

Direct HTML fetching can be blocked by ecommerce anti-bot systems. The scanner is intentionally isolated in `lib/scanner.ts` so you can replace or enhance it without changing the UI or analytics.

For production reliability, configure a legal scraping/rendering provider and set:

```bash
SCRAPER_PROXY_ENDPOINT=https://your-provider.example/render
SCRAPER_PROXY_TOKEN=your-token
SCRAPER_PROXY_URL_PARAM=url
SCRAPER_PROXY_TOKEN_PARAM=token
```

The proxy endpoint should accept the product URL as a query parameter and return rendered HTML. If your provider uses a different target URL parameter, change `SCRAPER_PROXY_URL_PARAM`.

If your provider expects the API key in a header instead of a query parameter, set:

```bash
SCRAPER_PROXY_AUTH_HEADER=x-api-key
```

When `SCRAPER_PROXY_AUTH_HEADER` is set, the app sends `SCRAPER_PROXY_TOKEN` in that header and does not append the token query parameter.

Examples:

```bash
# Query-token style
SCRAPER_PROXY_ENDPOINT=https://proxy.example/render
SCRAPER_PROXY_URL_PARAM=url
SCRAPER_PROXY_TOKEN_PARAM=api_key
SCRAPER_PROXY_TOKEN=your-api-key

# Header-token style
SCRAPER_PROXY_ENDPOINT=https://proxy.example/render
SCRAPER_PROXY_URL_PARAM=target
SCRAPER_PROXY_AUTH_HEADER=x-api-key
SCRAPER_PROXY_TOKEN=your-api-key
```

## API

Create or rescan a tracked product:

```http
POST /api/products
Content-Type: application/json

{ "url": "https://www.amazon.in/..." }
```

List products:

```http
GET /api/products
```

Get detail, samples and stats:

```http
GET /api/products/:id
```

Manual rescan:

```http
POST /api/products/:id/scan
```

Cron scan:

```http
GET /api/cron/scan
```

For manual cron calls outside Vercel Cron, pass `?token=<CRON_SECRET>` or the `x-cron-secret` header.

## Data Model

`products`

- normalized product URL
- store key
- title and image
- last price and scan metadata
- scan interval and next scan time

`price_samples`

- product id
- price and currency
- captured date
- stock status when detected
- source: direct or proxy

## Legal and Operational Notes

Check each store's terms and applicable law before running a public tracker at scale. Use reasonable scan intervals, do not bypass access controls, and prefer official/affiliate/product APIs when available.
