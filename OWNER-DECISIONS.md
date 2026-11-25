# Owner Decisions — PriceTracked (Phase 0 record)

> Recorded **2026-11-25** from the owner's answers to the Phase 0 decision
> questions. These decisions scope every phase after Phase 1. **Revisit if the
> audience, budget or data-source policy changes.**

## 1. Operating mode — personal use + small recruiter cohort, not mainstream

**Decision:** The app is for the owner only for now, with Google sign-in access
given to a small group of recruiters. It is **not** a mainstream public app.

**Implications:**
- No public-pilot infrastructure: no multi-tenant scale-out, no public-scale
  abuse/rate-limiting, no public job queue or worker fleet.
- Access control is the existing Google OAuth sign-in; the owner controls who
  can sign in through the OAuth client/account credentials.
- The plan's **shared product catalog / multi-user history migration**
  (originally Phase 2) is **de-scoped** — not justified at this scale. Private
  per-user watchlists (already implemented) remain the model.
- Decision is marked **"for now"**: revisit if the user base grows beyond a
  small cohort.

## 2. Data source — direct retailer scraping + existing scraper proxy

**Decision:** Direct retailer fetching and the scraper/render proxy the site
has used so far are the permitted sources.

**Implications:**
- **No PriceHistoryApp data import and no historical-data licensing**; the
  plan's licensing work (Phase 5) is dropped. Never bulk-import that data
  without a written licence.
- Store terms still apply: keep reasonable scan cadence, no access-control
  bypass. The existing `SCRAPER_PROXY_*` render fallback stays the reliability
  path for anti-bot-blocked pages.

## 3. Budget — free only

**Decision:** No paid services; stay on the free tier everywhere.

**Implications:**
- Vercel Hobby (daily cron only) and MongoDB Atlas free tier remain the
  deployment targets.
- No paid queue, notification or provider services. Any future durable-job
  work must be free-tier compatible or it is deferred.

## 4. Notification channel — in-app/site only

**Decision:** Alerts are in-app/site only. No email, no push.

**Implications:**
- The plan's **notification outbox + delivery channel** (originally Phase 3)
  is **dropped**; the alert durability work shipped in `2.1.3` (event persisted
  before the reached state advances) is the final delivery path.
- Existing UI copy already states alerts are in-app only — nothing to change.

## Revised phase outlook

| Plan phase | Originally | After these decisions |
|---|---|---|
| Phase 2 | Shared catalog + full DB migration | Replaced by small correctness items (e.g. idempotent guest claim + visible status) — **no migration** |
| Phase 3 | Durable queue/worker/outbox + one delivery channel | Collection-only at most; delivery channel dropped; likely **deferred** at personal scale |
| Phase 4 | UX integration + limited rollout | UI redesign (portfolio priority); rollout tooling not needed |
| Phase 5 | Additional stores + historical licensing | Additional stores one at a time; **licensing dropped** |
