import { describe, expect, it } from "vitest";
import { timeScaleX } from "@/lib/chart-scale";

const WIDTH = 720;
const PADDING = 34;

describe("timeScaleX", () => {
  it("returns an empty array for no points", () => {
    expect(timeScaleX([], WIDTH, PADDING)).toEqual([]);
  });

  it("centres a single point", () => {
    expect(timeScaleX([1_000_000], WIDTH, PADDING)).toEqual([WIDTH / 2]);
  });

  it("maps elapsed time proportionally to horizontal distance", () => {
    const oneHourMs = 60 * 60 * 1000;
    const oneDayMs = 24 * oneHourMs;
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const fullPlot = WIDTH - PADDING * 2;

    // Within a fixed one-day span, a one-hour interval occupies 1/24 of the
    // plot — index-based spacing would have made every interval equal.
    const xs = timeScaleX([start, start + oneHourMs, start + oneDayMs], WIDTH, PADDING);

    expect(xs[0]).toBe(PADDING);
    expect(xs[1] - xs[0]).toBeCloseTo((oneHourMs / oneDayMs) * fullPlot, 1);
    expect(xs[2] - xs[1]).toBeCloseTo(((oneDayMs - oneHourMs) / oneDayMs) * fullPlot, 1);
  });

  it("keeps gaps visible instead of compressing them to index spacing", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const day = 24 * 60 * 60 * 1000;
    const xs = timeScaleX([start, start + day, start + day + 60_000], WIDTH, PADDING);

    // The 1-minute gap after the day-long gap stays tiny on the axis.
    expect(xs[2] - xs[1]).toBeLessThan(1);
  });

  it("handles identical timestamps without producing NaN", () => {
    const xs = timeScaleX([1_000, 1_000, 1_000], WIDTH, PADDING);
    expect(xs.every((x) => Number.isFinite(x))).toBe(true);
  });
});
