import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureIndexes, getDb } from "@/lib/db";
import { sanitizeErrorMessage } from "@/lib/errors";
import { getMaxProductsPerUser } from "@/lib/schedule";
import { requestProductScan } from "@/lib/scanner";
import { getOrCreateViewer, getViewer, setGuestCookie } from "@/lib/viewer";
import { queryWatchlist } from "@/lib/watchlist";
import type { ProductDocument } from "@/lib/types";

const TrackSchema = z.object({
  url: z.string().url()
});

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId) {
    return NextResponse.json({ products: [], total: 0, page: 1, limit: 20, stores: [] });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));

  await ensureIndexes();
  const { products, total, stores } = await queryWatchlist(viewer.userId, {
    q: url.searchParams.get("q") ?? undefined,
    store: url.searchParams.get("store") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    page,
    limit
  });

  return NextResponse.json({
    products: products.map((product) => ({
      ...product,
      _id: product._id?.toString()
    })),
    total,
    page,
    limit,
    stores
  });
}

export async function POST(request: Request) {
  try {
    const viewer = await getOrCreateViewer();
    const body = TrackSchema.parse(await request.json());
    await ensureIndexes();

    // Bound unbounded guest/account creation before any external request.
    const maxProducts = getMaxProductsPerUser();
    const db = await getDb();
    const trackedCount = await db
      .collection<ProductDocument>("products")
      .countDocuments({ userId: viewer.userId });
    if (trackedCount >= maxProducts) {
      return NextResponse.json(
        { error: `You can track up to ${maxProducts} products on this plan.` },
        { status: 400 }
      );
    }

    // Every scan trigger goes through the same claim → scan → release policy.
    const product = await requestProductScan(body.url, viewer.userId);

    const response = NextResponse.json({
      product: {
        ...product,
        _id: product._id?.toString()
      }
    });

    setGuestCookie(response, viewer.createdGuestId);
    return response;
  } catch (error) {
    const message = sanitizeErrorMessage(error, "Could not track product. Please try again.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
