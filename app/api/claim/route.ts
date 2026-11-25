import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/errors";
import {
  claimGuestProducts,
  getViewer,
  setClaimStatusCookie
} from "@/lib/viewer";

/**
 * Explicit, idempotent guest→account watchlist claim.
 *
 * Runs once after a sign-in transition (the auth flows set the
 * `claim-pending` cookie when a session is established with a guest cookie
 * present). Plain reads never mutate anything — `getViewer()` is read-only,
 * and this endpoint is the only place the claim executes.
 */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer.signedIn || !viewer.userId) {
    return NextResponse.json({ status: "none", claimed: 0, merged: 0 }, { status: 401 });
  }
  if (!viewer.guestId) {
    return NextResponse.json({ status: "none", claimed: 0, merged: 0 });
  }

  const result = await claimGuestProducts(viewer.userId, viewer.guestId);
  const response = NextResponse.json(
    result.status === "failed"
      ? {
          ...result,
          error: sanitizeErrorMessage(
            result.error,
            "Your browser watchlist could not be moved to your account yet."
          )
        }
      : result
  );
  setClaimStatusCookie(response, result);
  return response;
}
