import { describe, expect, it } from "vitest";
import { shouldCreateAlertEvent } from "@/lib/alerts";

const crossed = {
  hasExistingProduct: true,
  targetPrice: 1000,
  targetAlertEnabled: true,
  previouslyReached: false,
  nowReached: true
};

describe("shouldCreateAlertEvent", () => {
  it("fires on a genuine above-to-below crossing", () => {
    expect(shouldCreateAlertEvent(crossed)).toBe(true);
  });

  it("treats a legacy product without the enabled flag as enabled", () => {
    expect(shouldCreateAlertEvent({ ...crossed, targetAlertEnabled: undefined })).toBe(true);
  });

  it("never fires for a first-time add", () => {
    expect(shouldCreateAlertEvent({ ...crossed, hasExistingProduct: false })).toBe(false);
  });

  it("never fires without a positive target", () => {
    expect(shouldCreateAlertEvent({ ...crossed, targetPrice: undefined })).toBe(false);
    expect(shouldCreateAlertEvent({ ...crossed, targetPrice: 0 })).toBe(false);
  });

  it("respects an explicit pause", () => {
    expect(shouldCreateAlertEvent({ ...crossed, targetAlertEnabled: false })).toBe(false);
  });

  it("does not fire while the price is still above the target", () => {
    expect(shouldCreateAlertEvent({ ...crossed, nowReached: false })).toBe(false);
  });

  it("is idempotent while the price stays below the target", () => {
    expect(shouldCreateAlertEvent({ ...crossed, previouslyReached: true })).toBe(false);
  });
});
