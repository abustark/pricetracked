# PriceTracked — Project Info Sheet (source of truth for resume & portfolio summaries)

> **Purpose:** every fact an AI (or a person) needs to write a resume "Projects"
> entry or a portfolio project summary for PriceTracked — without reading the code.
> Generate prose from these facts only; do not invent beyond them. Tune length
> and tone to the target (resume = dense & quantified; portfolio = readable &
> story-driven).
>
> **Last reconciled with the code:** `2.1.0` (2026-11-07).

---

## 1. Project identity

| Field | Value |
|---|---|
| Name | **PriceTracked — Ecommerce Price Tracker** |
| Type | Full-stack web application (consumer price-tracking utility) |
| Author | ABu (`abustark` on GitHub) |
| Live site | https://pricetracked.vercel.app |
| Source | https://github.com/abustark/pricetracked |
| License | None declared (private) |
| Status | Production-deployed on Vercel, actively maintained (2026, 73 commits) |

**One-liners (pick by context):**
- *10 words:* Ecommerce price tracker with Google sign-in, history charts, cron rescans.
- *25 words:* PriceTracked is a Next.js + MongoDB price tracker for Amazon India, Flipkart, Myntra and AJIO with Google sign-in, guest watchlists, daily cron scans and SVG history charts.
- *Elevator pitch:* PriceTracked tracks ecommerce prices before you buy. Paste any product URL to record snapshots over time, see highest/lowest/typical prices with change frequency, get a BUY/WAIT verdict with deal score, set in-app target-price alerts, and let daily cron rescans keep history fresh. Guests keep a private browser watchlist that migrates to their Google account on sign-in.

---

## 2. Tech stack — exact versions

| Category | Technology | Version | Role |
|---|---|---|---|
| Framework | Next.js (App Router) | ^15.3.0 | SSR pages + API routes, Turbopack dev `:3010` |
| UI | React | ^19.0.0 | Server + client components (16 in `components/`) |
| UI DOM | react-dom | ^19.0.0 | Rendering |
| Language | TypeScript | ^5.8.0 | Strict, `tsc --noEmit` gate |
| Database | MongoDB Atlas | via `mongodb` ^6.16.0 driver (no ORM) | `products` + `price_samples` + `alert_events` |
| Auth | Auth.js / NextAuth | ^5.0.0-beta.31 | Google OAuth, JWT sessions, `trustHost:true` |
| Auth helper | google-auth-library | ^11.1.0 | Popup code exchange + `verifyIdToken` |
| Validation | zod | ^3.24.3 | `POST /api/products {url}` schema |
| Hosting | Vercel Functions | `app/api/*` routes | Production deployment |
| Cron | Vercel Cron | `0 0 * * *` daily UTC → `GET /api/cron/scan` | Scheduled rescans (Hobby: daily maximum) |
| Styling | Custom CSS | `app/globals.css` 712 lines, no framework | Light/dark themes, paper `#f7f4ec` / dark `#0c1414` |
| Fonts | Geist, Geist_Mono, Fraunces, Playfair_Display | via Next fonts | Body / mono / display |
| Charts | Hand-rolled SVG | `PriceChart.tsx` 341 lines, no chart lib | 720×300 interactive chart |
| SEO | metadataBase, OG ImageResponse, `icon.svg` | — | Discoverability |
| Lint | ESLint | ^9.25.0 + `eslint-config-next` | `bun run lint` |
| Tests | Vitest | ^5.1.0 | `bun run test` — 11 unit suites, network/DNS/MongoDB mocked |
| CI | GitHub Actions | `.github/workflows/ci.yml` | `bun install` → lint → typecheck → test → build |
| VCS | Git / GitHub | `main` + mirrored Arena branch | 73 commits, trunk-based |

---

## 3. Architecture (how it fits together)

- **App Router + Auth.js + raw Mongo driver:** server components (`page.tsx`, `products/[id]/page.tsx`, `ProductList`, `BuyAdviceCard`) read Mongo directly via `lib/db.ts` (global client caching, 7 indexes); client components (`TrackForm`, `PriceChart`, `TargetPriceAlert`, `RescanButton`, `GoogleSignInPill`, `AlertsPanel`) call the 10 API paths.
- **Two auth paths, one session cookie:** standard `[...nextauth]` handler plus a fast popup flow — `GoogleSignInPill` opens Google OAuth (520×620), `/auth/google/callback` posts the code to `POST /api/auth/google`, which exchanges + verifies and sets the same `authjs.session-token` JWT cookie, then reloads.
- **Guest-first with claim:** signed-out visitors get an httpOnly `pricetracked-guest-id` UUID cookie (180d) via `getOrCreateViewer`; lists are guest-scoped with a sync banner. On sign-in `claimGuestProducts` moves guest products to the Google `userId`, merging duplicates by `normalizedUrl` and re-pointing samples; home shows `Saved N products…` notice. Guests never receive alert events (`lib/guest.ts`).
- **Scanner isolated:** `lib/scanner.ts` (759 lines) does direct fetch (Chrome/125 UA, 18s timeout, 3 attempts with 1s/2s backoff) then optional `SCRAPER_PROXY_*` render fallback; manual redirect handling (≤5 hops, re-validated each hop); 2 MB streaming body cap; non-HTML content-type rejection; parse order JSON-LD → OG price meta → store-specific regex (Flipkart/Amazon/Myntra/AJIO selectors) → generic `data-price/data-testid/commerce JSON`; MRP variants, currency normalisation (`₹→INR`), stock detection, blocked-page (<50KB + captcha/robot) detection. All fetch targets pass `lib/url-guard.ts` (protocol, no credentials, private-host blocklist + DNS-resolved public-IP check). Replaceable without touching UI/analytics.
- **Daily scan pipeline with atomic claims:** `GET /api/cron/scan` (requires `CRON_SECRET` via query/header/Bearer) selects active due products owned by a real non-guest user, bounded to `CRON_SCAN_LIMIT` (default 10, max 50) and a ~45s wall-clock budget. Each product is claimed with an atomic `findOneAndUpdate` (`scanLockUntil`, 5-minute TTL — stale locks self-expire) before fetching, then the lock is released on success or failure. Manual rescans use the same claim, so cron and manual runs cannot double-scan. Failures keep the last valid price, record `lastError`/`lastAttemptAt`/`failureCount`, and retry at the effective cadence.
- **Honest cadence:** `lib/schedule.ts` is the single source of truth — daily cron (`CRON_SCHEDULE`), 24h `CRON_CADENCE_HOURS`, effective cadence `max(scanEveryHours, 24)`. Vercel Hobby only permits daily cron, so the UI and defaults never advertise 6h.
- **Genuine history only:** price statistics, charts and buy advice use only real observations (`direct`/`proxy` — `OBSERVED_SOURCES` in `lib/analytics.ts`). The former synthetic 6-point backfill (`mrp-baseline`/`historical`) was removed in `2.0.2`; new products start with one real scan and an honest "Gathering baseline" state, and `scripts/migrate-synthetic-history.mjs` removes legacy synthetic rows (dry-run → backup → delete/restore).
- **In-app target alerts:** `lib/alerts.ts` creates an event only on a genuine above→at-or-below crossing (`shouldCreateAlertEvent`), guarded by the product's `targetPriceReached` transition state plus a unique `{productId,target,observedAt}` index. Events are listed on the watchlist (`AlertsPanel`), can be marked read/dismissed, and cascade-delete with the product. No email/push channel exists.
- **Observability + readiness:** `lib/log.ts` emits one-line JSON events (`scan_ok`, `scan_failed`, `cron_scan_summary`) with store, source, attempts, counts, duration and schedule — never URLs, tokens, emails or user ids. `GET /api/health` performs a MongoDB `ping` with a 3s timeout and returns 200 (`db:"up"`) or 503 (`db:"down"`) with `cache-control: no-store` and no secrets.

---

## 4. Feature inventory (technical depth for bullet generation)

1. **Paste-to-track** — `POST /api/products {url}` resolves short-links (`amzn.in/amzn.to/a.co`, `fkrt.it/dl.*`, `ajiio.in`), follows ≤5 redirects with per-hop validation, normalises (strips tracking params, canonicalises), asserts a safe public host via DNS checks, then upserts by `{userId,normalizedUrl}`.
2. **4 dedicated + 1 generic adapters** — Amazon India, Flipkart, Myntra, AJIO regex paths plus schema.org/OG/generic fallback for the wider web; URL normalisation preserves `affid/asin/pid/sku/tag`.
3. **Price stats** — highest+date, lowest+date, most-common + %, change count, avg change frequency, current/stock/source; `calculatePriceStats` in `lib/analytics.ts`; mixed currencies are never averaged (latest observed currency wins).
4. **Buy advice** — verdict `BUY NOW / FAIR PRICE / WAIT` with deal score /100, SVG gauge, headline + reason, trend (📉/📈/⚖️) + percentile + savings chips; thresholds ≥75 buy, ≥48 fair; single-sample `Gathering Baseline` state.
5. **Interactive SVG chart** — 720×300, downsampled to 220 points (preserves first/last/min/max), MRP dashed line, live vs proxy dots, crosshair + keyboard (arrows/Home/End/Escape) inspection, ARIA summary, legend + snapshot count.
6. **Target-price alerts (in-app)** — `PATCH /api/products/:id`, number input + −5%/−10%/−15%/Lowest presets, progress bar, on/paused state, `🎯 Target Price Reached!` state + list badges, and an idempotent alert-event history on the watchlist (read/dismiss, links to products, cascade delete); no email/push channel.
7. **Manual rescan + reset** — `POST /api/products/:id/scan` claims the scan lock (409 when busy); `DELETE /api/products/:id/samples` confirms → clears samples + last-price metadata → next scan rebuilds genuine history.
8. **Guest-to-account migration** — private browser watchlist, duplicate-merge claim, concise confirmation; a failed watchlist load shows an honest service notice instead of a silently empty list.
9. **Recent-drops tape** — `GET /api/recent-drops` (6h browser window, 14-URL pool, ≤5 scan attempts, returns 3) with skeleton → `▼ %/₹` chips; prices are scanned live, never hardcoded.
10. **Google sign-in UX** — `G Sign in` pill, popup + blocked-popup redirect fallback, `details` account menu (avatar/name/email + server-action sign-out), `Sign-in setup` disabled state when creds missing.
11. **Dark/light theme** — `data-theme` + `localStorage pricetracked-theme`, FOUC-prevent inline script, `role=switch` toggle, per-scheme `themeColor`, reduced-motion support.
12. **Content + legal** — `/how-it-works`, `/privacy`, `/terms`, iPhone-style `BackButton`, `SiteFooter` (Stores + Legal + `abufolio.vercel.app` credit), `not-found` + per-product `loading` skeletons.
13. **Scraper-proxy support** — `SCRAPER_PROXY_ENDPOINT/TOKEN/URL_PARAM/TOKEN_PARAM/AUTH_HEADER` (query- or header-token styles) for legal render providers; manual redirects and same-origin validation.
14. **Security** — per-user `{userId,normalizedUrl}` uniqueness, `viewer.userId`-scoped detail/update/rescan/delete queries (`notFound`/404 on cross-user), `CRON_SECRET` gate, SSRF/redirect/DNS safeguards, response-type/size limits, `sanitizeErrorMessage` (masks secrets, preserves bot/proxy/captcha hints, 200-char cap).
15. **Scheduler reliability** — atomic scan claim + stale-lock recovery, bounded batch/time budget, failure backoff with last-price preservation, distinct last-success vs last-attempt UI state.
16. **Tests + CI** — 11 Vitest suites with `fetch`/DNS/MongoDB mocked, `bun run test`/`bun run test:watch`, GitHub Actions running lint → typecheck → test → build.
17. **Observability** — structured scan/cron JSON logs and a real readiness endpoint that pings MongoDB.
18. **Accessibility** — skip link, visible focus rings, 44px nav/control targets, keyboard-operable chart, labelled live regions, `aria-invalid`/`aria-describedby` form-error association, `prefers-reduced-motion` handling, WCAG-AA light/dark muted text.

---

## 5. Quality & testing

- **Unit tests (Vitest):** `bun run test` / `bun run test:watch`, configured in `vitest.config.mts` (node environment, `@` alias). 11 suites: analytics, schedule, stores/short-links, URL guard, scanner parsing, scanner fetch, scanner scheduler, target-alert decision, alert lifecycle, route ownership, error sanitisation. `fetch`, `node:dns/promises` and `@/lib/db` are mocked — no test touches the network, DNS or a real database.
- **Gates wired in CI:** `bun run lint` (ESLint `next/core-web-vitals`), `bun run typecheck` (`tsc --noEmit`, strict, ES2017, `@/*` alias), `bun run test`, `bun run build` (`next build`). All scripts run via Bun (repo rule 5); `package.json` scripts unchanged. `.github/workflows/ci.yml` runs all four on push/PR with placeholder env values and no real services.
- **Docs in-repo:** `README.md` (setup, testing, deployment, provenance, alerts, observability, API, data model), `PROJECT-INFO.md`, `AGENTS.md`.

---

## 6. Scale metrics (quantifiables)

- **81** git-tracked files; **~6,895 lines** across TS/TSX/CSS (largest `lib/scanner.ts` 759, `app/globals.css` 712, `components/PriceChart.tsx` 341).
- **10 API paths / 10 route files / 16 method handlers** (GET×7, POST×4, PATCH×2, DELETE×3).
- **16 components** (server + client split), **13 lib modules**, **6 app pages** (`/`, `/products/[id]`, `/how-it-works`, `/privacy`, `/terms`, `/auth/google/callback`) plus `layout`, `not-found`, `loading` and `opengraph-image`.
- **3 collections, 7 indexes** (`products`: unique `{userId,normalizedUrl}`, `{active,nextScanAt}`, `{userId,updatedAt}`; `price_samples`: `{productId,capturedAt}`, `{productId,price}`; `alert_events`: `{userId,observedAt}`, unique `{productId,target,observedAt}`).
- **4 dedicated stores + 1 generic**; **14-URL** recent-drops pool; **3 demo chips** (iPhone 16, WH-1000XM5, Pegasus).
- Up to **1,000 observed samples** (`direct`/`proxy`) loaded per detail page, last **12** shown in "Recent scans"; chart downsamples to **220** points.
- Cron bounds: **10** products per run by default (**50** max) within a **45s** budget; **5-minute** stale-lock TTL.
- **73 commits** on `main` (mirrored to `arena/01a030cf-pricetracked`).

---

## 7. Engineering practices worth mentioning

- Scanner/UI/analytics separation — `lib/scanner.ts` replaceable without touching watchlist or stats.
- Per-user isolation — unique compound index + scoped queries, fail-closed 404 on cross-user access across read/update/rescan/delete.
- Secret hygiene — `CRON_SECRET` gate with non-prod bypass only when unset; error sanitiser masks DB/auth secrets; logs exclude user data and URLs.
- SSRF + redirect safety — protocol/credential checks, private IPv4/IPv6 blocklist, DNS resolution requiring public addresses, ≤5 re-validated redirect hops, proxy same-origin enforcement.
- Reliability — atomic scan claim with stale-lock recovery, bounded batch/time budget, retry/backoff, last valid price preserved, distinct last-success vs last-attempt state.
- Evidence over estimates — genuine observations only (`direct`/`proxy`), explicit "Gathering baseline" state, no synthetic history.
- Testability — pure helpers (`parseProductHtml`, `looksBlocked`, `isRetryableFetchError`, `buildDueProductFilter`, `shouldCreateAlertEvent`) and mocked I/O keep the unit suite deterministic.
- Degradation by design — proxy fallback, blocked-page detection, service-unavailable watchlist notice, `Sign-in setup` state instead of a broken avatar.
- Single-query discipline — detail loads product + up to 1,000 samples in two scoped reads; dashboard lists 50 with ISO-serialised dates.
- Keyboard + ARIA — pointer + keyboard chart inspection, live regions, labelled controls, 44px targets, associated form errors.
- Trunk-based Git workflow; AI-assisted development governed by in-repo agent rules (`AGENTS.md`).

---

## 8. ATS / keyword tags

price tracker, ecommerce analytics, Next.js 15, App Router, React 19, TypeScript, server components, client components, REST API, MongoDB, NoSQL, Auth.js, NextAuth, Google OAuth, JWT sessions, Vercel Functions, Vercel Cron, web scraping, HTML parsing, JSON-LD, Open Graph, rate limiting, SSRF protection, DNS rebinding protection, distributed scan locks, structured logging, health checks, Vitest, GitHub Actions, CI/CD, data visualisation, SVG charts, responsive design, dark mode, accessibility (ARIA, WCAG), SEO, Open Graph images, zod validation, ESLint, Git/GitHub.

---

## 9. Ready-made examples (regenerate freely — facts only)

**Resume bullets:**
- Built an ecommerce price tracker (Next.js 15 App Router, React 19, TypeScript, MongoDB driver) for Amazon India, Flipkart, Myntra and AJIO plus a generic JSON-LD/OG fallback, with short-link resolution and DNS-aware SSRF-safe normalisation.
- Designed a scraper→upsert pipeline (Chrome UA, 18s×3 attempts, proxy fallback, store-specific + generic parsing, MRP/currency/stock extraction) with per-user `{userId,normalizedUrl}` uniqueness and daily Vercel Cron rescans bounded to 10 products per run (max 50) inside a 45s budget.
- Added atomic scan claiming with a 5-minute stale-lock TTL, bounded batch/time budgets, retry/backoff, failure counters and last-valid-price preservation so cron and manual rescans cannot double-scan.
- Implemented Google OAuth via Auth.js (standard handler + fast popup code-exchange flow) with guest UUID watchlists that merge into accounts on sign-in, plus idempotent in-app target-price alerts and manual rescan/history-reset actions.
- Created a hand-rolled SVG price chart (220-point downsampling, MRP overlay, crosshair + keyboard inspection) with highest/lowest/mode/change-frequency stats and a BUY/FAIR/WAIT verdict with deal score.
- Shipped a themed responsive app (custom CSS, dark/light with FOUC guard, 6 pages, SEO/OG images) on Vercel; gated by ESLint, `tsc --noEmit`, an 11-suite Vitest unit suite and a GitHub Actions pipeline, with structured scan/cron logs and a MongoDB readiness endpoint.

**Resume project paragraph (3 lines):** Ecommerce price tracker built with Next.js 15, React 19 and MongoDB, deployed on Vercel with daily cron rescans. Features dedicated Amazon/Flipkart/Myntra/AJIO adapters plus generic fallback, Google sign-in with guest-to-account watchlist migration, and an interactive SVG history chart with buy advice and in-app target alerts. Ships as a themed responsive app with 10 API paths, per-user isolation, atomic scan locks and strict TypeScript + ESLint + Vitest gates.

**Portfolio card (title + ~30 words + stack):** PriceTracked — paste any product link to track its price over time, see highs/lows/trends with a buy verdict, set target alerts, and let daily scans keep history fresh. Guest mode included. `Next.js · React · MongoDB · Auth.js · Vercel`

**Tone/length guide for the AI:** Frame impact as user capability + the hardest engineering problem solved (no business KPIs). Resume = 3–5 dense bullets or one 3-line paragraph, lead with verbs and numbers, keywords from §8; portfolio = friendly paragraph + feature list + stack chips, mention the 4-store adapters, the guest-claim flow, and the hand-rolled chart; never claim email alerts, PWA installability, or browser/e2e coverage — none exist (unit tests are Vitest only).
