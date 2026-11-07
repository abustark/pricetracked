import { describe, expect, it } from "vitest";
import { sanitizeErrorMessage } from "@/lib/errors";

const FALLBACK = "Could not do the thing.";

describe("sanitizeErrorMessage", () => {
  it("returns the fallback for empty errors", () => {
    expect(sanitizeErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(sanitizeErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(sanitizeErrorMessage("", FALLBACK)).toBe(FALLBACK);
  });

  it("hides infrastructure details", () => {
    expect(sanitizeErrorMessage(new Error("MONGODB_URI is not configured."), FALLBACK)).toBe(
      "Service temporarily unavailable. Please try again later."
    );
    expect(sanitizeErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:27017"), FALLBACK)).toBe(
      "Service temporarily unavailable. Please try again later."
    );
    expect(sanitizeErrorMessage(new Error("AUTH_SECRET missing"), FALLBACK)).toBe(
      "Service temporarily unavailable. Please try again later."
    );
  });

  it("preserves actionable validation and scraper messages", () => {
    expect(sanitizeErrorMessage(new Error("Paste a public product link."), FALLBACK)).toBe(
      "Paste a public product link."
    );
    expect(sanitizeErrorMessage(new Error("The store blocked this request."), FALLBACK)).toBe(
      "The store blocked this request."
    );
  });

  it("replaces raw exception shapes", () => {
    expect(sanitizeErrorMessage(new Error("Error: exploded"), FALLBACK)).toBe(FALLBACK);
    expect(sanitizeErrorMessage("TypeError: x is not a function at app.ts:12", FALLBACK)).toBe(FALLBACK);
  });

  it("caps oversized messages", () => {
    const result = sanitizeErrorMessage("a".repeat(260), FALLBACK);

    expect(result).toHaveLength(200);
    expect(result.endsWith("...")).toBe(true);
  });

  it("passes normal short messages through", () => {
    expect(sanitizeErrorMessage("Scan failed. Please try again.", FALLBACK)).toBe(
      "Scan failed. Please try again."
    );
  });
});
