import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sanitizeErrorMessage } from "@/lib/errors";
import { claimProductScan, scanClaimed, scanCooldownRemainingMs } from "@/lib/scanner";
import { getViewer } from "@/lib/viewer";
import type { ProductDocument } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const db = await getDb();
  const product = await db.collection<ProductDocument>("products").findOne({
    _id: new ObjectId(id),
    userId: viewer.userId
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  // Manual-scan cooldown: prevents repeated rescans of the same product from
  // hammering the retailer (scheduled cron scans are unaffected).
  const remaining = scanCooldownRemainingMs(product);
  if (remaining > 0) {
    return NextResponse.json(
      {
        error: `A scan was requested recently for this product. Try again in ${Math.ceil(remaining / 60000)} minutes.`
      },
      { status: 429 }
    );
  }

  // Atomically claim the scan so a manual rescan cannot race a cron run (or
  // another manual rescan) into a duplicate simultaneous scan.
  const claimed = await claimProductScan(product._id!);
  if (!claimed) {
    return NextResponse.json(
      { error: "A scan is already in progress for this product. Try again in a minute." },
      { status: 409 }
    );
  }

  try {
    const updated = await scanClaimed(claimed);
    return NextResponse.json({ product: { ...updated, _id: updated._id?.toString() } });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Scan failed. Please try again.") },
      { status: 400 }
    );
  }
}
