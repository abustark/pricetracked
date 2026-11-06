# pricetracked Commit Log

This document tracks every commit following the `2.0.x` versioning schema:

- Sequence: `2.0.1`, `2.0.2`, ..., `2.0.9`, `2.0.10` ➔ `2.1.0`, `2.1.1`, ..., `2.1.10` ➔ `2.2.0`, etc. The third number never exceeds `.10`.
- Format: `<version> - <short sentence>`
- **One version number per agent response / request batch** — not per issue, not per commit: a single owner request (even if it fixes many issues) consumes exactly ONE version number, multiple commits inside one response all take that same number (fold follow-up fixes into it — never burn a second number), and only a genuinely new owner request (a new response turn) advances the number.

> ### 📌 Next version — **keep this line current, every commit**
> - **`main` → `2.0.4`** (current head is `2.0.3` — see below)

---

## Commit History

### 2.0.0 - adopt versioned commits + universal COMMIT-HISTORY.md log

- **Date**: 2026-10-17
- **Why**: owner directive — every repo carries the same recognizable commit-log file name (`COMMIT-HISTORY.md`, repo root); numbering starts at `2.0.0` (history before this commit is unversioned).
- **Changes**:
  - `AGENTS.md`: "Commit Naming & Versioning (strict)" section — `2.0.x` schema with `.10` roll-over, one version per agent response / request batch, commits logged in `COMMIT-HISTORY.md`.
  - `COMMIT-HISTORY.md`: created at the repo root (same universal name in every project).

### 2.0.1 - rename project to PriceTracked

- **Date**: 2026-11-06
- **Why**: owner directive — rename the project from PriceTrail to PriceTracked everywhere, matching the live domain `pricetracked.vercel.app`.
- **Changes**:
  - GitHub repo renamed `abustark/price-trail` → `abustark/pricetracked` via `gh repo rename`.
  - Display brand `PriceTrail` → `PriceTracked` in header/footer, page titles, SEO/OG metadata, `opengraph-image`, `README.md`, `PROJECT-INFO.md`, `AUDIT.md`, `ANTIGRAVITY_EXECUTION_PROMPT.md`.
  - Slug `price-trail` → `pricetracked` in `package.json`, `package-lock.json`, `COMMIT-HISTORY.md` title, repo URLs and live URL (`https://price-trail-ruddy.vercel.app` → `https://pricetracked.vercel.app`).
  - Identifiers `pricetrail-*` cookies/storage keys → `pricetracked-*` (`pricetracked-guest-id`, `pricetracked-theme`, `pricetracked-google-auth`, `pricetracked-google-signin`, `pricetracked-drops`, dev secret fallback), `PRICETRAIL_` → `PRICETRACKED_`.
  - Paths and branch `D:\projects\price-trail` → `D:\projects\pricetracked`, `arena/01a030cf-price-trail` → `arena/01a030cf-pricetracked` in `AGENTS.md`.
  - Local folder lives at `D:\projects\pricetracked` (fresh clone of the renamed repo; old `price-trail` folder locked by OS and needs manual deletion).
  - `price_tracker` MongoDB database name in `.env.example`, `lib/db.ts` default and `README.md` left unchanged — it is a data identifier, not the project brand; renaming it would need a DB migration.
  - `abufolio.vercel.app` portfolio credit left unchanged — it is the owner's separate portfolio site.

### 2.0.2 - genuine price history only (P0 provenance fix)

- **Date**: 2026-11-06
- **Why**: completion-guide Priority 0 — synthetic baseline values (six invented `historical`/`mrp-baseline` points from `generateHistoricalBaseline()`) were influencing all statistics, chart timeline and BUY/WAIT advice. Price history must reflect real observations only.
- **Changes**:
  - `lib/scanner.ts`: removed `queueHistoricalBackfill` import and first-track backfill queue call — a new product now starts with exactly one genuine `direct`/`proxy` observation.
  - `lib/analytics.ts`: added `OBSERVED_SOURCES` (`direct`/`proxy`), `isObservedSample`, `selectObservedSamples` (filters synthetic rows before every stat; mixed-currency samples reduced to the latest observed currency); `calculatePriceStats` + `generateBuyAdvice` operate on observed samples only, including sample count and percentile/score.
  - `lib/history.ts` deleted (generator, FIFO queue and backfill logic — no dormant code left).
  - `lib/types.ts`: dropped `historyBackfilled`/`historyBackfilledAt` from `ProductDocument` and the unused `historicalPrices` field from `ScanResult`.
  - `app/products/[id]/page.tsx` + `app/api/products/[id]/route.ts`: sample queries now fetch `source ∈ {direct, proxy}` only; "Recent scans" labels simplified to Live/Proxy scan (no more Historical/MRP baseline rows).
  - `components/PriceChart.tsx`: removed synthetic dot styling, "Historical" legend entry and mrp-baseline tag — chart timeline, legend, snapshot count and ARIA summary show observed samples only.
  - `scripts/migrate-synthetic-history.mjs`: new idempotent migration — dry-run by default (counts by source), `--execute` writes a JSON backup then deletes only records with source `historical`/`mrp-baseline` (+ sane price/date checks) and unsets retired `historyBackfilled` flags on affected products; `--restore=<file>` re-inserts a backup; `direct`/`proxy` samples are never touched.
  - `README.md`: new "Price History Provenance" section (migration run/rollback steps) and an explicit **Vercel Hobby daily-cron-only scheduler constraint** note (owner decision: Option B — stay honest at 24h until Pro).
  - `AGENTS.md`: new "Scheduler & Vercel Hobby Constraint" section for AI agents (daily cron only, never advertise 6h on Hobby, never reintroduce synthetic history).
  - `PROJECT-INFO.md`: removed all backfill/synthesis claims; documents genuine-history-only behaviour.
- **Intentionally deferred to next batches**: scheduler cadence/scan-lock/retry work (P1 → `2.0.3`), in-app target alert events (P2 → `2.0.4`), tests/observability/a11y (P3+P4 → `2.0.5`).

### 2.0.3 - honest scan cadence, atomic scan locks, fetch hardening (P1)

- **Date**: 2026-11-06
- **Why**: completion-guide Priority 1 — the UI advertised a 6-hour cadence the daily Hobby cron cannot deliver, due-product processing had no atomic claim (overlapping cron/manual scans possible), and server-side fetching lacked redirect/content-type/size/DNS safeguards.
- **Changes**:
  - `lib/schedule.ts` (new): single source of truth — `CRON_SCHEDULE "0 0 * * *"`, `CRON_CADENCE_HOURS 24`, `DEFAULT_SCAN_EVERY_HOURS 24`, `SCAN_LOCK_TTL_MINUTES 5`, `INTER_PRODUCT_DELAY_MS 500`, `getCronScanLimit()` (env `CRON_SCAN_LIMIT`, default 10, max 50), `getCronTimeBudgetMs()` (env `CRON_TIME_BUDGET_MS`, default 45s), `getEffectiveScanEveryHours()` (effective cadence = max(product setting, cron cadence)).
  - `lib/scanner.ts`: default `scanEveryHours` 6 → 24; `nextScanAt` now uses the effective cadence; new `claimProductScan()` (atomic `findOneAndUpdate` on due+unlocked condition, sets `scanLockUntil`/`scanStartedAt`/`lastAttemptAt`) and `releaseScanLock()` (lock released on success and failure; failure keeps last valid price, sets `lastError`, bumps `failureCount`, schedules next attempt at effective cadence); `scanDueProducts()` rewritten — bounded batch, ~45s time budget, sequential processing with 500ms inter-product delay, per-product `{id, ok, skipped: locked|time-budget, error}` outcomes; stale locks self-expire after the 5-minute TTL.
  - `app/api/cron/scan/route.ts`: returns `{scanned, ok, failed, skipped, durationMs, schedule, results}`; batch limit comes from `lib/schedule.ts`.
  - `app/api/products/[id]/scan/route.ts`: manual rescan now atomically claims the product first (409 "A scan is already in progress…" when locked) and releases the lock on success/failure — cron and manual scans can no longer race.
  - `lib/stores.ts`: `assertWebProtocol` + `assertNoUrlCredentials` (rejects `user:pass@host` URLs) enforced on product URLs and every short-link hop; `isSafePublicHostname` hardened — private/loopback/link-local/CGNAT/benchmark/documentation/multicast/reserved IPv4 ranges, all numeric IPv4 encodings (decimal `2130706433`, hex `0x7f…`, octal `0177…`), IPv6 literals (loopback, `::ffff:` mapped, fe80::/10, fc00::/7, ff00::/8, 2001:db8, 6to4, Teredo; only global unicast passes), fail-closed on malformed numeric hosts; short-link resolver no longer auto-follows (`redirect: "manual"` everywhere, ≤5 hops, every hop re-validated).
  - `lib/url-guard.ts` (new, server-only): `assertSafeFetchTarget()` — protocol/credentials/public-hostname checks plus `node:dns` resolution requiring every resolved address to be public (DNS-rebinding hardening; TOCTOU limitation documented).
  - `lib/scanner.ts` fetch path: proxy mode now uses `redirect: "manual"` with same-origin validation (`assertProxyTarget`, `followProxyRedirect`) instead of `redirect: "follow"`; `assertHtmlResponse` rejects binary/non-HTML content types before parsing; `readBodyWithCap` caps response bodies at 2 MB (streamed, aborts past cap); retry backoff 350ms×n → 1s/2s (max 3 attempts preserved); misconfigured non-web proxy endpoints are ignored safely.
  - `app/products/[id]/page.tsx`: cadence chip shows the effective cadence (`Every 24h`), new "Scanned {date}" chip, and the error block now distinguishes last attempted (date + error) from last successful scan with an explicit stale-data explanation.
  - `.env.example` + `README.md`: `CRON_SCAN_LIMIT` documented; cron safety (locks, batch, budget, stale-lock expiry, failure handling) described.
- **Intentionally deferred to next batches**: in-app target alert events (P2 → `2.0.4`), tests/observability/a11y (P3+P4 → `2.0.5`).
