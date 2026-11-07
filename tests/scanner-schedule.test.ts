import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock
}));

import {
  buildDueProductFilter,
  claimProductScan,
  releaseScanLock,
  scanDueProducts
} from "@/lib/scanner";
import type { ProductDocument } from "@/lib/types";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function product(overrides: Partial<ProductDocument> = {}): ProductDocument {
  return {
    _id: new ObjectId(),
    url: "https://www.amazon.in/dp/B0DGJ9N27P",
    normalizedUrl: "https://www.amazon.in/dp/B0DGJ9N27P",
    userId: "user-1",
    store: "amazon",
    title: "Kindle",
    currency: "INR",
    active: true,
    scanEveryHours: 24,
    nextScanAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

beforeEach(() => {
  getDbMock.mockReset();
});

describe("buildDueProductFilter", () => {
  it("only selects active, due products with a real non-guest owner", () => {
    expect(buildDueProductFilter(NOW)).toEqual({
      active: true,
      nextScanAt: { $lte: NOW },
      userId: { $exists: true, $nin: ["", "guest"] }
    });
  });
});

describe("claimProductScan", () => {
  it("claims an unlocked due product and sets a five-minute lock", async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue(product());
    getDbMock.mockResolvedValue({ collection: () => ({ findOneAndUpdate }) });

    const claimed = await claimProductScan(new ObjectId(), NOW);

    expect(claimed).not.toBeNull();
    const [filter, update, options] = findOneAndUpdate.mock.calls[0];
    expect(filter.active).toBe(true);
    expect(filter.$or).toEqual(
      expect.arrayContaining([{ scanLockUntil: { $lte: NOW } }])
    );
    expect(update.$set.scanLockUntil.toISOString()).toBe("2026-01-01T00:05:00.000Z");
    expect(update.$set.lastAttemptAt).toBe(NOW);
    expect(options).toEqual({ returnDocument: "after" });
  });

  it("returns null when the product is already locked", async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue(undefined);
    getDbMock.mockResolvedValue({ collection: () => ({ findOneAndUpdate }) });

    const claimed = await claimProductScan(new ObjectId(), NOW);

    expect(claimed).toBeNull();
  });
});

describe("releaseScanLock", () => {
  it("clears the lock and resets the failure count on success", async () => {
    const updateOne = vi.fn().mockResolvedValue({});
    getDbMock.mockResolvedValue({ collection: () => ({ updateOne }) });

    const target = product({ failureCount: 2 });
    await releaseScanLock(target, { ok: true }, NOW);

    const [, update] = updateOne.mock.calls[0];
    expect(update.$unset).toEqual({ scanLockUntil: "", scanStartedAt: "" });
    expect(update.$set).toEqual({ failureCount: 0, updatedAt: NOW });
  });

  it("records a failure and backs off using the effective cadence", async () => {
    const updateOne = vi.fn().mockResolvedValue({});
    getDbMock.mockResolvedValue({ collection: () => ({ updateOne }) });

    // A 6h product setting can never deliver faster than the daily cron.
    const target = product({ failureCount: 1, scanEveryHours: 6 });
    await releaseScanLock(target, { ok: false, error: "blocked" }, NOW);

    const [, update] = updateOne.mock.calls[0];
    expect(update.$set.lastError).toBe("blocked");
    expect(update.$set.failureCount).toBe(2);
    expect(update.$set.nextScanAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(update.$set.lastAttemptAt).toBe(NOW);
  });

  it("never erases the last valid price on failure", async () => {
    const updateOne = vi.fn().mockResolvedValue({});
    getDbMock.mockResolvedValue({ collection: () => ({ updateOne }) });

    await releaseScanLock(product({ lastPrice: 1499 }), { ok: false, error: "x" }, NOW);

    const [, update] = updateOne.mock.calls[0];
    expect(update.$set.lastPrice).toBeUndefined();
  });

  it("does nothing for a product without an id", async () => {
    const updateOne = vi.fn();
    getDbMock.mockResolvedValue({ collection: () => ({ updateOne }) });

    await releaseScanLock(product({ _id: undefined }), { ok: true }, NOW);

    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe("scanDueProducts", () => {
  it("skips a product that another worker already claimed", async () => {
    const dueProduct = product();
    const toArray = vi.fn().mockResolvedValue([dueProduct]);
    const chain = {
      sort: vi.fn(),
      limit: vi.fn(),
      toArray
    };
    chain.sort.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    const findOneAndUpdate = vi.fn().mockResolvedValue(null);
    getDbMock.mockResolvedValue({
      collection: () => ({ find: () => chain, findOneAndUpdate })
    });

    const results = await scanDueProducts(5);

    expect(results).toEqual([{ id: dueProduct._id!.toString(), ok: false, skipped: "locked" }]);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
