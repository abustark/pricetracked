import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertAllowedProductUrl,
  assertNoUrlCredentials,
  assertWebProtocol,
  canonicalizeStoreUrl,
  detectShortLinkStore,
  detectStore,
  getStoreLabel,
  isSafePublicHostname,
  normalizeProductUrl,
  resolveSupportedProductUrl
} from "@/lib/stores";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("store detection", () => {
  it("maps known store hosts to their adapters", () => {
    expect(detectStore("https://www.amazon.in/dp/B0DGJ9N27P")).toBe("amazon");
    expect(detectStore("https://www.flipkart.com/item/p/itm123")).toBe("flipkart");
    expect(detectStore("https://www.myntra.com/shoes/123/buy")).toBe("myntra");
    expect(detectStore("https://www.ajio.com/p/123")).toBe("ajio");
  });

  it("falls back to the generic adapter for other public domains", () => {
    expect(detectStore("https://shop.example.com/product/1")).toBe("other");
  });

  it("recognises short-link hosts and refuses to treat them as products", () => {
    expect(detectShortLinkStore("https://amzn.in/d/abc")).toBe("amazon");
    expect(detectShortLinkStore("https://fkrt.it/abc")).toBe("flipkart");
    expect(detectStore("https://amzn.in/d/abc")).toBeNull();
  });
});

describe("URL safety", () => {
  it("accepts public store hosts", () => {
    expect(isSafePublicHostname("example.com")).toBe(true);
    expect(isSafePublicHostname("sub.example.co.uk")).toBe(true);
    expect(isSafePublicHostname("8.8.8.8")).toBe(true);
    expect(isSafePublicHostname("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects localhost and internal site names", () => {
    expect(isSafePublicHostname("localhost")).toBe(false);
    expect(isSafePublicHostname("api.localhost")).toBe(false);
    expect(isSafePublicHostname("printer.local")).toBe(false);
    expect(isSafePublicHostname("service.internal")).toBe(false);
  });

  it("rejects private, loopback, link-local, CGNAT and reserved IPv4", () => {
    expect(isSafePublicHostname("127.0.0.1")).toBe(false);
    expect(isSafePublicHostname("10.1.2.3")).toBe(false);
    expect(isSafePublicHostname("172.16.5.4")).toBe(false);
    expect(isSafePublicHostname("192.168.0.1")).toBe(false);
    expect(isSafePublicHostname("169.254.169.254")).toBe(false);
    expect(isSafePublicHostname("100.64.0.10")).toBe(false);
    expect(isSafePublicHostname("0.0.0.0")).toBe(false);
    expect(isSafePublicHostname("224.0.0.1")).toBe(false);
    expect(isSafePublicHostname("255.255.255.255")).toBe(false);
    expect(isSafePublicHostname("198.18.0.1")).toBe(false);
    expect(isSafePublicHostname("2130706433")).toBe(false);
  });

  it("rejects private and non-global IPv6", () => {
    expect(isSafePublicHostname("::1")).toBe(false);
    expect(isSafePublicHostname("fe80::1")).toBe(false);
    expect(isSafePublicHostname("fc00::1")).toBe(false);
    expect(isSafePublicHostname("fd12:3456::1")).toBe(false);
    expect(isSafePublicHostname("ff02::1")).toBe(false);
    expect(isSafePublicHostname("2001:db8::1")).toBe(false);
    expect(isSafePublicHostname("2002::1")).toBe(false);
    expect(isSafePublicHostname("::ffff:192.168.1.1")).toBe(false);
  });

  it("only allows web protocols", () => {
    expect(() => assertWebProtocol(new URL("https://example.com"))).not.toThrow();
    expect(() => assertWebProtocol(new URL("http://example.com"))).not.toThrow();
    expect(() => assertWebProtocol(new URL("ftp://example.com"))).toThrow(/http and https/i);
    expect(() => assertWebProtocol(new URL("javascript://example.com"))).toThrow(/http and https/i);
  });

  it("rejects URLs with embedded credentials", () => {
    expect(() => assertNoUrlCredentials(new URL("https://user:pass@example.com"))).toThrow(/credentials/i);
    expect(() => assertNoUrlCredentials(new URL("https://example.com"))).not.toThrow();
  });

  it("validates a trackable product URL end to end", () => {
    expect(assertAllowedProductUrl("https://www.amazon.in/dp/B0DGJ9N27P").store).toBe("amazon");
    expect(() => assertAllowedProductUrl("ftp://example.com/x")).toThrow(/http and https/i);
    expect(() => assertAllowedProductUrl("https://u:p@example.com/x")).toThrow(/credentials/i);
    expect(() => assertAllowedProductUrl("https://127.0.0.1/x")).toThrow(/public product link/i);
  });
});

describe("short-link resolution", () => {
  it("resolves a known short link to a canonical store URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 301,
        headers: { location: "https://www.amazon.in/dp/B0DGJ9N27P?tag=abc" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveSupportedProductUrl("https://amzn.in/d/abc")).resolves.toBe(
      "https://www.amazon.in/dp/B0DGJ9N27P?tag=abc"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a direct store URL without any network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveSupportedProductUrl("http://amazon.in/dp/X")).resolves.toBe(
      "https://www.amazon.in/dp/X"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a short link that lands on a private host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" }
        })
      )
    );

    await expect(resolveSupportedProductUrl("https://amzn.in/d/abc")).rejects.toThrow(
      /could not resolve this short link/i
    );
  });

  it("gives up after five short-link hops", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://amzn.in/d/next" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveSupportedProductUrl("https://amzn.in/d/start")).rejects.toThrow(
      /could not resolve this short link/i
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("uses the generic adapter for any other public domain", async () => {
    await expect(resolveSupportedProductUrl("https://example.com/not-a-product")).resolves.toBe(
      "https://example.com/not-a-product"
    );
  });
});

describe("URL normalisation", () => {
  it("forces https and the canonical store host", () => {
    expect(canonicalizeStoreUrl("http://amazon.in/dp/X?tag=abc#frag", "amazon")).toBe(
      "https://www.amazon.in/dp/X?tag=abc"
    );
    expect(canonicalizeStoreUrl("http://flipkart.com/item/1", "flipkart")).toBe(
      "https://www.flipkart.com/item/1"
    );
  });

  it("keeps only allow-listed query params and drops the hash", () => {
    expect(normalizeProductUrl("https://www.amazon.in/dp/X?tag=abc&ref=home&th=1#reviews")).toBe(
      "https://www.amazon.in/dp/X?tag=abc&th=1"
    );
  });

  it("uses a stable store label", () => {
    expect(getStoreLabel("amazon")).toBe("Amazon");
    expect(getStoreLabel("flipkart")).toBe("Flipkart");
    expect(getStoreLabel("other", "https://www.shop.example.com/p/1")).toBe("shop.example.com");
    expect(getStoreLabel("other", undefined)).toBe("Online store");
  });
});
