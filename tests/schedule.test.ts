import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CRON_CADENCE_HOURS,
  DEFAULT_SCAN_EVERY_HOURS,
  getCronScanLimit,
  getCronTimeBudgetMs,
  getEffectiveScanEveryHours,
  getMaxProductsPerUser,
  getScanCooldownMs,
  nextDueSlot,
  startOfDispatchSlot
} from "@/lib/schedule";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("scheduler cadence", () => {
  it("never advertises a cadence faster than the daily cron", () => {
    expect(CRON_CADENCE_HOURS).toBe(24);
    expect(DEFAULT_SCAN_EVERY_HOURS).toBe(24);
    expect(getEffectiveScanEveryHours(6)).toBe(24);
    expect(getEffectiveScanEveryHours(undefined)).toBe(24);
    expect(getEffectiveScanEveryHours(0)).toBe(24);
    expect(getEffectiveScanEveryHours(-4)).toBe(24);
  });

  it("honours a slower per-product cadence", () => {
    expect(getEffectiveScanEveryHours(48)).toBe(48);
    expect(getEffectiveScanEveryHours(72)).toBe(72);
  });
});

describe("cron batch limits", () => {
  it("defaults to a bounded batch", () => {
    vi.stubEnv("CRON_SCAN_LIMIT", "");
    expect(getCronScanLimit()).toBe(10);
  });

  it("accepts a configured batch and clamps it to 50", () => {
    vi.stubEnv("CRON_SCAN_LIMIT", "25");
    expect(getCronScanLimit()).toBe(25);

    vi.stubEnv("CRON_SCAN_LIMIT", "999");
    expect(getCronScanLimit()).toBe(50);
  });

  it("ignores non-numeric or non-positive batch limits", () => {
    vi.stubEnv("CRON_SCAN_LIMIT", "0");
    expect(getCronScanLimit()).toBe(10);

    vi.stubEnv("CRON_SCAN_LIMIT", "many");
    expect(getCronScanLimit()).toBe(10);
  });

  it("keeps the wall-clock budget between 1s and 5min", () => {
    vi.stubEnv("CRON_TIME_BUDGET_MS", "");
    expect(getCronTimeBudgetMs()).toBe(45_000);

    vi.stubEnv("CRON_TIME_BUDGET_MS", "2000");
    expect(getCronTimeBudgetMs()).toBe(2000);

    vi.stubEnv("CRON_TIME_BUDGET_MS", "500");
    expect(getCronTimeBudgetMs()).toBe(45_000);

    vi.stubEnv("CRON_TIME_BUDGET_MS", "999999");
    expect(getCronTimeBudgetMs()).toBe(300_000);
  });
});

describe("dispatcher due-slot policy", () => {
  it("starts a slot at the UTC day boundary", () => {
    expect(startOfDispatchSlot(new Date("2026-01-01T00:00:05.000Z")).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z"
    );
    expect(startOfDispatchSlot(new Date("2026-01-01T14:30:00.000Z")).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });

  it("schedules the next due time on the dispatcher slot, not completion + 24h", () => {
    // The P0 regression: a scan finishing at 00:00:05 must be due at the next
    // daily run (24h later at the slot), never pushed to ~48h later.
    expect(nextDueSlot(new Date("2026-01-01T00:00:05.000Z"), 24).toISOString()).toBe(
      "2026-01-02T00:00:00.000Z"
    );
    expect(nextDueSlot(new Date("2026-01-01T23:59:59.000Z"), 24).toISOString()).toBe(
      "2026-01-02T00:00:00.000Z"
    );
  });

  it("aligns a mid-day scan to the next dispatcher slot instead of drifting", () => {
    // A manual rescan at 14:00 must stay due for the next daily run, not wait
    // until 14:00 the following day (which would silently skip that run).
    expect(nextDueSlot(new Date("2026-01-01T14:00:00.000Z"), 24).toISOString()).toBe(
      "2026-01-02T00:00:00.000Z"
    );
  });

  it("keeps slower cadences aligned to slot boundaries", () => {
    expect(nextDueSlot(new Date("2026-01-01T00:00:05.000Z"), 48).toISOString()).toBe(
      "2026-01-03T00:00:00.000Z"
    );
    expect(nextDueSlot(new Date("2026-01-01T09:00:00.000Z"), 72).toISOString()).toBe(
      "2026-01-04T00:00:00.000Z"
    );
  });
});

describe("scan policy limits", () => {
  it("defaults the per-viewer product quota and clamps overrides", () => {
    vi.stubEnv("MAX_PRODUCTS_PER_USER", "");
    expect(getMaxProductsPerUser()).toBe(20);

    vi.stubEnv("MAX_PRODUCTS_PER_USER", "5");
    expect(getMaxProductsPerUser()).toBe(5);

    vi.stubEnv("MAX_PRODUCTS_PER_USER", "500");
    expect(getMaxProductsPerUser()).toBe(100);

    vi.stubEnv("MAX_PRODUCTS_PER_USER", "0");
    expect(getMaxProductsPerUser()).toBe(20);
  });

  it("defaults the manual-scan cooldown and clamps overrides", () => {
    vi.stubEnv("SCAN_COOLDOWN_MS", "");
    expect(getScanCooldownMs()).toBe(10 * 60 * 1000);

    vi.stubEnv("SCAN_COOLDOWN_MS", "60000");
    expect(getScanCooldownMs()).toBe(60_000);

    vi.stubEnv("SCAN_COOLDOWN_MS", "0");
    expect(getScanCooldownMs()).toBe(0); // explicit zero disables the cooldown

    vi.stubEnv("SCAN_COOLDOWN_MS", "999999999");
    expect(getScanCooldownMs()).toBe(24 * 60 * 60 * 1000);
  });
});
