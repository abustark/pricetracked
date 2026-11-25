import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock
}));

import { HISTORY_WINDOW_LIMIT, getFullRangeSummary, getLatestSamples } from "@/lib/history";
import { makeSample } from "./fixtures";

const PRODUCT_ID = new ObjectId();

type FindCall = { filter: Record<string, unknown>; sort: Record<string, number>; limit: number };

function makeDb(findQueue: Record<string, unknown>[][], countResult: number) {
  const findCalls: FindCall[] = [];
  const collection = vi.fn(() => ({
    find: vi.fn((filter: Record<string, unknown>) => {
      const chain: {
        sort: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        toArray: ReturnType<typeof vi.fn>;
        sortSpec?: Record<string, number>;
        limitN?: number;
      } = {
        sort: vi.fn((sortSpec: Record<string, number>) => {
          chain.sortSpec = sortSpec;
          return chain;
        }),
        limit: vi.fn((limitN: number) => {
          chain.limitN = limitN;
          return chain;
        }),
        toArray: vi.fn(async () => {
          findCalls.push({ filter, sort: chain.sortSpec ?? {}, limit: chain.limitN ?? 0 });
          return findQueue.shift() ?? [];
        })
      };
      return chain;
    }),
    countDocuments: vi.fn(async () => countResult)
  }));
  return { db: { collection }, findCalls };
}

describe("getLatestSamples", () => {
  it("selects the newest observations first and returns them chronological", async () => {
    const newest = makeSample(100, { day: 10 });
    const oldest = makeSample(90, { day: 1 });
    const { db, findCalls } = makeDb([[newest, oldest]], 2);
    getDbMock.mockResolvedValue(db);

    const samples = await getLatestSamples(PRODUCT_ID);

    expect(samples.map((sample) => sample.price)).toEqual([90, 100]);
    expect(findCalls[0].sort).toEqual({ capturedAt: -1 });
    expect(findCalls[0].limit).toBe(HISTORY_WINDOW_LIMIT);
    expect(findCalls[0].filter).toEqual({
      productId: PRODUCT_ID,
      source: { $in: ["direct", "proxy"] }
    });
  });

  it("caps the window at 1000 samples so the newest data is never excluded", async () => {
    // Regression: sorting ascending + limit(1000) returned the earliest
    // thousand once history exceeded 1,000 observations.
    // Queued newest-first, exactly as the descending sort would return it.
    const newestFirst = Array.from({ length: 1000 }, (_, index) =>
      makeSample(1999 - index, { day: 1099 - index })
    );
    const { db, findCalls } = makeDb([newestFirst], 1000);
    getDbMock.mockResolvedValue(db);

    const samples = await getLatestSamples(PRODUCT_ID);

    expect(samples).toHaveLength(1000);
    expect(samples[0].price).toBe(1000); // chronological after reverse
    expect(samples[samples.length - 1].price).toBe(1999); // newest retained
    expect(findCalls[0].limit).toBe(1000);
    expect(findCalls[0].sort).toEqual({ capturedAt: -1 });
  });
});

describe("getFullRangeSummary", () => {
  it("aggregates count and extrema across the full observed history", async () => {
    const lowest = makeSample(8999, { day: 1 });
    const highest = makeSample(10999, { day: 30 });
    const { db, findCalls } = makeDb([[lowest], [highest]], 1500);
    getDbMock.mockResolvedValue(db);

    const summary = await getFullRangeSummary(PRODUCT_ID);

    expect(summary.sampleCount).toBe(1500);
    expect(summary.lowest?.price).toBe(8999);
    expect(summary.highest?.price).toBe(10999);
    // Lowest lookup sorts ascending, highest descending, both capped at 1.
    expect(findCalls[0].sort).toEqual({ price: 1, capturedAt: 1 });
    expect(findCalls[0].limit).toBe(1);
    expect(findCalls[1].sort).toEqual({ price: -1, capturedAt: -1 });
    expect(findCalls[1].limit).toBe(1);
  });

  it("returns an empty summary when the product has no observations", async () => {
    const { db } = makeDb([[], []], 0);
    getDbMock.mockResolvedValue(db);

    const summary = await getFullRangeSummary(PRODUCT_ID);

    expect(summary).toEqual({ sampleCount: 0 });
  });
});
