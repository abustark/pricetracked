import { describe, expect, it } from "vitest";
import { calculatePriceStats, isObservedSample, selectObservedSamples } from "@/lib/analytics";
import { makeSample } from "./fixtures";

describe("price analytics", () => {
  it("returns an empty baseline when there is no history", () => {
    const stats = calculatePriceStats([]);

    expect(stats.sampleCount).toBe(0);
    expect(stats.current).toBeUndefined();
    expect(stats.highest).toBeUndefined();
    expect(stats.changes.description).toBe("No price history yet");
  });

  it("treats a single genuine sample as a baseline, not a trend", () => {
    const stats = calculatePriceStats([makeSample(1000, { day: 1 })]);

    expect(stats.sampleCount).toBe(1);
    expect(stats.highest?.price).toBe(1000);
    expect(stats.lowest?.price).toBe(1000);
    expect(stats.advice?.verdict).toBe("fair_price");
    expect(stats.advice?.headline).toBe("Gathering Baseline");
  });

  it("counts no change when the price repeats", () => {
    const stats = calculatePriceStats([
      makeSample(1000, { day: 1 }),
      makeSample(1000, { day: 2 })
    ]);

    expect(stats.changes.count).toBe(0);
    expect(stats.changes.description).toBe("No price changes observed yet");
    expect(stats.common?.price).toBe(1000);
    expect(stats.common?.occurrences).toBe(2);
    expect(stats.common?.percentage).toBe(100);
  });

  it("detects a rising price", () => {
    const stats = calculatePriceStats([
      makeSample(1000, { day: 1 }),
      makeSample(1200, { day: 2 })
    ]);

    expect(stats.current?.price).toBe(1200);
    expect(stats.highest?.price).toBe(1200);
    expect(stats.changes.count).toBe(1);
    expect(stats.advice?.recentTrend).toBe("rising");
  });

  it("detects a falling price and an all-time low", () => {
    const stats = calculatePriceStats([
      makeSample(1000, { day: 1 }),
      makeSample(800, { day: 2 })
    ]);

    expect(stats.current?.price).toBe(800);
    expect(stats.lowest?.price).toBe(800);
    expect(stats.advice?.recentTrend).toBe("falling");
    expect(stats.advice?.verdict).toBe("buy_now");
  });

  it("picks the cheapest price when counts tie for the common price", () => {
    const stats = calculatePriceStats([
      makeSample(1000, { day: 1 }),
      makeSample(1000, { day: 2 }),
      makeSample(1200, { day: 3 })
    ]);

    // Tie-break: highest occurrence count, then lowest price.
    expect(stats.common?.price).toBe(1000);
    expect(stats.common?.occurrences).toBe(2);
    expect(stats.common?.percentage).toBe(67);
  });

  it("rejects mixed currencies instead of averaging them", () => {
    const mixed = [
      makeSample(1000, { day: 1, currency: "INR" }),
      makeSample(20, { day: 2, currency: "USD" })
    ];

    const selected = selectObservedSamples(mixed);
    expect(selected).toHaveLength(1);
    expect(selected[0].currency).toBe("USD");

    const stats = calculatePriceStats(mixed);
    expect(stats.sampleCount).toBe(1);
    expect(stats.current?.price).toBe(20);
  });

  it("excludes legacy synthetic provenance from every calculation", () => {
    const samples = [
      makeSample(1000, { day: 1, source: "direct" }),
      makeSample(500, { day: 2, source: "proxy" }),
      makeSample(200, { day: 3, source: "historical" }),
      makeSample(100, { day: 4, source: "mrp-baseline" })
    ];

    expect(isObservedSample(makeSample(1, { source: "historical" }))).toBe(false);
    expect(isObservedSample(makeSample(1, { source: "mrp-baseline" }))).toBe(false);
    expect(isObservedSample(makeSample(1, { source: "direct" }))).toBe(true);
    expect(isObservedSample(makeSample(1, { source: "proxy" }))).toBe(true);

    const stats = calculatePriceStats(samples);
    expect(stats.sampleCount).toBe(2);
    expect(stats.lowest?.price).toBe(500);
    expect(stats.current?.price).toBe(500);
  });

  it("computes savings against a genuine MRP higher than the current price", () => {
    const stats = calculatePriceStats([makeSample(1000, { day: 1 })], 2000);

    expect(stats.mrp).toBe(2000);
    expect(stats.savings).toEqual({ amount: 1000, percentage: 50 });
  });
});
