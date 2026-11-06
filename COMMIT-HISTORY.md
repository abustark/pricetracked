# pricetracked Commit Log

This document tracks every commit following the `2.0.x` versioning schema:

- Sequence: `2.0.1`, `2.0.2`, ..., `2.0.9`, `2.0.10` ➔ `2.1.0`, `2.1.1`, ..., `2.1.10` ➔ `2.2.0`, etc. The third number never exceeds `.10`.
- Format: `<version> - <short sentence>`
- **One version number per agent response / request batch** — not per issue, not per commit: a single owner request (even if it fixes many issues) consumes exactly ONE version number, multiple commits inside one response all take that same number (fold follow-up fixes into it — never burn a second number), and only a genuinely new owner request (a new response turn) advances the number.

> ### 📌 Next version — **keep this line current, every commit**
> - **`main` → `2.0.2`** (current head is `2.0.1` — see below)

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
