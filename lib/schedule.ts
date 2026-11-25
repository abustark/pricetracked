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

/**
 * Dispatcher due-slot policy (P0 scheduler fix).
 *
 * The cron fires on a fixed slot boundary (daily 00:00 UTC). Scheduling the
 * next scan from the wall-clock completion time ("completion + cadence")
 * drifts: a scan finishing at 00:00:05 is not due at the next day's 00:00
 * selection and can wait ~48 hours. Instead, every scan schedules its next
 * due time from the SLOT boundary the attempt happened in — the start of the
 * UTC day containing the attempt — so the product is always due at the next
 * dispatcher run regardless of when the scan actually finished. A manual
 * rescan mid-day also lands on the next dispatcher slot instead of silently
 * postponing the scheduled freshness by up to a full cadence.
 */
export function startOfDispatchSlot(date: Date): Date {
  const slot = new Date(date.getTime());
  slot.setUTCHours(0, 0, 0, 0);
  return slot;
}

/**
 * Next due time for a scan attempt that happens in the slot containing `now`:
 * the slot start plus the effective cadence. For the default 24h cadence this
 * is exactly the next dispatcher slot, so successive daily runs never skip a
 * product. For slower cadences (48h, 72h) it stays aligned to slot boundaries
 * and fires once every N dispatcher runs.
 */
export function nextDueSlot(now: Date, cadenceHours: number): Date {
  return new Date(startOfDispatchSlot(now).getTime() + cadenceHours * 60 * 60 * 1000);
}

/**
 * Per-viewer watchlist quota. Bounds unbounded guest product creation (a
 * fresh guest cookie is a viewer) and per-user scan work. Override with
 * MAX_PRODUCTS_PER_USER (capped at 100).
 */
export const DEFAULT_MAX_PRODUCTS_PER_USER = 20;
const MAX_PRODUCTS_PER_USER_CAP = 100;

export function getMaxProductsPerUser(): number {
  const raw = Number(process.env.MAX_PRODUCTS_PER_USER);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MAX_PRODUCTS_PER_USER;
  return Math.min(Math.floor(raw), MAX_PRODUCTS_PER_USER_CAP);
}

/**
 * Minimum interval between two manual scans of the same product. Prevents a
 * user (or a script) from hammering one product with rescans; scheduled
 * cron scans are unaffected. Override with SCAN_COOLDOWN_MS (0 disables).
 */
const DEFAULT_SCAN_COOLDOWN_MS = 10 * 60 * 1000;

export function getScanCooldownMs(): number {
  const raw = process.env.SCAN_COOLDOWN_MS;
  if (raw === undefined || raw === "") return DEFAULT_SCAN_COOLDOWN_MS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_SCAN_COOLDOWN_MS;
  return Math.min(value, 24 * 60 * 60 * 1000);
}
