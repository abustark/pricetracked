import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { isGuestId } from "@/lib/guest";
import type { ProductDocument } from "@/lib/types";

export const GUEST_COOKIE = "pricetracked-guest-id";
/**
 * Set by the auth flows (popup exchange + standard Auth.js callback) when a
 * signed-in session is established while a guest cookie is present. It is the
 * single, explicit signal that the guest→account watchlist claim must run.
 * Cleared implicitly once a claim-status cookie exists.
 */
export const CLAIM_PENDING_COOKIE = "pricetracked-claim-pending";
/**
 * Written by the claim operation itself: `saved:<count>` or `failed`.
 * Lets later page loads show honest claim status without re-running anything.
 */
export const CLAIM_STATUS_COOKIE = "pricetracked-claim-status";

const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const CLAIM_PENDING_COOKIE_MAX_AGE = 60 * 60;
const CLAIM_STATUS_COOKIE_MAX_AGE = 60 * 60;

export type ClaimStatus = {
  status: "none" | "saved" | "failed";
  claimedCount?: number;
  message?: string;
};

export type ClaimResult = {
  status: "saved" | "failed";
  claimed: number;
  merged: number;
  error?: string;
};

type Viewer = {
  userId?: string;
  guestId?: string;
  claim: ClaimStatus;
  claimPending: boolean;
  session: Session | null;
  signedIn: boolean;
};

/**
 * Resolve the current viewer without any database mutation.
 *
 * The guest→account claim used to run inline here on every signed-in load,
 * which meant reads mutated data and a failed claim was invisible (returned
 * zero). It is now an explicit operation: `claimGuestProducts` runs only from
 * `POST /api/claim`, triggered once by the `claim-pending` cookie the auth
 * flows set at the sign-in transition.
 */
export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  const cookieHeaders = await cookies();
  const guestId = getGuestId(cookieHeaders.get(GUEST_COOKIE)?.value);
  const claim = readClaimStatus(cookieHeaders.get(CLAIM_STATUS_COOKIE)?.value);
  const claimPending = Boolean(
    cookieHeaders.get(CLAIM_PENDING_COOKIE)?.value && !cookieHeaders.get(CLAIM_STATUS_COOKIE)?.value
  );

  if (session?.user?.id) {
    return { userId: session.user.id, guestId, claim, claimPending, session, signedIn: true };
  }

  return { userId: guestId, guestId, claim, claimPending, session: null, signedIn: false };
}

export async function getOrCreateViewer(): Promise<Viewer & { createdGuestId?: string }> {
  const viewer = await getViewer();
  if (viewer.userId || viewer.signedIn) return viewer;

  const guestId = randomUUID();
  return { ...viewer, userId: guestId, guestId, createdGuestId: guestId };
}

/**
 * Move anonymous browser products into the account that just signed in.
 *
 * Explicit and idempotent:
 * - each guest product is claimed with an atomic, guest-scoped
 *   `findOneAndUpdate`, so overlapping or repeated runs cannot move the same
 *   product twice;
 * - products whose URL the account already tracks are merged (samples
 *   re-pointed to the account product, guest document deleted) — both steps
 *   are idempotent;
 * - failures are reported in the result instead of being silently swallowed,
 *   so the caller can show visible status and retry.
 */
export async function claimGuestProducts(userId: string, guestId?: string): Promise<ClaimResult> {
  if (!guestId || guestId === userId) {
    return { status: "saved", claimed: 0, merged: 0 };
  }

  try {
    const db = await getDb();
    const products = db.collection<ProductDocument>("products");
    const samples = db.collection("price_samples");
    const guestProducts = await products.find({ userId: guestId }).toArray();
    let claimed = 0;
    let merged = 0;

    for (const guestProduct of guestProducts) {
      if (!guestProduct._id) continue;

      const accountProduct = await products.findOne({
        userId,
        normalizedUrl: guestProduct.normalizedUrl
      });

      if (accountProduct?._id) {
        // The account already tracks this URL: re-point the guest's samples
        // (matches only the old productId, so re-running is a no-op) and drop
        // the duplicate guest document.
        await samples.updateMany(
          { productId: guestProduct._id },
          { $set: { productId: accountProduct._id } }
        );
        await products.deleteOne({ _id: guestProduct._id, userId: guestId });
        merged += 1;
        continue;
      }

      // Atomic guest-scoped claim. A product already moved by a concurrent or
      // earlier run no longer matches `{ _id, userId: guestId }`, so it is
      // skipped — no double move, no double count.
      try {
        const claimedProduct = await products.findOneAndUpdate(
          { _id: guestProduct._id, userId: guestId },
          { $set: { userId, updatedAt: new Date() } }
        );
        if (claimedProduct) claimed += 1;
      } catch (error) {
        // A unique {userId, normalizedUrl} violation means the account gained
        // the same URL concurrently — the merge path covers it.
        if ((error as { code?: number })?.code === 11000) {
          merged += 1;
          continue;
        }
        throw error;
      }
    }

    return { status: "saved", claimed, merged };
  } catch (error) {
    return {
      status: "failed",
      claimed: 0,
      merged: 0,
      error: error instanceof Error ? error.message : "unknown error"
    };
  }
}

export function setGuestCookie(response: NextResponse, guestId?: string): void {
  if (!guestId) return;

  response.cookies.set(
    GUEST_COOKIE,
    guestId,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: GUEST_COOKIE_MAX_AGE,
      path: "/"
    }
  );
}

/** Signal that the guest→account claim must run after this sign-in. */
export function setClaimPendingCookie(response: NextResponse): void {
  response.cookies.set(
    CLAIM_PENDING_COOKIE,
    "1",
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: CLAIM_PENDING_COOKIE_MAX_AGE,
      path: "/"
    }
  );
}

/** Record the outcome of a claim attempt so later loads show honest status. */
export function setClaimStatusCookie(response: NextResponse, result: ClaimResult): void {
  const value = result.status === "saved" ? `saved:${result.claimed + result.merged}` : "failed";
  response.cookies.set(
    CLAIM_STATUS_COOKIE,
    value,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: CLAIM_STATUS_COOKIE_MAX_AGE,
      path: "/"
    }
  );
}

function readClaimStatus(value?: string): ClaimStatus {
  if (!value) return { status: "none" };
  if (value.startsWith("saved:")) {
    const claimedCount = Number.parseInt(value.slice("saved:".length), 10);
    return { status: "saved", claimedCount: Number.isFinite(claimedCount) ? claimedCount : 0 };
  }
  if (value === "failed") {
    return {
      status: "failed",
      message: "Your browser watchlist could not be moved to your account yet."
    };
  }
  return { status: "none" };
}

function getGuestId(value?: string): string | undefined {
  return isGuestId(value) ? value : undefined;
}
