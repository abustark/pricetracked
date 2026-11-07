import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock
}));

import {
  createAlertEvent,
  deleteAlertEventsForProduct,
  dismissAlert,
  loadAlertEvents,
  markAlertsRead
} from "@/lib/alerts";

const GUEST_ID = "3f9c1a2b-1234-4abc-9def-0123456789ab";
const ACCOUNT_ID = "108231234567890123456";

function alertEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(),
    productId: new ObjectId(),
    userId: ACCOUNT_ID,
    target: 1000,
    observedPrice: 950,
    currency: "INR",
    observedAt: new Date("2026-01-02T00:00:00.000Z"),
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides
  };
}

beforeEach(() => {
  getDbMock.mockReset();
});

describe("createAlertEvent", () => {
  it("never stores events for guests", async () => {
    await createAlertEvent({
      productId: new ObjectId(),
      userId: GUEST_ID,
      target: 1000,
      observedPrice: 900,
      currency: "INR",
      observedAt: new Date()
    });

    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("never stores events without an owner", async () => {
    await createAlertEvent({
      productId: new ObjectId(),
      userId: undefined,
      target: 1000,
      observedPrice: 900,
      currency: "INR",
      observedAt: new Date()
    });

    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("stores a crossing for a signed-in account", async () => {
    const insertOne = vi.fn().mockResolvedValue({});
    getDbMock.mockResolvedValue({ collection: () => ({ insertOne }) });

    const productId = new ObjectId();
    const observedAt = new Date("2026-01-02T00:00:00.000Z");
    await createAlertEvent({
      productId,
      userId: ACCOUNT_ID,
      target: 1000,
      observedPrice: 900,
      currency: "INR",
      observedAt
    });

    expect(insertOne).toHaveBeenCalledTimes(1);
    const event = insertOne.mock.calls[0][0];
    expect(event.productId).toBe(productId);
    expect(event.userId).toBe(ACCOUNT_ID);
    expect(event.observedPrice).toBe(900);
    expect(event.observedAt).toBe(observedAt);
  });

  it("swallows duplicate-key writes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const insertOne = vi.fn().mockRejectedValue({ code: 11000 });
    getDbMock.mockResolvedValue({ collection: () => ({ insertOne }) });

    await expect(
      createAlertEvent({
        productId: new ObjectId(),
        userId: ACCOUNT_ID,
        target: 1000,
        observedPrice: 900,
        currency: "INR",
        observedAt: new Date()
      })
    ).resolves.toBeUndefined();

    expect(warn).not.toHaveBeenCalled();
  });

  it("never fails the scan on an alert write error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const insertOne = vi.fn().mockRejectedValue({ code: 42 });
    getDbMock.mockResolvedValue({ collection: () => ({ insertOne }) });

    await expect(
      createAlertEvent({
        productId: new ObjectId(),
        userId: ACCOUNT_ID,
        target: 1000,
        observedPrice: 900,
        currency: "INR",
        observedAt: new Date()
      })
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("[alerts] alert event insert failed", 42);
  });
});

describe("loadAlertEvents", () => {
  it("maps events to client views with product metadata", async () => {
    const event = alertEvent();
    const products = [
      { _id: event.productId, title: "Kindle", storeLabel: "Amazon" }
    ];
    const eventChain = {
      sort: vi.fn(),
      limit: vi.fn(),
      toArray: vi.fn().mockResolvedValue([event])
    };
    eventChain.sort.mockReturnValue(eventChain);
    eventChain.limit.mockReturnValue(eventChain);
    const productChain = {
      project: () => ({ toArray: vi.fn().mockResolvedValue(products) })
    };

    getDbMock.mockResolvedValue({
      collection: (name: string) =>
        name === "alert_events" ? { find: () => eventChain } : { find: () => productChain }
    });

    const alerts = await loadAlertEvents(ACCOUNT_ID);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      id: event._id.toString(),
      productId: event.productId.toString(),
      productTitle: "Kindle",
      productStoreLabel: "Amazon",
      target: 1000,
      observedPrice: 950,
      read: false
    });
  });

  it("returns an empty list without a second query when there are no events", async () => {
    const eventChain = {
      sort: vi.fn(),
      limit: vi.fn(),
      toArray: vi.fn().mockResolvedValue([])
    };
    eventChain.sort.mockReturnValue(eventChain);
    eventChain.limit.mockReturnValue(eventChain);
    let productQueries = 0;

    getDbMock.mockResolvedValue({
      collection: (name: string) => {
        if (name === "alert_events") return { find: () => eventChain };
        productQueries += 1;
        return { find: () => ({ project: () => ({ toArray: async () => [] }) }) };
      }
    });

    await expect(loadAlertEvents(ACCOUNT_ID)).resolves.toEqual([]);
    expect(productQueries).toBe(0);
  });
});

describe("markAlertsRead", () => {
  it("rejects an invalid id without writing", async () => {
    const updateMany = vi.fn();
    getDbMock.mockResolvedValue({ collection: () => ({ updateMany }) });

    await expect(markAlertsRead(ACCOUNT_ID, { id: "not-an-id" })).resolves.toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("marks every unread event for the owner", async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 3 });
    getDbMock.mockResolvedValue({ collection: () => ({ updateMany }) });

    await expect(markAlertsRead(ACCOUNT_ID, { all: true })).resolves.toBe(3);

    const [filter] = updateMany.mock.calls[0];
    expect(filter).toEqual({ userId: ACCOUNT_ID, readAt: { $exists: false } });
  });

  it("marks a single owned event", async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });
    getDbMock.mockResolvedValue({ collection: () => ({ updateMany }) });
    const id = new ObjectId().toString();

    await expect(markAlertsRead(ACCOUNT_ID, { id })).resolves.toBe(1);

    const [filter] = updateMany.mock.calls[0];
    expect(filter.userId).toBe(ACCOUNT_ID);
    expect(filter._id.toString()).toBe(id);
  });
});

describe("dismissAlert", () => {
  it("rejects an invalid id without querying", async () => {
    await expect(dismissAlert(ACCOUNT_ID, "not-an-id")).resolves.toBe(false);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("deletes only the owner's event", async () => {
    const deleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
    getDbMock.mockResolvedValue({ collection: () => ({ deleteOne }) });
    const id = new ObjectId().toString();

    await expect(dismissAlert(ACCOUNT_ID, id)).resolves.toBe(true);

    const [filter] = deleteOne.mock.calls[0];
    expect(filter.userId).toBe(ACCOUNT_ID);
    expect(filter._id.toString()).toBe(id);
  });

  it("returns false when the event is not owned", async () => {
    const deleteOne = vi.fn().mockResolvedValue({ deletedCount: 0 });
    getDbMock.mockResolvedValue({ collection: () => ({ deleteOne }) });

    await expect(dismissAlert(ACCOUNT_ID, new ObjectId().toString())).resolves.toBe(false);
  });
});

describe("deleteAlertEventsForProduct", () => {
  it("removes every event for a deleted product", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 2 });
    getDbMock.mockResolvedValue({ collection: () => ({ deleteMany }) });
    const productId = new ObjectId();

    await deleteAlertEventsForProduct(productId);

    expect(deleteMany).toHaveBeenCalledWith({ productId });
  });
});
