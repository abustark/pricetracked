import { beforeEach, describe, expect, it, vi } from "vitest";

const { OAuth2ClientMock, encodeMock } = vi.hoisted(() => ({
  OAuth2ClientMock: vi.fn(),
  encodeMock: vi.fn()
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: OAuth2ClientMock
}));

vi.mock("next-auth/jwt", () => ({
  encode: encodeMock
}));

import { POST } from "@/app/api/auth/google/route";
import { issueAuthState } from "@/lib/auth-state";

vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");

const TOKEN_PAYLOAD = { sub: "google-user-1", email: "user@example.com", name: "Test User" };

function mockGoogleClient() {
  const instance = {
    getToken: vi.fn().mockResolvedValue({ tokens: { id_token: "header.payload.signature" } }),
    verifyIdToken: vi.fn().mockResolvedValue({ getPayload: () => TOKEN_PAYLOAD })
  };
  // `new OAuth2Client(...)` in the route — the mock implementation must be a
  // constructable regular function, not an arrow function.
  OAuth2ClientMock.mockImplementation(function mockConstructor() {
    return instance;
  });
  return instance;
}

beforeEach(() => {
  OAuth2ClientMock.mockReset();
  encodeMock.mockReset();
  encodeMock.mockResolvedValue("encoded-session-token");
});

describe("POST /api/auth/google", () => {
  it("rejects a code with no sign-in state before any exchange", async () => {
    const client = mockGoogleClient();
    const response = await POST(
      new Request("https://app.example/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "some-code" })
      })
    );

    expect(response.status).toBe(400);
    expect(client.getToken).not.toHaveBeenCalled();
    expect(OAuth2ClientMock).not.toHaveBeenCalled();
  });

  it("rejects a code with an invalid state", async () => {
    const client = mockGoogleClient();
    const response = await POST(
      new Request("https://app.example/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "some-code", state: "forged.state.token" })
      })
    );

    expect(response.status).toBe(400);
    expect(client.getToken).not.toHaveBeenCalled();
  });

  it("exchanges a code bound to a valid server-issued state and sets the session cookie", async () => {
    const client = mockGoogleClient();
    const { state } = issueAuthState();

    const response = await POST(
      new Request("https://app.example/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "valid-code", state, codeVerifier: "verifier-value" })
      })
    );

    expect(response.status).toBe(200);
    expect(client.getToken).toHaveBeenCalledWith({ code: "valid-code", codeVerifier: "verifier-value" });
    expect(encodeMock).toHaveBeenCalledTimes(1);
  });
});
