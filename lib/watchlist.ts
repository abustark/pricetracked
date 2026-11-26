import { getDb } from "@/lib/db";
import { getEffectiveScanEveryHours } from "@/lib/schedule";
import type { ProductDocument } from "@/lib/types";

export type ProductStatus = "fresh" | "stale" | "error" | "paused";

export type WatchlistQuery = {
  q?: string;
  store?: string;
  status?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

export type WatchlistPage = {
  products: (ProductDocument & { status: ProductStatus })[];
  total: number;
  stores: string[];
};

/**
 * Freshness/status for a product, derived from stored state:
 * paused (rule off) → error (last scan failed) → stale (past the effective
 * cadence since the last successful scan) → fresh.
 */
export function productStatus(product: ProductDocument, now: number): ProductStatus {
  if (!product.active) return "paused";
  if (product.lastError) return "error";
  if (!product.lastScannedAt) return "stale";
  const cadenceMs = getEffectiveScanEveryHours(product.scanEveryHours) * 60 * 60 * 1000;
  return now - product.lastScannedAt.getTime() > cadenceMs ? "stale" : "fresh";
}

function sortProducts<T extends ProductDocument>(products: T[], sort: string): T[] {
  const sorted = [...products];
  if (sort === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  } else if (sort === "target") {
    // Target proximity: products with a target first, ordered by how close
    // the last accepted price is to it.
    sorted.sort((a, b) => {
      const aTarget =
        a.targetPrice !== undefined && a.lastPrice !== undefined
          ? a.targetPrice - a.lastPrice
          : Number.POSITIVE_INFINITY;
      const bTarget =
        b.targetPrice !== undefined && b.lastPrice !== undefined
          ? b.targetPrice - b.lastPrice
          : Number.POSITIVE_INFINITY;
      return aTarget - bTarget;
    });
  } else {
    // Default: latest accepted observation first.
    sorted.sort((a, b) => {
      const aTime = a.lastScannedAt?.getTime() ?? 0;
      const bTime = b.lastScannedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }
  return sorted;
}

/**
 * Paginated, filtered watchlist query. Per-user watchlists are bounded by
 * MAX_PRODUCTS_PER_USER (cap 100), so loading the viewer's products and
 * filtering in memory is simple and honest — no silent truncation beyond
 * the quota.
 */
export async function queryWatchlist(userId: string, query: WatchlistQuery = {}): Promise<WatchlistPage> {
  const db = await getDb();
  const products = db.collection<ProductDocument>("products");

  const filter: Record<string, unknown> = { userId };
  const q = query.q?.trim() ?? "";
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { url: { $regex: escaped, $options: "i" } },
      { normalizedUrl: { $regex: escaped, $options: "i" } }
    ];
  }
  if (query.store) filter.store = query.store;

  const all = await products.find(filter).toArray();
  const now = Date.now();

  const withStatus = all.map((product) => ({ ...product, status: productStatus(product, now) }));
  const filtered = withStatus.filter(
    (product) => !query.status || query.status === "all" || product.status === query.status
  );

  const sorted = sortProducts(filtered, query.sort ?? "latest");
  const total = sorted.length;
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const page = Math.max(1, query.page ?? 1);
  const start = (page - 1) * limit;

  return {
    products: sorted.slice(start, start + limit),
    total,
    stores: [...new Set(all.map((product) => product.store))].sort()
  };
}

/**
 * Summary counts from real stored state: tracking (all products), targets
 * reached, and needs attention (stale or failed).
 */
export async function watchlistSummary(userId: string): Promise<{
  tracking: number;
  reached: number;
  attention: number;
}> {
  const db = await getDb();
  const products = await db
    .collection<ProductDocument>("products")
    .find({ userId })
    .toArray();
  const now = Date.now();

  let reached = 0;
  let attention = 0;
  for (const product of products) {
    if (product.targetPriceReached) reached += 1;
    const status = productStatus(product, now);
    if (status === "stale" || status === "error") attention += 1;
  }

  return { tracking: products.length, reached, attention };
}
