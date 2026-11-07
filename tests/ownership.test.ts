import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, getViewerMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getViewerMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  getDb: getDbMock,
  ensureIndexes: vi.fn()
}));

vi.mock("@/lib/viewer", () => ({
  getViewer: getViewerMock,
  getOrCreateViewer: getViewerMock
}));

import { DELETE, GET, PATCH } from "@/app/api/products/[id]/route";
import { POST as SCAN } from "@/app/api/products/[id]/scan/route";
import { GET as ALERTS_GET, PATCH as ALERTS_PATCH } from "@/app/api/alerts/route";

const PRODUCT_ID = new ObjectId().toString();
const BASE = "http://localhost:3010";

const signedIn = { userId: "account-1", signedIn: true, session: null };
const signedOut = { userId: undefined, signedIn: false, session: null };

function params(id = PRODUCT_ID) {
  return { params: Promise.resolve({ id }) };
}

function request(path: string, init?: RequestInit) {
  return new Request(`${BASE}${path}`, init);
}

beforeEach(() => {
  getDbMock.mockReset();
  getViewerMock.mockReset();
});

describe("product route ownership", () => {
  it("rejects malformed product ids before authentication", async () => {
    const response = await GET(request("/api/products/bad-id"), params("bad-id"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid product id." });
  });

  it("requires a signed-in viewer for reads", async () => {
    getViewerMock.mockResolvedValue(signedOut);

    const response = await GET(request(`/api/products/${PRODUCT_ID}`), params());

    expect(response.status).toBe(401);
  });

  it("scopes reads to the viewer and returns 404 for another user's product", async () => {
    getViewerMock.mockResolvedValue(signedIn);
    const findOne = vi.fn().mockResolvedValue(null);
    getDbMock.mockResolvedValue({ collection: () => ({ findOne }) });

    const response = await GET(request(`/api/products/${PRODUCT_ID}`), params());

    expect(response.status).toBe(404);
    const [filter] = findOne.mock.calls[0];
    expect(filter.userId).toBe("account-1");
    expect(filter._id.toString()).toBe(PRODUCT_ID);
  });

  it("requires a signed-in viewer for updates", async () => {
    getViewerMock.mockResolvedValue(signedOut);

    const response = await PATCH(
      request(`/api/products/${PRODUCT_ID}`, { method: "PATCH", body: "{}" }),
      params()
    );

    expect(response.status).toBe(401);
  });

  it("rejects a malformed PATCH body for an owned product", async () => {
    getViewerMock.mockResolvedValue(signedIn);
    getDbMock.mockResolvedValue({
      collection: () => ({ findOne: vi.fn().mockResolvedValue({ _id: new ObjectId() }) })
    });

    const response = await PATCH(
      request(`/api/products/${PRODUCT_ID}`, { method: "PATCH", body: "{not json" }),
      params()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid request body." });
  });

  it("returns 404 instead of deleting another user's product", async () => {
    getViewerMock.mockResolvedValue(signedIn);
    const deleteOne = vi.fn().mockResolvedValue({ deletedCount: 0 });
    const deleteMany = vi.fn();
    getDbMock.mockResolvedValue({ collection: () => ({ deleteOne, deleteMany }) });

    const response = await DELETE(request(`/api/products/${PRODUCT_ID}`), params());

    expect(response.status).toBe(404);
    expect(deleteMany).not.toHaveBeenCalled();
    const [filter] = deleteOne.mock.calls[0];
    expect(filter.userId).toBe("account-1");
  });

  it("requires a signed-in viewer for rescans", async () => {
    getViewerMock.mockResolvedValue(signedOut);

    const response = await SCAN(request(`/api/products/${PRODUCT_ID}/scan`), params());

    expect(response.status).toBe(401);
  });

  it("returns 404 when rescanning a product the viewer does not own", async () => {
    getViewerMock.mockResolvedValue(signedIn);
    getDbMock.mockResolvedValue({
      collection: () => ({ findOne: vi.fn().mockResolvedValue(null) })
    });

    const response = await SCAN(request(`/api/products/${PRODUCT_ID}/scan`), params());

    expect(response.status).toBe(404);
  });
});

describe("alert route ownership", () => {
  it("requires a signed-in viewer to list alerts", async () => {
    getViewerMock.mockResolvedValue(signedOut);

    const response = await ALERTS_GET();

    expect(response.status).toBe(401);
  });

  it("requires a signed-in viewer to update alerts", async () => {
    getViewerMock.mockResolvedValue(signedOut);

    const response = await ALERTS_PATCH(
      request("/api/alerts", { method: "PATCH", body: JSON.stringify({ all: true }) })
    );

    expect(response.status).toBe(401);
  });

  it("rejects a malformed alert update body", async () => {
    getViewerMock.mockResolvedValue(signedIn);

    const response = await ALERTS_PATCH(
      request("/api/alerts", { method: "PATCH", body: "{not json" })
    );

    expect(response.status).toBe(400);
  });
});
