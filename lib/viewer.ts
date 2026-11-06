import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import type { ProductDocument } from "@/lib/types";

export const GUEST_COOKIE = "pricetracked-guest-id";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const GUEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;

type Viewer = {
  userId?: string;
  guestId?: string;
  claimedCount?: number;
  session: Session | null;
  signedIn: boolean;
};

export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  const guestId = getGuestId((await cookies()).get(GUEST_COOKIE)?.value);

  if (session?.user?.id) {
    const claimedCount = await claimGuestProducts(session.user.id, guestId);
    return { userId: session.user.id, guestId, claimedCount, session, signedIn: true };
  }

  return { userId: guestId, guestId, session: null, signedIn: false };
}

export async function getOrCreateViewer(): Promise<Viewer & { createdGuestId?: string }> {
  const viewer = await getViewer();
  if (viewer.userId || viewer.signedIn) return viewer;

  const guestId = randomUUID();
  return { ...viewer, userId: guestId, guestId, createdGuestId: guestId };
}

/** Move anonymous browser products into the account that just signed in. */
export async function claimGuestProducts(userId: string, guestId?: string): Promise<number> {
  if (!guestId || guestId === userId) return 0;

  try {
    const db = await getDb();
    const products = db.collection<ProductDocument>("products");
    const samples = db.collection("price_samples");
    const guestProducts = await products.find({ userId: guestId }).toArray();
    let claimedCount = 0;

    for (const guestProduct of guestProducts) {
      if (!guestProduct._id) continue;

      const accountProduct = await products.findOne({
        userId,
        normalizedUrl: guestProduct.normalizedUrl
      });

      if (accountProduct?._id) {
        await samples.updateMany(
          { productId: guestProduct._id },
          { $set: { productId: accountProduct._id } }
        );
        await products.deleteOne({ _id: guestProduct._id, userId: guestId });
      } else {
        await products.updateOne(
          { _id: guestProduct._id, userId: guestId },
          { $set: { userId, updatedAt: new Date() } }
        );
      }

      claimedCount += 1;
    }

    return claimedCount;
  } catch {
    return 0;
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

function getGuestId(value?: string): string | undefined {
  return value && GUEST_ID_PATTERN.test(value) ? value : undefined;
}
