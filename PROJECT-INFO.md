# PriceTracked — Project Info Sheet (source of truth for resume & portfolio summaries)

> **Purpose:** every fact an AI (or a person) needs to write a resume "Projects"
> entry or a portfolio project summary for PriceTracked — without reading the code.
> Generate prose from these facts only; do not invent beyond them. Tune length
> and tone to the target (resume = dense & quantified; portfolio = readable &
> story-driven).

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
| Status | Production-deployed on Vercel, actively maintained (2026, 60 commits) |

**One-liners (pick by context):**
- *10 words:* Ecommerce price tracker with Google sign-in, history charts, cron rescans.
- *25 words:* PriceTracked is a Next.js + MongoDB price tracker for Amazon India, Flipkart, Myntra and AJIO with Google sign-in, guest watchlists, daily cron scans and SVG history charts.
- *Elevator pitch:* PriceTracked tracks ecommerce prices before you buy. Paste any product URL to record snapshots over time, see highest/lowest/typical prices with change frequency, get a BUY/WAIT verdict with deal score, set target-price alerts, and let daily cron rescans keep history fresh. Guests keep a private browser watchlist that migrates to their Google account on sign-in.

---

## 2. Tech stack — exact versions

| Category | Technology | Version | Role |
|---|---|---|---|
| Framework | Next.js (App Router) | ^15.3.0 | SSR pages + API routes, Turbopack dev `:3010` |
| UI | React | ^19.0.0 | Server + client components (15 in `components/`) |
| UI DOM | react-dom | ^19.0.0 | Rendering |
| Language | TypeScript | ^5.8.0 | Strict, `tsc --noEmit` gate |
| Database | MongoDB Atlas | via `mongodb` ^6.16.0 driver (no ORM) | `products` + `price_samples` |
| Auth | Auth.js / NextAuth | ^5.0.0-beta.31 | Google OAuth, JWT sessions, `trustHost:true` |
| Auth helper | google-auth-library | ^11.1.0 | Popup code exchange + `verifyIdToken` |
| Validation | zod | ^3.24.3 | `POST /api/products {url}` schema |
| Hosting | Vercel Functions | `app/api/*` routes | Production deployment |
| Cron | Vercel Cron | `0 0 * * *` daily UTC → `GET /api/cron/scan` | Scheduled rescans |
| Styling | Custom CSS | `app/globals.css` 707 lines, no framework | Light/dark themes, paper `#f7f4ec` / dark `#0c1414` |
| Fonts | Geist, Geist_Mono, Fraunces, Playfair_Display | via Next fonts | Body / mono / display |
| Charts | Hand-rolled SVG | `PriceChart.tsx` 414 lines, no chart lib | 720×300 interactive chart |
| SEO | metadataBase, OG ImageResponse, `icon.svg` | — | Discoverability |
| Lint | ESLint | ^9.25.0 + `eslint-config-next` | `npm run lint` |
| VCS | Git / GitHub | main branch | 60 commits, trunk-based |

---

## 3. Architecture (how it fits together)

- **App Router + Auth.js + raw Mongo driver:** server components (`page.tsx`, `products/[id]/page.tsx`, `ProductList`, `BuyAdviceCard`) read Mongo directly via `lib/db.ts` (global client caching, 5 indexes); client components (`TrackForm`, `PriceChart`, `TargetPriceAlert`, `RescanButton`, `GoogleSignInPill`) call 7 API paths.
- **Two auth paths, one session cookie:** standard `[...nextauth]` handler plus a fast popup flow — `GoogleSignInPill` opens Google OAuth (520×620), `/auth/google/callback` posts the code to `POST /api/auth/google`, which exchanges + verifies and sets the same `authjs.session-token` JWT cookie, then reloads.
- **Guest-first with claim:** signed-out visitors get an httpOnly `pricetracked-guest-id` UUID cookie (180d) via `getOrCreateViewer`; lists are guest-scoped with a sync banner. On sign-in `claimGuestProducts` moves guest products to the Google `userId`, merging duplicates by `normalizedUrl` and re-pointing samples; home shows `Saved N products…` notice.
- **Scanner isolated:** `lib/scanner.ts` (621 lines) does direct fetch (Chrome/125 UA, 18s timeout, 3 attempts) then optional `SCRAPER_PROXY_*` render fallback; parse order JSON-LD → OG price meta → store-specific regex (Flipkart/Amazon/Myntra/AJIO selectors) → generic `data-price/data-testid/commerce JSON`; MRP variants, currency normalisation (`₹→INR`), stock detection, blocked-page (<50KB + captcha/robot) and SSRF guards. Replaceable without touching UI/analytics.
- **Cron scans due products:** `GET /api/cron/scan` (requires `CRON_SECRET` via query/header/Bearer) scans ≤20 due (`active && nextScanAt<=now`, `scanEveryHours` default 6) via `scanDueProducts`, updating `nextScanAt` and `lastError` on failure.
- **Instant-chart backfill:** first scan queues a FIFO backfill (1.5s) inserting a 6-point `mrp-baseline/historical` synthesis (90/65/45/30/14/3d) so charts render before real history accumulates.

---

## 4. Feature inventory (technical depth for bullet generation)

1. **Paste-to-track** — `POST /api/products {url}` resolves short-links (`amzn.in/amzn.to/a.co`, `fkrt.it/dl.*`, `ajiio.in`), follows ≤5 redirects, normalises (strips tracking params, canonicalises), asserts allowed host, then upserts by `{userId,normalizedUrl}`.
2. **4 dedicated + 1 generic adapters** — Amazon India, Flipkart, Myntra, AJIO regex paths plus schema.org/OG/generic fallback for the wider web; URL normalisation preserves `affid/asin/pid/sku/tag`.
3. **Price stats** — highest+date, lowest+date, most-common + %, change count, avg change frequency, current/stock/source; `calculatePriceStats` in `lib/analytics.ts`.
4. **Buy advice** — verdict `BUY NOW / FAIR PRICE / WAIT` with deal score /100, SVG gauge, headline + reason, trend (📉/📈/⚖️) + percentile + savings chips; thresholds ≥75 buy, ≥48 fair; single-sample `Gathering Baseline` state.
5. **Interactive SVG chart** — 720×300, downsampled to 220 (preserves first/last/min/max), MRP dashed line, live vs historical dots, crosshair + keyboard (arrows/Home/End/Escape) inspection, ARIA summary, legend + snapshot count.
6. **Target-price alerts (in-app)** — `PATCH /api/products/:id`, number input + −5%/−10%/−15%/Lowest presets, progress bar, `🎯 Target Price Reached!` state + list badges; no email/push worker.
7. **Manual rescan + reset** — `POST .../scan` with spinner, `DELETE .../samples` (confirm → clear + rescan + refresh).
8. **Guest-to-account migration** — private browser watchlist, duplicate-merge claim, concise confirmation; failures never surface as empty lists.
9. **Recent-drops tape** — `GET /api/recent-drops` (6h cookie rotation, 14-URL Sep-2026 pool, ≤5 scans @8s, returns 3) with skeleton → `▼ %/₹` chips.
10. **Google sign-in UX** — `G Sign in` pill, popup + blocked-popup redirect fallback, `details` account menu (avatar/name/email + server-action sign-out), `Sign-in setup` disabled state when creds missing.
11. **Dark/light theme** — `data-theme` + `localStorage pricetracked-theme`, FOUC-prevent inline script, `role=switch` toggle, per-scheme `themeColor`.
12. **Content + legal** — `/how-it-works`, `/privacy`, `/terms`, iPhone-style `BackButton`, `SiteFooter` (Stores + Legal + `abufolio.vercel.app` credit), `not-found` + per-product `loading` skeletons.
13. **Scraper-proxy support** — `SCRAPER_PROXY_ENDPOINT/TOKEN/URL_PARAM/TOKEN_PARAM/AUTH_HEADER` (query- or header-token styles) for legal render providers.
14. **Security** — per-user `{userId,normalizedUrl}` uniqueness, `viewer.userId`-scoped detail queries (`notFound` on cross-user), `CRON_SECRET` gate, `sanitizeErrorMessage` (masks secrets, preserves bot/proxy/captcha hints, 200-char cap).

---

## 5. Quality & testing

- **No unit/e2e framework:** no jest/vitest/cypress/playwright dependencies in `package.json`.
- **Gates that do exist:** `npm run lint` (ESLint `next/core-web-vitals`), `npm run typecheck` (`tsc --noEmit`, strict, ES2017, `@/*` alias), `npm run build` (`next build`).
- **Manual QA traces:** 3 `.playwright-cli/*.yml` dumps (2026-09-12), `PASTE- sandbox browser/` visual kit, 6 `artifacts/*.png` (light/dark desktop + mobile + chart viewport).
- **Docs in-repo:** `README.md` (177 lines), `AUDIT.md`, `ANTIGRAVITY_EXECUTION_PROMPT.md` (Arena execution spec), `AGENTS.md`, this sheet.

---

## 6. Scale metrics (quantifiables)

- **77** git-tracked files; **~5,353 lines** across TS/TSX/CSS (largest `globals.css` 707, `scanner.ts` 621, `PriceChart.tsx` 414).
- **7 API paths / 8 route files / 10 method handlers** (GET×4, POST×3, PATCH×1, DELETE×2).
- **15 components** (server + client split), **9 lib modules**, **7 pages** (`/`, `/products/[id]`, `/how-it-works`, `/privacy`, `/terms`, `/auth/google/callback` + loading/not-found/OG-image).
- **2 collections, 5 indexes** (`{userId,normalizedUrl}` unique, `{active,nextScanAt}`, `{userId,updatedAt}`, `price_samples {productId,capturedAt}` + `{productId,price}`).
- **4 dedicated stores + 1 generic**; **14-URL** recent-drops pool; **3 demo chips** (iPhone 16, WH-1000XM5, Pegasus).
- **6 price samples** synthesised per new product for instant charts; up to **1,000 samples** loaded per detail page, last **12** shown.
- **60 commits** on `main`.

---

## 7. Engineering practices worth mentioning

- Scanner/UI/analytics separation — `lib/scanner.ts` replaceable without touching watchlist or stats.
- Per-user isolation — unique compound index + scoped queries, fail-closed `notFound` on cross-user access.
- Secret hygiene — `CRON_SECRET` gate with non-prod bypass only when unset; error sanitiser masks DB/auth secrets.
- SSRF + redirect safety — private-host blocklist, ≤5-hop safe-redirect enforcement, URL canonicalisation.
- Degradation by design — proxy fallback, blocked-page detection, backfill synthesis, `Sign-in setup` state instead of broken avatar.
- Single-query discipline — detail loads product + 1,000 samples in two scoped reads; dashboard lists 50 with ISO-serialised dates.
- Keyboard + ARIA chart — pointer + keyboard inspection, live regions, labelled controls, 44px targets.
- Trunk-based Git workflow; AI-assisted development governed by in-repo agent rules (`AGENTS.md`).

---

## 8. ATS / keyword tags

price tracker, ecommerce analytics, Next.js 15, App Router, React 19, TypeScript, server components, client components, REST API, MongoDB, NoSQL, Auth.js, NextAuth, Google OAuth, JWT sessions, Vercel Functions, Vercel Cron, web scraping, HTML parsing, JSON-LD, Open Graph, rate limiting, SSRF protection, data visualisation, SVG charts, responsive design, dark mode, accessibility (ARIA), SEO, Open Graph images, zod validation, ESLint, Git/GitHub.

---

## 9. Ready-made examples (regenerate freely — facts only)

**Resume bullets:**
- Built an ecommerce price tracker (Next.js 15 App Router, React 19, TypeScript, MongoDB driver) for Amazon India, Flipkart, Myntra and AJIO plus a generic JSON-LD/OG fallback, with short-link resolution and SSRF-safe normalisation.
- Designed a scraper→upsert pipeline (Chrome UA, 18s×3 attempts, proxy fallback, store-specific + generic parsing, MRP/currency/stock extraction) with per-user `{userId,normalizedUrl}` uniqueness and daily Vercel Cron rescans (≤20 due per run).
- Implemented Google OAuth via Auth.js (standard handler + fast popup code-exchange flow) with guest UUID watchlists that merge into accounts on sign-in, plus in-app target-price alerts and manual rescan/history-reset actions.
- Created a hand-rolled SVG price chart (220-point downsampling, MRP overlay, crosshair + keyboard inspection) with highest/lowest/mode/change-frequency stats and a BUY/FAIR/WAIT verdict with deal score.
- Shipped a themed responsive app (custom CSS, dark/light with FOUC guard, 7 pages, SEO/OG images) on Vercel; gated by ESLint + `tsc --noEmit` + `next build`, no unit framework.

**Resume project paragraph (3 lines):** Ecommerce price tracker built with Next.js 15, React 19 and MongoDB, deployed on Vercel with daily cron rescans. Features dedicated Amazon/Flipkart/Myntra/AJIO adapters plus generic fallback, Google sign-in with guest-to-account watchlist migration, and an interactive SVG history chart with buy advice and target alerts. Ships as a themed responsive app with 7 API paths, per-user isolation and strict TypeScript + ESLint gates.

**Portfolio card (title + ~30 words + stack):** PriceTracked — paste any product link to track its price over time, see highs/lows/trends with a buy verdict, set target alerts, and let daily scans keep history fresh. Guest mode included. `Next.js · React · MongoDB · Auth.js · Vercel`

**Tone/length guide for the AI:** Frame impact as user capability + the hardest engineering problem solved (no business KPIs). Resume = 3–5 dense bullets or one 3-line paragraph, lead with verbs and numbers, keywords from §8; portfolio = friendly paragraph + feature list + stack chips, mention the 4-store adapters, the guest-claim flow, and the hand-rolled chart; never claim email alerts, PWA installability, or a unit test suite — none exist.
