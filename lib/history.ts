import { ObjectId } from "mongodb";
import { OBSERVED_SOURCES } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import type { PriceSampleDocument } from "@/lib/types";

/** Latest observed samples kept for display/chart/stats on one page load. */
export const HISTORY_WINDOW_LIMIT = 1000;

/**
 * Latest `limit` observed samples in chronological order.
 *
 * Older queries sorted ascending and capped at 1000, so once a product had more
 * than 1,000 observations the API returned the EARLIEST thousand and derived
 * statistics could report an obsolete current value. Latest-first selection
 * keeps the newest observations while the full-range summary (below) keeps the
 * aggregates honest across the entire history.
 */
export async function getLatestSamples(
  productId: ObjectId,
  limit: number = HISTORY_WINDOW_LIMIT
): Promise<PriceSampleDocument[]> {
  const db = await getDb();
  const samples = await db
    .collection<PriceSampleDocument>("price_samples")
    .find({ productId, source: { $in: [...OBSERVED_SOURCES] } })
    .sort({ capturedAt: -1 })
    .limit(limit)
    .toArray();

  return samples.reverse();
}

export type FullRangeSummary = {
  sampleCount: number;
  highest?: { price: number; capturedAt: Date };
  lowest?: { price: number; capturedAt: Date };
};

/**
 * Full-history aggregates (count + extrema) over ALL observed samples, so
 * history beyond the display window still contributes to the numbers.
 */
export async function getFullRangeSummary(productId: ObjectId): Promise<FullRangeSummary> {
  const db = await getDb();
  const observedFilter = { productId, source: { $in: [...OBSERVED_SOURCES] } };

  const [countDoc, lowestDoc, highestDoc] = await Promise.all([
    db.collection<PriceSampleDocument>("price_samples").countDocuments(observedFilter),
    db
      .collection<PriceSampleDocument>("price_samples")
      .find(observedFilter)
      .sort({ price: 1, capturedAt: 1 })
      .limit(1)
      .toArray(),
    db
      .collection<PriceSampleDocument>("price_samples")
      .find(observedFilter)
      .sort({ price: -1, capturedAt: -1 })
      .limit(1)
      .toArray()
  ]);

  return {
    sampleCount: countDoc,
    lowest: lowestDoc[0] ? { price: lowestDoc[0].price, capturedAt: lowestDoc[0].capturedAt } : undefined,
    highest: highestDoc[0]
      ? { price: highestDoc[0].price, capturedAt: highestDoc[0].capturedAt }
      : undefined
  };
}
