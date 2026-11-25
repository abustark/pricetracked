import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock
}));

vi.mock("@/lib/url-guard", () => ({
  assertSafeFetchTarget: vi.fn(async () => undefined)
}));

import { scanAndSaveProduct } from "@/lib/scanner";
import { htmlResponse } from "./fixtures";

const PRODUCT_URL = "https://www.amazon.in/dp/B0DGJ9N27P";
const BELOW_TARGET_HTML = `<html><head><script type="application/ld+json">
  {"@type":"Product","name":"Phone","sku":"B0DGJ9N27P","offers":{"@type":"Offer","price":"900","priceCurrency":"INR","availability":"https://schema.org/InStock"}}
</script></head><body></body></html>`;

const fetchMock = vi.fn();

function existingProduct() {
  return {
    _id: new ObjectId(),
    url: PRODUCT_URL,
    normalizedUrl: PRODUCT_URL,
    userId: "user-1",
    store: "amazon",
    title: "Phone",
    currency: "INR",
    active: true,
    scanEveryHours: 24,
    nextScanAt: new Date(),
    targetPrice: 1000,
    targetPriceReached: false,
    targetAlertEnabled: true,
    lastPrice: 2000,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function dbMockForCrossing(alertInsert: ReturnType<typeof vi.fn>) {
  const updateOne = vi.fn().mockResolvedValue({});
  const insertOne = vi.fn().mockResolvedValue({});
  getDbMock.mockResolvedValue({
    collection: (name: string) => {
      if (name === "products") {
        return { findOne: vi.fn().mockResolvedValue(existingProduct()), updateOne };
      }
      if (name === "price_samples") {
        return { insertOne };
      }
      if (name === "alert_events") {
        return { insertOne: alertInsert };
      }
      return { findOne: vi.fn(), updateOne, insertOne };
    }
  });
  return { updateOne, insertOne };
}

beforeEach(() => {
  getDbMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("alert durability across scans", () => {
  it("advances the reached state only after the alert event is recorded", async () => {
    const alertInsert = vi.fn().mockResolvedValue({});
    const { updateOne } = dbMockForCrossing(alertInsert);
    fetchMock.mockResolvedValue(htmlResponse(BELOW_TARGET_HTML));

    const result = await scanAndSaveProduct(PRODUCT_URL, "user-1");

    expect(alertInsert).toHaveBeenCalledTimes(1);
    expect(result.targetPriceReached).toBe(true);
    expect(updateOne.mock.calls[0][1].$set.targetPriceReached).toBe(true);
  });

  it("holds the reached state back when the alert insert fails, so the crossing retries", async () => {
    // First scan: the alert write fails. The event must not be lost — the
    // reached state stays false so the next scan retries the crossing.
    const alertInsert = vi.fn().mockRejectedValue(new Error("db down"));
    const { updateOne } = dbMockForCrossing(alertInsert);
    fetchMock.mockResolvedValue(htmlResponse(BELOW_TARGET_HTML));

    const first = await scanAndSaveProduct(PRODUCT_URL, "user-1");

    expect(alertInsert).toHaveBeenCalledTimes(1);
    expect(first.targetPriceReached).toBe(false);
    expect(updateOne.mock.calls[0][1].$set.targetPriceReached).toBe(false);

    // Second scan (next day): the alert insert succeeds — exactly one event,
    // and the reached state now advances.
    const retryAlertInsert = vi.fn().mockResolvedValue({});
    const retryUpdateOne = vi.fn().mockResolvedValue({});
    const retryExisting = existingProduct();
    retryExisting.targetPriceReached = false; // still not reached
    getDbMock.mockResolvedValue({
      collection: (name: string) => {
        if (name === "products") {
          return { findOne: vi.fn().mockResolvedValue(retryExisting), updateOne: retryUpdateOne };
        }
        if (name === "price_samples") {
          return { insertOne: vi.fn().mockResolvedValue({}) };
        }
        return { insertOne: retryAlertInsert };
      }
    });
    fetchMock.mockResolvedValue(htmlResponse(BELOW_TARGET_HTML));

    const second = await scanAndSaveProduct(PRODUCT_URL, "user-1");

    expect(retryAlertInsert).toHaveBeenCalledTimes(1);
    expect(second.targetPriceReached).toBe(true);
  });
});
