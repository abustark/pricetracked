import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CRON_CADENCE_HOURS,
  DEFAULT_SCAN_EVERY_HOURS,
  getCronScanLimit,
  getCronTimeBudgetMs,
  getEffectiveScanEveryHours
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
