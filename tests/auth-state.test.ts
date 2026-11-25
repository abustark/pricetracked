import { afterEach, describe, expect, it, vi } from "vitest";
import { issueAuthState, verifyAuthState } from "@/lib/auth-state";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("server-bound sign-in state", () => {
  it("issues a state token that verifies", () => {
    const { state } = issueAuthState();
    expect(state.split(".")).toHaveLength(3);
    expect(verifyAuthState(state)).toEqual({ valid: true });
  });

  it("rejects a tampered signature", () => {
    const { state } = issueAuthState();
    const [nonce, timestamp, signature] = state.split(".");
    const tampered = `${nonce}.${timestamp}.${signature.slice(0, -2)}xx`;
    expect(verifyAuthState(tampered)).toEqual({ valid: false });
  });

  it("rejects an expired state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 0, 1, 0, 0, 0));
    const { state } = issueAuthState();

    vi.setSystemTime(Date.UTC(2026, 0, 1, 0, 11, 0)); // 11 minutes later
    expect(verifyAuthState(state)).toEqual({ valid: false });
  });

  it("rejects a replayed state (single-use nonce)", () => {
    const { state } = issueAuthState();
    expect(verifyAuthState(state)).toEqual({ valid: true });
    expect(verifyAuthState(state)).toEqual({ valid: false });
  });

  it("rejects malformed states", () => {
    expect(verifyAuthState("")).toEqual({ valid: false });
    expect(verifyAuthState("a.b")).toEqual({ valid: false });
    expect(verifyAuthState("a.b.c.d")).toEqual({ valid: false });
  });
});
