/**
 * Single source of truth for scan cadence.
 *
 * `vercel.json` schedules `/api/cron/scan` once daily ("0 0 * * *") because this
 * project runs on Vercel Hobby, which allows daily cron only — see AGENTS.md
 * "Scheduler & Vercel Hobby Constraint". The per-product `scanEveryHours` value
 * can never trigger scans more often than the cron cadence, so the effective
 * cadence is the MAXIMUM of the product setting and the cron cadence. The UI
 * must always display the effective cadence, never the raw product setting.
 */
export const CRON_SCHEDULE = "0 0 * * *";
export const CRON_CADENCE_HOURS = 24;
export const DEFAULT_SCAN_EVERY_HOURS = 24;

/** Distributed scan lock lifetime. Must exceed the worst-case scan duration
 * (3 attempts x 18s fetch timeout + backoff) so a crashed worker's lock expires
 * on its own (stale-lock recovery). */
export const SCAN_LOCK_TTL_MINUTES = 5;

/** Respectful pause between scanning different products in one cron run. */
export const INTER_PRODUCT_DELAY_MS = 500;

/** Bounds a cron run's wall-clock work; keeps the function safely inside the
 * serverless duration limit. */
const DEFAULT_CRON_TIME_BUDGET_MS = 45_000;

/** Default batch size for one cron run (override with CRON_SCAN_LIMIT, max 50). */
const DEFAULT_CRON_SCAN_LIMIT = 10;
const MAX_CRON_SCAN_LIMIT = 50;

export function getCronScanLimit(): number {
  const raw = Number(process.env.CRON_SCAN_LIMIT);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_CRON_SCAN_LIMIT;
  return Math.min(Math.floor(raw), MAX_CRON_SCAN_LIMIT);
}

export function getCronTimeBudgetMs(): number {
  const raw = Number(process.env.CRON_TIME_BUDGET_MS);
  if (!Number.isFinite(raw) || raw < 1_000) return DEFAULT_CRON_TIME_BUDGET_MS;
  return Math.min(raw, 300_000);
}

/** Cadence actually delivered by the scheduler for a product — what the UI shows. */
export function getEffectiveScanEveryHours(scanEveryHours?: number): number {
  const configured = scanEveryHours && scanEveryHours > 0 ? scanEveryHours : DEFAULT_SCAN_EVERY_HOURS;
  return Math.max(configured, CRON_CADENCE_HOURS);
}
