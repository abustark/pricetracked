# pricetracked Commit Log

This document tracks every commit following the `2.0.x` versioning schema:

- Sequence: `2.0.1`, `2.0.2`, ..., `2.0.9`, `2.0.10` ➔ `2.1.0`, `2.1.1`, ..., `2.1.10` ➔ `2.2.0`, etc. The third number never exceeds `.10`.
- Format: `<version> - <short sentence>`
- **One version number per agent response / request batch** — not per issue, not per commit: a single owner request (even if it fixes many issues) consumes exactly ONE version number, multiple commits inside one response all take that same number (fold follow-up fixes into it — never burn a second number), and only a genuinely new owner request (a new response turn) advances the number.

> ### 📌 Next version — **keep this line current, every commit**
> - **`main` → `2.1.0`** (current head is `2.0.10` — see below)

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

### 2.0.4 - complete in-app target alerts (P2)

- **Date**: 2026-11-07
- **Why**: completion-guide Priority 2 — the target-price feature stored a target and drew a "reached" state, but had no real enabled/paused state, no alert events, no history surface, and no read/dismiss lifecycle. Keep it strictly in-app: no email or push claims.
- **Changes**:
  - `lib/guest.ts` (new) + `lib/viewer.ts`: shared `isGuestId()` (UUID guest cookie) used by the viewer cookie check and alert creation, so guest ids never get alert events; account ids (Google `sub`) are unaffected.
  - `lib/types.ts`: new `AlertEventDocument` (`productId`, `userId`, `target`, `observedPrice`, `currency`, `observedAt`, `readAt`, `createdAt`) and serialized `AlertEventView`.
  - `lib/alerts.ts` (new): `createAlertEvent` (skips guests, duplicate-key no-op), `loadAlertEvents` (latest 20 with product title/store labels), `markAlertsRead` (one or all, user-scoped), `dismissAlert` (user-scoped delete), `deleteAlertEventsForProduct` (cascade).
  - `lib/scanner.ts`: crossing detection in `scanAndSaveProduct` — event only when a genuine successful observation moves `targetPriceReached` false → true, the alert is enabled, and a target exists; transition state prevents duplicate events on later below-target scans. Exported `releaseScanLock` (was missing the keyword while the manual-scan route imported it).
  - `lib/db.ts`: `alert_events` indexes — `{userId, observedAt:-1}` for the watchlist and unique `{productId, target, observedAt}` for idempotency.
  - `app/api/alerts/route.ts` (new): `GET` list, `PATCH` mark one/all read (`{id}` or `{all:true}`), `DELETE ?id=` dismiss; all user-scoped and signed-in only.
  - `app/api/products/[id]/route.ts`: deleting a product now deletes its alert events; target edits keep setting `targetPriceReached` from the last genuine price (already-below-target copy is shown, no fabricated crossing event).
  - `components/TargetPriceAlert.tsx`: "Alert on / Paused" status pill, Pause/Resume button wired to `targetAlertEnabled`, dashed paused banner explaining tracking continues, and reached-box copy stating alerts are in-app only with a link to the alert history.
  - `components/AlertsPanel.tsx` (new, client): accessible region (`role="region"`, labelled heading, `aria-live` error), unread count, "Mark all read", per-event link to the product page, Mark read and Dismiss actions, and an empty state.
  - `app/page.tsx`: signed-in users' latest alerts loaded server-side (try/catch → `[]`) and rendered on the watchlist before the product list.
  - `app/globals.css`: styles for alert state pill, paused banner, reached note, alerts panel/list/actions with a small-screen layout — existing layout and themes untouched.
  - `README.md`: new "Target Price Alerts" section (in-app only, crossing rules, paused behaviour, cascade delete), alerts API endpoints, and data-model notes.
  - `PROJECT-INFO.md` + `app/privacy/page.tsx`: feature inventory and stored-data copy mention the in-app alert history (no email/push).
- **Intentionally deferred to next batches**: tests/observability/a11y (P3+P4 → `2.0.5`).

### 2.0.5 - unit tests, CI, observability and accessibility polish (P3+P4)

- **Date**: 2026-11-07
- **Why**: completion-guide Priority 3 (automated tests + observability) and Priority 4 (a11y/UX polish) — the reliability work from P0–P2 had no regression suite, no operational signal beyond UI errors, and two real accessibility gaps (form errors not associated with their inputs, silent watchlist load failure).
- **Changes**:
  - `vitest.config.mts` (new) + `package.json`: **Vitest** with a node environment, `tests/**/*.test.ts` include and the `@` alias; `npm test` (`vitest run`) and `npm run test:watch` scripts. No test touches the network, DNS or MongoDB — `fetch`, `node:dns/promises` and `@/lib/db` are mocked.
  - `tests/fixtures.ts` (new): deterministic price-sample factory plus JSON-LD/HTML fixture builders.
  - `tests/analytics.test.ts`: empty/one-sample baselines, repeated price, rise, fall, tied common price, mixed-currency rejection, legacy synthetic exclusion, MRP savings.
  - `tests/stores.test.ts` + `tests/url-guard.test.ts`: store detection, short links, private/loopback/link-local/CGNAT/reserved IPv4 + private IPv6 rejection, protocol/credential checks, URL normalisation, DNS-rebinding guard (public/private/no-record/DNS-failure).
  - `tests/scanner-parsing.test.ts`: JSON-LD, Open Graph, Amazon/Flipkart/Myntra/AJIO adapters, generic fallback, missing/malformed price, currency normalisation, stock state.
  - `tests/scanner-fetch.test.ts`: direct success, retryable failure then success, 5xx retry cap, non-retryable failure, bot-check page, non-HTML response, 2 MB body cap, safe same-store redirect, 5-hop limit, cross-store redirect refusal, proxy fallback.
  - `tests/schedule.test.ts` + `tests/scanner-schedule.test.ts`: effective cadence, batch/time-budget clamping, due-product filter, atomic claim (lock TTL + stale-lock recovery condition), lock release on success/failure, failure backoff at the effective cadence, last price preserved, duplicate-claim skip.
  - `tests/target-alerts.test.ts` + `tests/alerts-lifecycle.test.ts`: crossing transition truth table, guest exclusion, insert/duplicate/error handling, alert views with product metadata, mark-read, dismiss, cascade delete.
  - `tests/ownership.test.ts` + `tests/errors.test.ts`: product/scan/alert routes return 400/401/404 for malformed ids, signed-out viewers and non-owned products; PATCH rejects malformed bodies; error sanitisation hides DB/env details and caps length.
  - `lib/log.ts` (new): single-line JSON `logEvent()` for `scan_ok`, `scan_failed` and `cron_scan_summary` (store, source, attempts, counts, duration, schedule) — never URLs, tokens, emails or user ids.
  - `lib/scanner.ts`: `ScanResult.attempts` operational signal threaded through `fetchHtml`; logs on scan success/failure; exported testable helpers `parseProductHtml`, `looksBlocked`, `isRetryableFetchError`, `buildDueProductFilter`; crossing decision extracted to pure `shouldCreateAlertEvent()` in `lib/alerts.ts`.
  - `app/api/health/route.ts` (new): `GET` readiness — MongoDB `ping` with a 3s timeout, `200 {status:"ok",db:"up"}` or `503 {status:"degraded",db:"down"}`, `cache-control: no-store`, no secrets or error details.
  - `app/api/cron/scan/route.ts`: emits `cron_scan_summary` with counts and duration.
  - `components/TrackForm.tsx` + `components/TargetPriceAlert.tsx`: errors are now programmatically associated with their inputs via `aria-invalid` + `aria-describedby` (stable status ids).
  - `app/page.tsx` + `app/globals.css`: watchlist load failures show an honest `service-notice` ("your saved products are safe") instead of silently rendering an empty list; `loadProducts` returns `{products, failed}`.
  - `.github/workflows/ci.yml` (new): `npm ci` → lint → typecheck → `npm test` → build on push/PR (CI-only placeholder env, no real services).
  - `README.md`: new "Testing" and "Observability" sections, `/api/health` endpoint; `PROJECT-INFO.md`: test framework/CI facts. Test execution was intentionally deferred until the owner approves running gates.

### 2.0.6 - reconcile documentation with the shipped 2.0.x behaviour

- **Date**: 2026-11-07
- **Why**: owner request — the docs still described pre-P1/P3 behaviour (≤20 products per cron run, 6h defaults, "no test framework"), which contradicted the code after `2.0.2`–`2.0.5`.
- **Changes**:
  - `PROJECT-INFO.md`: full reconciliation against the current source — 68 commits, 100 tracked files, ~6,895 TS/TSX/CSS lines, 16 components, 13 lib modules, 6 pages, 10 API paths / 16 handlers, 3 collections / 7 indexes, 11 Vitest suites + GitHub Actions; architecture now documents the daily 24h cadence, bounded cron batch (default 10 / max 50, 45s budget), atomic scan claims + 5-minute stale-lock TTL, in-app alerts, structured logs, `/api/health`, DNS-aware SSRF guards and the a11y/error states. Resume examples corrected (`≤20 per run` → 10/50 bound) and no longer claim gates have passed.
  - `README.md`: tech stack lists React 19/TypeScript, Auth.js, Vitest and GitHub Actions; optional `CRON_SCAN_LIMIT`/`CRON_TIME_BUDGET_MS`/proxy env tuning documented; API section now covers track (POST), list, detail, PATCH/DELETE product, manual rescan, history reset (`DELETE /api/products/:id/samples`), recent drops and `/api/health`; "create or rescan" wording corrected.
  - `.env.example`: added `CRON_TIME_BUDGET_MS` alongside `CRON_SCAN_LIMIT`.
  - `AUDIT.md`: added a re-verification status block — point-in-time report; light `--muted` is now `#5d574a` (≈6.5:1, AA pass), nav/theme controls already 44px, errors already sanitised; the two genuine gaps (form-error association, watchlist load failure) were fixed in `2.0.5`; legacy typography/benchmark details may be stale.
  - No runtime code changed in this commit; tests were still not executed (owner approval pending).

### 2.0.7 - remove unused AI/dev scaffolding

- **Date**: 2026-11-07
- **Why**: owner request — the historical Arena brief was no longer needed, and the remaining AI/dev scratch material did not belong in the product repo.
- **Changes**:
  - Deleted `ANTIGRAVITY_EXECUTION_PROMPT.md` (historical Arena brief, superseded by `AGENTS.md` + `README.md`/`PROJECT-INFO.md`).
  - Deleted `.playwright-cli/` (3 one-off page snapshots from 2026-09-12), `PASTE- sandbox browser/` (4-file external visual-check kit) and `bug and fixes summary/` (3-file paste-in protocol/template) — 11 tracked files total, none referenced by app code, tests or CI.
  - `PROJECT-INFO.md`: counts updated to 89 tracked files and 69 commits; QA line now lists only `artifacts/*.png`, docs line drops `ANTIGRAVITY_EXECUTION_PROMPT.md`.
  - Kept intentionally: `AUDIT.md` (point-in-time audit with status block), `artifacts/*.png` (screenshots required by repo rule 4), `start-ai.bat` (local launcher).
  - No runtime code, tests or config changed.

### 2.0.8 - remove audit, screenshots and launcher

- **Date**: 2026-11-07
- **Why**: owner request — drop the previously retained `AUDIT.md`, `artifacts/` and `start-ai.bat`; confirm that visual UI checking still works without `PASTE- sandbox browser/` before finalising the cleanup.
- **Changes**:
  - Verified playwright/visual skills exist independently of the deleted paste kit: `C:\Users\abu\.claude\skills\playwright-cli\SKILL.md` ("Automate browser interactions, test web pages and work with Playwright tests"), `browser-testing-with-devtools/SKILL.md` and `webapp-testing/SKILL.md` are all present on disk, and `playwright-cli` + `browser` are available in this session. The deleted `PASTE- sandbox browser/` was a separate ABot-specific paste kit (`@sparticuz/chromium` + `puppeteer-core`, hard-coded `node server.js` on `:3000`, ABot selectors) — it was never a `SKILL.md` and is not needed for UI visual checks; it stays deleted.
  - Deleted `AUDIT.md`, all 6 files in `artifacts/` and `start-ai.bat` — 8 tracked files total, none referenced by app code, tests or CI (remaining `*.md` references are historical `COMMIT-HISTORY.md` entries only).
  - `PROJECT-INFO.md`: reconciled to `2.0.8` — 81 tracked files, 70 commits; Visual QA artifacts line and `AUDIT.md` docs reference removed. Note: repo rule 4 still requires any future screenshots to be saved under `artifacts/` (the folder will be recreated on demand).
  - No runtime code, tests or config changed.

### 2.0.9 - drop screenshot rule, run all test gates green

- **Date**: 2026-11-07
- **Why**: owner request — delete the `artifacts/` screenshot rule from `AGENTS.md` (screenshots are for the agent to view and verify, then delete — the owner doesn't need them saved), then run all test gates, which had never been executed since `2.0.5`.
- **Changes**:
  - `AGENTS.md`: rule 4 (save every screenshot under `artifacts/`) deleted; Commit-and-push is now rule 4, Order-of-Operations reference updated.
  - Gate fixes (all caught only because gates finally ran — none of these had ever been exercised):
    - `tests/stores.test.ts`: added missing `describe("URL normalisation")` opener — the file shipped in `2.0.5` with a syntax error (orphan `});`).
    - `lib/types.ts`: `scanLockUntil?: Date` widened to `Date | null` — `claimProductScan`'s `$or` filter explicitly matches null locks.
    - `lib/analytics.ts`: `isObservedSample` is now generic (`<T extends PriceSampleDocument>(sample: T): sample is T & { source: ObservedSource }`) so `filter()` narrows driver `WithId<T>` arrays too.
    - `app/products/[id]/page.tsx`: chart input filtered through `isObservedSample` (runtime-identical — the query already restricts to observed sources — and now type-correct).
    - `lib/stores.ts`: `isSafePublicHostname` reordered — dotted-quad IPv4 literals (e.g. `8.8.8.8`) now reach `isSafePublicIpv4` instead of being rejected by the pure-numeric check first (the classifier was dead code for decimal quads); single-integer hex (`0x7f000001`) now fails closed per the function's own doc comment. This fixes the DNS-accept path for hosts resolving to public IPs.
  - Gate results (first full run): `tsc --noEmit` clean, Vitest **11 files / 113 tests passed**, ESLint clean, `next build` compiled with 12 static pages. Local `node_modules` had stripped type declarations (`mongodb`, `@auth/core`); restored with `npm ci` (same lockfile, no dependency changes, 12 audit findings untouched).
  - `PROJECT-INFO.md`: reconciled to `2.0.9` — 71 commits.

### 2.0.10 - adopt Bun over npm

- **Date**: 2026-11-07
- **Why**: owner request — use Bun instead of npm from now on, recorded as a repo rule.
- **Changes**:
  - `AGENTS.md`: new Execution Rule 5 — dependencies via `bun install`, scripts via `bun run <script>`, one-offs via `bun x`/`bunx`; `npm`/`npm run`/`npm ci`/`npx` banned for this repo. Rule is runner-only: `package.json` scripts unchanged, CI workflow intentionally untouched (still npm) pending owner direction.
  - Verified Bun is available locally (`bun 1.4.4` at `C:\Users\abu\.bun\bin\bun.exe`). No gates re-run in this batch (not requested); next gate run will use `bun run`.
  - `PROJECT-INFO.md`: reconciled to `2.0.10` — 72 commits.
  - No code, tests or config changed.


