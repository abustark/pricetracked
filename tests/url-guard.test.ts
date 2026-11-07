import { beforeEach, describe, expect, it, vi } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock
}));

import { assertSafeFetchTarget } from "@/lib/url-guard";

beforeEach(() => {
  lookupMock.mockReset();
});

describe("assertSafeFetchTarget", () => {
  it("accepts a public host that resolves to public addresses", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);

    await expect(assertSafeFetchTarget("https://example.com/product/1")).resolves.toBeUndefined();
    expect(lookupMock).toHaveBeenCalledWith("example.com", { all: true, verbatim: true });
  });

  it("rejects hosts that resolve to a private address", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "10.0.0.8", family: 4 }]);

    await expect(assertSafeFetchTarget("https://rebind.example.com/p")).rejects.toThrow(
      /non-public address/i
    );
  });

  it("rejects private IPv6 resolutions", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "fd00::1", family: 6 }]);

    await expect(assertSafeFetchTarget("https://rebind.example.com/p")).rejects.toThrow(
      /non-public address/i
    );
  });

  it("rejects localhost before DNS lookup", async () => {
    await expect(assertSafeFetchTarget("http://localhost:3000/admin")).rejects.toThrow(
      /public store host/i
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects literal private IPs before DNS lookup", async () => {
    await expect(assertSafeFetchTarget("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      /public store host/i
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects non-web protocols and embedded credentials", async () => {
    await expect(assertSafeFetchTarget("ftp://example.com/file")).rejects.toThrow(/http and https/i);
    await expect(assertSafeFetchTarget("https://user:pass@example.com/p")).rejects.toThrow(
      /credentials/i
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("fails closed when DNS resolution fails", async () => {
    lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));

    await expect(assertSafeFetchTarget("https://missing.example.com/p")).rejects.toThrow(
      /could not resolve/i
    );
  });

  it("fails closed when DNS returns no records", async () => {
    lookupMock.mockResolvedValueOnce([]);

    await expect(assertSafeFetchTarget("https://empty.example.com/p")).rejects.toThrow(
      /could not resolve/i
    );
  });
});
