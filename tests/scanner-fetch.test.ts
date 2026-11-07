import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProductSnapshot, isRetryableFetchError, looksBlocked } from "@/lib/scanner";
import { htmlResponse, JSON_LD_PRODUCT_HTML } from "./fixtures";

vi.mock("@/lib/url-guard", () => ({
  assertSafeFetchTarget: vi.fn(async () => undefined)
}));

const PRODUCT_URL = "https://www.amazon.in/dp/B0DGJ9N27P";
const NO_PRICE_HTML = `<html><head><title>No price</title></head><body><p>Nothing here</p></body></html>`;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("looksBlocked", () => {
  it("detects small challenge pages", () => {
    expect(looksBlocked("<html><head><title>Robot Check</title></head></html>")).toBe(true);
    expect(looksBlocked("<html><body><h1>Access Denied</h1></body></html>")).toBe(true);
  });

  it("does not flag large real product pages", () => {
    const large = `<html><head><title>Real Product</title></head><body>${"x".repeat(60_000)}</body></html>`;

    expect(looksBlocked(large)).toBe(false);
    expect(looksBlocked(JSON_LD_PRODUCT_HTML)).toBe(false);
  });
});

describe("isRetryableFetchError", () => {
  it("retries transient network and 5xx errors", () => {
    expect(isRetryableFetchError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableFetchError(new Error("The operation was aborted"))).toBe(true);
    expect(isRetryableFetchError(new Error("Store request failed with HTTP 503"))).toBe(true);
    expect(isRetryableFetchError(new Error("read ECONNRESET"))).toBe(true);
  });

  it("does not retry validation, block or size errors", () => {
    expect(isRetryableFetchError(new Error("The store blocked this request."))).toBe(false);
    expect(isRetryableFetchError(new Error("The store response was too large to read."))).toBe(false);
    expect(isRetryableFetchError(new Error("Only http and https product links are supported."))).toBe(
      false
    );
  });
});

describe("fetchProductSnapshot", () => {
  it("returns a direct observation on the first attempt", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse(JSON_LD_PRODUCT_HTML));

    const result = await fetchProductSnapshot(PRODUCT_URL);

    expect(result.source).toBe("direct");
    expect(result.attempts).toBe(1);
    expect(result.price).toBe(12999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable failure and then succeeds", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(htmlResponse(JSON_LD_PRODUCT_HTML));

    const result = await fetchProductSnapshot(PRODUCT_URL);

    expect(result.source).toBe("direct");
    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("retries HTTP 5xx up to the attempt cap, then fails", async () => {
    fetchMock.mockResolvedValue(new Response("upstream error", { status: 503 }));

    await expect(fetchProductSnapshot(PRODUCT_URL)).rejects.toThrow(/could not read|blocked/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 15_000);

  it("does not retry a non-retryable failure", async () => {
    fetchMock.mockRejectedValue(new Error("Something unexpected happened"));

    await expect(fetchProductSnapshot(PRODUCT_URL)).rejects.toThrow(/could not read this product price/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a bot-check page instead of parsing it", async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse("<html><head><title>Robot Check</title></head><body></body></html>")
    );

    await expect(fetchProductSnapshot(PRODUCT_URL)).rejects.toThrow(/blocked/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects non-HTML responses before parsing", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("binary", { status: 200, headers: { "content-type": "image/png" } })
    );

    await expect(fetchProductSnapshot(PRODUCT_URL)).rejects.toThrow(/could not read/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enforces the response size cap", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(`<html>${"a".repeat(2_000_100)}</html>`, {
        status: 200,
        headers: { "content-type": "text/html" }
      })
    );

    await expect(fetchProductSnapshot(PRODUCT_URL)).rejects.toThrow(/could not read/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a safe same-store redirect", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://www.amazon.in/dp/REDIRECTED" }
        })
      )
      .mockResolvedValueOnce(htmlResponse(JSON_LD_PRODUCT_HTML));

    const result = await fetchProductSnapshot(PRODUCT_URL);

    expect(result.price).toBe(12999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after five redirect hops", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://www.amazon.in/dp/LOOP" }
      })
    );

    await expect(fetchProductSnapshot(PRODUCT_URL)).rejects.toThrow(/could not read|blocked/i);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("refuses a redirect that leaves the supported store", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example.com/product" }
      })
    );

    await expect(fetchProductSnapshot(PRODUCT_URL)).rejects.toThrow(/could not read|blocked/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the configured proxy when the direct page has no price", async () => {
    vi.stubEnv("SCRAPER_PROXY_ENDPOINT", "https://proxy.test/scrape");
    fetchMock.mockImplementation(async (input: string) => {
      return String(input).includes("proxy.test")
        ? htmlResponse(JSON_LD_PRODUCT_HTML)
        : htmlResponse(NO_PRICE_HTML);
    });

    const result = await fetchProductSnapshot(PRODUCT_URL);

    expect(result.source).toBe("proxy");
    expect(result.price).toBe(12999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
