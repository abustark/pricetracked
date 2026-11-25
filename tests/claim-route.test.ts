import { beforeEach, describe, expect, it, vi } from "vitest";

const { getViewerMock, claimGuestProductsMock } = vi.hoisted(() => ({
  getViewerMock: vi.fn(),
  claimGuestProductsMock: vi.fn()
}));

// The real viewer module imports `@/auth`; stub it so loading the real
// `lib/viewer.ts` (via importOriginal) does not pull in next-auth's env,
// which cannot resolve `next/server` in the vitest node environment.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/viewer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/viewer")>();
  return {
    ...actual,
    getViewer: getViewerMock,
    claimGuestProducts: claimGuestProductsMock
  };
});

import { POST } from "@/app/api/claim/route";
import { CLAIM_STATUS_COOKIE } from "@/lib/viewer";

const GUEST_ID = "3f9c1a2b-1234-4abc-9def-0123456789ab";
const ACCOUNT_ID = "108231234567890123456";

function viewer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: ACCOUNT_ID,
    guestId: GUEST_ID,
    claim: { status: "none" },
    claimPending: true,
    session: null,
    signedIn: true,
    ...overrides
  };
}

beforeEach(() => {
  getViewerMock.mockReset();
  claimGuestProductsMock.mockReset();
});

describe("POST /api/claim", () => {
  it("returns 401 for a signed-out viewer without claiming", async () => {
    getViewerMock.mockResolvedValue(viewer({ signedIn: false, userId: undefined }));

    const response = await POST();

    expect(response.status).toBe(401);
    expect(claimGuestProductsMock).not.toHaveBeenCalled();
  });

  it("does nothing when there is no guest watchlist to claim", async () => {
    getViewerMock.mockResolvedValue(viewer({ guestId: undefined }));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "none", claimed: 0, merged: 0 });
    expect(claimGuestProductsMock).not.toHaveBeenCalled();
    expect(response.cookies.get(CLAIM_STATUS_COOKIE)).toBeUndefined();
  });

  it("claims the watchlist and records a saved status cookie", async () => {
    getViewerMock.mockResolvedValue(viewer());
    claimGuestProductsMock.mockResolvedValue({ status: "saved", claimed: 2, merged: 1 });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "saved", claimed: 2, merged: 1 });
    expect(claimGuestProductsMock).toHaveBeenCalledWith(ACCOUNT_ID, GUEST_ID);
    expect(response.cookies.get(CLAIM_STATUS_COOKIE)?.value).toBe("saved:3");
  });

  it("reports a failed claim with a sanitized message and a failed status cookie", async () => {
    getViewerMock.mockResolvedValue(viewer());
    claimGuestProductsMock.mockResolvedValue({
      status: "failed",
      claimed: 0,
      merged: 0,
      error: "failed to connect to MONGODB cluster"
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("failed");
    expect(body.error).toBe("Service temporarily unavailable. Please try again later.");
    expect(body.error).not.toContain("MONGODB");
    expect(response.cookies.get(CLAIM_STATUS_COOKIE)?.value).toBe("failed");
  });
});
