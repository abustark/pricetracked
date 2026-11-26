import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({ getDb: getDbMock }));

import { productStatus, queryWatchlist, watchlistSummary } from "@/lib/watchlist";
import type { ProductDocument } from "@/lib/types";

const USER_ID = "user-1";

function makeProduct(overrides: Partial<ProductDocument> = {}): ProductDocument {
  return {
    _id: new ObjectId(),
    url: "https://example.com/item",
    normalizedUrl: "https://example.com/item",
    userId: USER_ID,
    store: "other",
    title: "Fixture",
    currency: "INR",
    active: true,
    scanEveryHours: 24,
    nextScanAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Minimal fake of the products collection's find(): applies the same
 * filter shape queryWatchlist builds (userId, store, $or title/url/urlRegex),
 * so the in-memory assertions below reflect real filtering behaviour.
 */
function fakeCollection(products: ProductDocument[]) {
  return {
    find: vi.fn((filter: Record<string, unknown>) => ({
      toArray: async () => {
        return products.filter((product) => {
          if (filter.userId !== undefined && product.userId !== filter.userId) return false;
          if (filter.store !== undefined && product.store !== filter.store) return false;
          const or = filter.$or as {
            title?: { $regex: string; $options?: string };
            url?: { $regex: string; $options?: string };
            normalizedUrl?: { $regex: string; $options?: string };
          }[] | undefined;
          if (or) {
            const first = or[0];
            const rule = first.title ?? first.url ?? first.normalizedUrl;
            if (rule) {
              const pattern = new RegExp(rule.$regex, rule.$options ?? "");
              const matches = or.some((entry) => {
                if (entry.title) return pattern.test(product.title);
                if (entry.url) return pattern.test(product.url);
                if (entry.normalizedUrl) return pattern.test(product.normalizedUrl);
                return false;
              });
              if (!matches) return false;
            }
          }
          return true;
        });
      }
    }))
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("productStatus", () => {
  const now = Date.now();
  const fresh = now - 1000;
  const stale = now - 48 * 60 * 60 * 1000; // past the 24h cadence

  it("returns paused when the rule is off, before any other signal", () => {
    expect(
      productStatus(
        makeProduct({ active: false, lastError: "boom", lastScannedAt: new Date(stale) }),
        now
      )
    ).toBe("paused");
  });

  it("returns error when the last scan failed", () => {
    expect(productStatus(makeProduct({ lastError: "boom", lastScannedAt: new Date(fresh) }), now)).toBe(
      "error"
    );
  });

  it("returns stale when there is no observation yet", () => {
    expect(productStatus(makeProduct({ lastScannedAt: undefined }), now)).toBe("stale");
  });

  it("returns stale once the effective cadence has passed", () => {
    expect(productStatus(makeProduct({ lastScannedAt: new Date(stale) }), now)).toBe("stale");
  });

  it("returns fresh within the effective cadence", () => {
    expect(productStatus(makeProduct({ lastScannedAt: new Date(fresh) }), now)).toBe("fresh");
  });
});

describe("queryWatchlist", () => {
  it("returns status-stamped products with total and sorted store list", async () => {
    const products = [
      makeProduct({ store: "amazon", title: "Alpha", lastScannedAt: new Date() }),
      makeProduct({ store: "flipkart", title: "Beta", lastScannedAt: new Date() })
    ];
    getDbMock.mockResolvedValue({ collection: () => fakeCollection(products) });

    const result = await queryWatchlist(USER_ID);

    expect(result.total).toBe(2);
    expect(result.products.map((p) => p.status)).toEqual(["fresh", "fresh"]);
    expect(result.stores).toEqual(["amazon", "flipkart"]);
  });

  it("filters by title via the search query with regex escaping", async () => {
    const products = [
      makeProduct({ title: "Wireless earbuds", lastScannedAt: new Date() }),
      makeProduct({ title: "USB cable", lastScannedAt: new Date() })
    ];
    const collection = fakeCollection(products);
    getDbMock.mockResolvedValue({ collection: () => collection });

    const result = await queryWatchlist(USER_ID, { q: "earbuds" });

    expect(result.total).toBe(1);
    expect(result.products[0].title).toBe("Wireless earbuds");
    // Regex metacharacters in the query are escaped, not interpreted.
    expect(collection.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([{ title: expect.objectContaining({ $regex: expect.any(String) }) }])
      })
    );
  });

  it("escapes regex metacharacters in the search query", async () => {
    const collection = fakeCollection([]);
    getDbMock.mockResolvedValue({ collection: () => collection });

    await queryWatchlist(USER_ID, { q: "a+b.c" });

    const filter = collection.find.mock.calls[0][0] as {
      $or?: { title: { $regex: string } }[];
    };
    const regex = filter.$or![0].title.$regex;
    expect(regex).toContain("\\+");
    expect(regex).toContain("\\.");
  });

  it("filters by store and status", async () => {
    const products = [
      makeProduct({ store: "amazon", title: "A", lastScannedAt: new Date() }),
      makeProduct({ store: "amazon", title: "B", active: false }),
      makeProduct({ store: "flipkart", title: "C", lastScannedAt: new Date() })
    ];
    getDbMock.mockResolvedValue({ collection: () => fakeCollection(products) });

    const byStore = await queryWatchlist(USER_ID, { store: "amazon" });
    expect(byStore.total).toBe(2);

    const paused = await queryWatchlist(USER_ID, { status: "paused" });
    expect(paused.total).toBe(1);
    expect(paused.products[0].title).toBe("B");

    const error = await queryWatchlist(USER_ID, { status: "error" });
    expect(error.total).toBe(0);
  });

  it("sorts by title, by target proximity, and by latest by default", async () => {
    const t1 = new Date("2024-01-01T00:00:00Z").getTime();
    const t2 = new Date("2024-01-02T00:00:00Z").getTime();
    const t3 = new Date("2024-01-03T00:00:00Z").getTime();
    const products = [
      makeProduct({ title: "Charlie", lastScannedAt: new Date(t1), targetPrice: 500, lastPrice: 400 }),
      makeProduct({ title: "Alpha", lastScannedAt: new Date(t2), targetPrice: 1000, lastPrice: 100 }),
      makeProduct({ title: "Bravo", lastScannedAt: new Date(t3) })
    ];
    getDbMock.mockResolvedValue({ collection: () => fakeCollection(products) });

    const byTitle = await queryWatchlist(USER_ID, { sort: "title" });
    expect(byTitle.products.map((p) => p.title)).toEqual(["Alpha", "Bravo", "Charlie"]);

    const byLatest = await queryWatchlist(USER_ID);
    expect(byLatest.products.map((p) => p.title)).toEqual(["Bravo", "Alpha", "Charlie"]);

    const byTarget = await queryWatchlist(USER_ID, { sort: "target" });
    // Bravo (no target) last; closest target first.
    expect(byTarget.products.map((p) => p.title)).toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  it("paginates with bounded limit", async () => {
    const products = Array.from({ length: 25 }, (_, i) =>
      makeProduct({ title: `Item ${i}`, lastScannedAt: new Date(Date.now() + i) })
    );
    getDbMock.mockResolvedValue({ collection: () => fakeCollection(products) });

    const page1 = await queryWatchlist(USER_ID, { page: 1, limit: 10 });
    expect(page1.products).toHaveLength(10);
    expect(page1.total).toBe(25);

    const page3 = await queryWatchlist(USER_ID, { page: 3, limit: 10 });
    expect(page3.products).toHaveLength(5);
  });
});

describe("watchlistSummary", () => {
  it("counts tracking, targets reached, and needs-attention", async () => {
    const products = [
      makeProduct({ title: "ok", targetPriceReached: true, lastScannedAt: new Date() }),
      makeProduct({ title: "reached", targetPriceReached: true, lastScannedAt: new Date() }),
      makeProduct({ title: "stale", lastScannedAt: new Date(Date.now() - 100 * 3600 * 1000) }),
      makeProduct({ title: "error", lastError: "boom", lastScannedAt: new Date() })
    ];
    getDbMock.mockResolvedValue({ collection: () => fakeCollection(products) });

    const summary = await watchlistSummary(USER_ID);

    expect(summary).toEqual({ tracking: 4, reached: 2, attention: 2 });
  });
});
