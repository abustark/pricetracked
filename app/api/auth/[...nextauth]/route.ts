import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/auth";
import { isGuestId } from "@/lib/guest";
import {
  CLAIM_STATUS_COOKIE,
  GUEST_COOKIE,
  setClaimPendingCookie
} from "@/lib/viewer";

/**
 * Wrap the Auth.js handlers so a successful standard sign-in (OAuth callback)
 * signals the guest-to-account watchlist claim transition — the same signal
 * the popup exchange route sets — whenever the request carries a guest cookie
 * and no claim has been recorded yet.
 */
function withClaimPendingSignal(
  handler: (req: NextRequest) => Promise<Response>
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    const response = await handler(req);
    if (response instanceof NextResponse) {
      if (
        isGuestId(req.cookies.get(GUEST_COOKIE)?.value) &&
        !req.cookies.get(CLAIM_STATUS_COOKIE)?.value
      ) {
        setClaimPendingCookie(response);
      }
    }
    return response;
  };
}

export const GET = withClaimPendingSignal(handlers.GET);
export const POST = withClaimPendingSignal(handlers.POST);
