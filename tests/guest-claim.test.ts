import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, authMock, cookiesMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  authMock: vi.fn(),
  cookiesMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({ getDb: getDbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import {
  CLAIM_PENDING_COOKIE,
  CLAIM_STATUS_COOKIE,
  GUEST_COOKIE,
  claimGuestProducts,
  getViewer
} from "@/lib/viewer";
import type { ProductDocument } from "@/lib/types";

const GUEST_ID = "3f9c1a2b-1234-4abc-9def-0123456789ab";
const ACCOUNT_ID = "108231234567890123456";

function makeProduct(overrides: Partial<ProductDocument> = {}): ProductDocument {
  return {
    _id: new ObjectId(),
    url: "https://example.com/item",
    normalizedUrl: "https://example.com/item",
    userId: GUEST_ID,
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

function matches(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => doc[key] === value);
}

function makeFakeDb() {
  const products: (ProductDocument & Record<string, unknown>)[] = [];
  const samples: (Record<string, unknown> & { _id: ObjectId })[] = [];

  const productsCollection = {
    // The real driver returns a cursor synchronously; the code calls
    // .toArray() without awaiting find().
    find: vi.fn((filter: Record<string, unknown>) => ({
      toArray: async () => products.filter((p) => matches(p as never, filter))
    })),
    findOne: vi.fn(async (filter: Record<string, unknown>) =>
      products.find((p) => matches(p as never, filter)) ?? null
    ),
    findOneAndUpdate: vi.fn(async (filter: Record<string, unknown>, update: { $set?: Record<string, unknown> }) => {
      const doc = products.find((p) => matches(p as never, filter));
      if (!doc) return null;
      Object.assign(doc, update.$set ?? {});
      return { ...doc };
    }),
    updateOne: vi.fn(async (filter: Record<string, unknown>, update: { $set?: Record<string, unknown> }) => {
      const doc = products.find((p) => matches(p as never, filter));
      if (doc) Object.assign(doc, update.$set ?? {});
      return { matchedCount: doc ? 1 : 0 };
    }),
    deleteOne: vi.fn(async (filter: Record<string, unknown>) => {
      const index = products.findIndex((p) => matches(p as never, filter));
      if (index >= 0) {
        products.splice(index, 1);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    })
  };

  const samplesCollection = {
    updateMany: vi.fn(async (filter: Record<string, unknown>, update: { $set?: Record<string, unknown> }) => {
      let count = 0;
      for (const sample of samples) {
        if (matches(sample, filter)) {
          Object.assign(sample, update.$set ?? {});
          count += 1;
        }
      }
      return { matchedCount: count, modifiedCount: count };
    })
  };

  const db = {
    collection: vi.fn((name: string) =>
      name === "products" ? productsCollection : samplesCollection
    )
  };

  return { db, products, samples, productsCollection, samplesCollection };
}

beforeEach(() => {
  getDbMock.mockReset();
  authMock.mockReset();
  cookiesMock.mockReset();
});

describe("claimGuestProducts", () => {
  it("moves guest products into the account", async () => {
    const fake = makeFakeDb();
    getDbMock.mockResolvedValue(fake.db);
    fake.products.push(
      makeProduct({ _id: new ObjectId(), normalizedUrl: "https://a.example/1", url: "https://a.example/1" }),
      makeProduct({ _id: new ObjectId(), normalizedUrl: "https://b.example/2", url: "https://b.example/2" })
    );

    const result = await claimGuestProducts(ACCOUNT_ID, GUEST_ID);

    expect(result).toEqual({ status: "saved", claimed: 2, merged: 0 });
    expect(fake.products.every((p) => p.userId === ACCOUNT_ID)).toBe(true);
  });

  it("merges products the account already tracks, re-pointing samples", async () => {
    const fake = makeFakeDb();
    getDbMock.mockResolvedValue(fake.db);
    const guestProduct = makeProduct({ normalizedUrl: "https://a.example/1", url: "https://a.example/1" });
    const accountProduct = makeProduct({ userId: ACCOUNT_ID, normalizedUrl: "https://a.example/1" });
    fake.products.push(guestProduct, accountProduct);
    fake.samples.push({ _id: new ObjectId(), productId: guestProduct._id, price: 100 });

    const result = await claimGuestProducts(ACCOUNT_ID, GUEST_ID);

    expect(result).toEqual({ status: "saved", claimed: 0, merged: 1 });
    expect(fake.samples[0].productId).toBe(accountProduct._id);
    expect(fake.products.find((p) => p.userId === GUEST_ID)).toBeUndefined();
  });

  it("is idempotent across repeated runs", async () => {
    const fake = makeFakeDb();
    getDbMock.mockResolvedValue(fake.db);
    fake.products.push(makeProduct({ normalizedUrl: "https://a.example/1", url: "https://a.example/1" }));

    const first = await claimGuestProducts(ACCOUNT_ID, GUEST_ID);
    expect(first).toEqual({ status: "saved", claimed: 1, merged: 0 });

    // Second run: the guest collection is empty, nothing is re-moved.
    const second = await claimGuestProducts(ACCOUNT_ID, GUEST_ID);
    expect(second).toEqual({ status: "saved", claimed: 0, merged: 0 });
    expect(fake.products).toHaveLength(1);
  });

  it("skips products already claimed concurrently", async () => {
    const fake = makeFakeDb();
    getDbMock.mockResolvedValue(fake.db);
    fake.products.push(
      makeProduct({ _id: new ObjectId(), normalizedUrl: "https://a.example/1", url: "https://a.example/1" }),
      makeProduct({ _id: new ObjectId(), normalizedUrl: "https://b.example/2", url: "https://b.example/2" })
    );
    // One product's atomic claim loses the race (returns null) — the other
    // still claims normally.
    fake.productsCollection.findOneAndUpdate.mockImplementationOnce(async () => null);

    const result = await claimGuestProducts(ACCOUNT_ID, GUEST_ID);

    expect(result).toEqual({ status: "saved", claimed: 1, merged: 0 });
  });

  it("treats a duplicate-key claim as a merge", async () => {
    const fake = makeFakeDb();
    getDbMock.mockResolvedValue(fake.db);
    fake.products.push(makeProduct({ normalizedUrl: "https://a.example/1", url: "https://a.example/1" }));
    fake.productsCollection.findOneAndUpdate.mockImplementationOnce(async () => {
      const error = new Error("duplicate key");
      (error as { code?: number }).code = 11000;
      throw error;
    });

    const result = await claimGuestProducts(ACCOUNT_ID, GUEST_ID);

    expect(result).toEqual({ status: "saved", claimed: 0, merged: 1 });
  });

  it("reports a real failure instead of silently returning zero", async () => {
    getDbMock.mockRejectedValue(new Error("database unreachable"));

    const result = await claimGuestProducts(ACCOUNT_ID, GUEST_ID);

    expect(result.status).toBe("failed");
    expect(result.claimed).toBe(0);
    expect(result.merged).toBe(0);
    expect(result.error).toBe("database unreachable");
  });

  it("reports saved with zero counts when there is no guest id", async () => {
    const result = await claimGuestProducts(ACCOUNT_ID, undefined);

    expect(result).toEqual({ status: "saved", claimed: 0, merged: 0 });
    expect(getDbMock).not.toHaveBeenCalled();
  });
});

describe("getViewer claim status", () => {
  function mockCookies(store: Record<string, string>) {
    cookiesMock.mockImplementation(async () => ({
      get: (name: string) =>
        store[name] ? { name, value: store[name] } : undefined
    }));
  }

  it("never mutates the database during reads", async () => {
    authMock.mockResolvedValue({ user: { id: ACCOUNT_ID } });
    mockCookies({ [GUEST_COOKIE]: GUEST_ID, [CLAIM_PENDING_COOKIE]: "1" });

    const viewer = await getViewer();

    expect(viewer.signedIn).toBe(true);
    expect(viewer.userId).toBe(ACCOUNT_ID);
    expect(viewer.guestId).toBe(GUEST_ID);
    expect(viewer.claimPending).toBe(true);
    expect(viewer.claim.status).toBe("none");
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("reads a saved claim status from the status cookie", async () => {
    authMock.mockResolvedValue({ user: { id: ACCOUNT_ID } });
    mockCookies({ [CLAIM_STATUS_COOKIE]: "saved:3" });

    const viewer = await getViewer();

    expect(viewer.claim).toEqual({ status: "saved", claimedCount: 3 });
    expect(viewer.claimPending).toBe(false);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("reads a failed claim status with an honest message", async () => {
    authMock.mockResolvedValue({ user: { id: ACCOUNT_ID } });
    mockCookies({ [CLAIM_STATUS_COOKIE]: "failed" });

    const viewer = await getViewer();

    expect(viewer.claim.status).toBe("failed");
    expect(viewer.claim.message).toBeTruthy();
    expect(viewer.claimPending).toBe(false);
  });

  it("does not signal a pending claim once a status exists", async () => {
    authMock.mockResolvedValue({ user: { id: ACCOUNT_ID } });
    mockCookies({ [GUEST_COOKIE]: GUEST_ID, [CLAIM_PENDING_COOKIE]: "1", [CLAIM_STATUS_COOKIE]: "saved:1" });

    const viewer = await getViewer();

    expect(viewer.claimPending).toBe(false);
  });

  it("has nothing pending for a signed-out visitor", async () => {
    authMock.mockResolvedValue(null);
    mockCookies({});

    const viewer = await getViewer();

    expect(viewer.signedIn).toBe(false);
    expect(viewer.claimPending).toBe(false);
    expect(viewer.claim.status).toBe("none");
    expect(getDbMock).not.toHaveBeenCalled();
  });
});
