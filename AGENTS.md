# AGENTS.md — Agent Instructions for PriceTracked

These rules are mandatory for any AI agent working in this repository.

## Execution Rules

1. **Implement first.** The AI's primary job is to perform updates, write code, fix bugs, and do exactly what the user asks. Do this first, without side quests or extra steps the user did not ask for.

2. **Run / test / gates only on explicit request.** Running new files, starting servers, testing updates, and checking gates (typecheck, lint, build, tests, screenshots) may only be executed when the user explicitly mentions or asks for them.

3. **Remind, don't run.** In its response, the AI may remind the user that running or testing the new updates is available. It must only actually run them after the user acknowledges or explicitly proceeds with it.

4. **Commit and push every big change.** Significant work (features, redesigns, multi-file edits, rule updates) must be committed and pushed to `origin/main` as part of finishing it — and fast-forwarded onto `arena/01a030cf-pricetracked` so both branches stay identical — without waiting for an explicit request. Only trivial typo-level tweaks may be batched into the next commit.

5. **Use Bun, not npm.** Install dependencies with `bun install` and run scripts with `bun run <script>` (one-off executions via `bun x`/`bunx`); never use `npm`, `npm run`, `npm ci`, or `npx` in this repo. The `package.json` scripts are unchanged — only the runner changes. The CI workflow still uses npm unless the owner asks to switch it.

## Commit Naming & Versioning (strict)

1. Every commit follows this versioning structure: `2.0.1`, `2.0.2`, ..., `2.0.9`, `2.0.10` ➔ rolls over to `2.1.0`; then `2.1.1`, ..., `2.1.10` ➔ rolls over to `2.2.0`, etc. The third number NEVER exceeds `.10`.
2. Format: `<version> - <short description>` (e.g., `2.0.1 - fix hero spacing`). Keep it short and clear.
3. **One version number per agent response / request batch** — not per issue, not per commit. A single owner request (even if it fixes many issues) consumes exactly ONE version number. Multiple commits inside one response are NOT allowed to each take a new number; if a follow-up fix is needed in the same batch, fold it into the same version's commit(s) — never burn a second number. Only a genuinely new owner request (a new response turn) advances the number.
4. Git history before this rule is unversioned; numbering starts at `2.0.0`. Every commit must also be logged in `COMMIT-HISTORY.md` (repo root) with its version and what it did, and the `📌 Next version` line at its top kept current.

## Order of Operations

1. Read the user's request.
2. Update files / write code / fix bugs as asked.
3. Commit and push significant changes (rule 4); optionally offer — in the response text — to run or test them.
4. Stop and wait for the user's acknowledgment before running anything.

## Scheduler & Vercel Hobby Constraint (read before touching scan cadence)

- This project is deployed on **Vercel Hobby**, which allows **daily cron only** (`0 0 * * *` in `vercel.json`).
- Production scans run at most **once per day**, regardless of the per-product `scanEveryHours` value. Never advertise or implement a 6-hour cadence while on Hobby; UI copy and defaults must reflect 24h until the plan is upgraded to Pro (then `0 */6 * * *` may be used and documented).
- Price history statistics must use genuine observations only (`direct` / `proxy` — see `OBSERVED_SOURCES` in `lib/analytics.ts`). Never reintroduce synthetic or generated price history; the generator and its data were removed in `2.0.2` (see `scripts/migrate-synthetic-history.mjs`).
