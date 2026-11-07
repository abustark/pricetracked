import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { isGuestId } from "@/lib/guest";
import type { AlertEventDocument, AlertEventView, ProductDocument } from "@/lib/types";

/**
 * Create an in-app alert event for a target-price crossing. Callers must only
 * invoke this on a genuine successful observation (`direct`/`proxy` scan) when
 * the price crossed from above the target to at-or-below it while the alert is
 * enabled — the transition state on the product (`targetPriceReached`) is the
 * dedupe mechanism, so repeated below-target scans never create new events.
 * Guests are skipped: they have no cross-device alert surface.
 */
export async function createAlertEvent(input: {
  productId: ObjectId;
  userId?: string;
  target: number;
  observedPrice: number;
  currency: string;
  observedAt: Date;
}): Promise<void> {
  // Guests have no alert surface (and their products are migrated on sign-in
  // without alert events) — never store events for a guest id.
  if (!input.userId || isGuestId(input.userId)) return;

  const db = await getDb();
  const event: AlertEventDocument = {
    productId: input.productId,
    userId: input.userId,
    target: input.target,
    observedPrice: input.observedPrice,
    currency: input.currency,
    observedAt: input.observedAt,
    createdAt: new Date()
  };

  try {
    await db.collection<AlertEventDocument>("alert_events").insertOne(event);
  } catch (error) {
    // Unique index {productId, target, observedAt} — a duplicate insert for the
    // same scan (e.g. an unlikely concurrent double-fire) is a no-op. Any other
    // failure is logged as a short code only: an alert write must never fail the
    // scan that produced it, and user data is never logged.
    const code = (error as { code?: number })?.code;
    if (code !== 11000) {
      console.warn("[alerts] alert event insert failed", code ?? "unknown");
    }
  }
}

/** Latest alert events for a user, newest-first capped to recent history. */
export async function loadAlertEvents(userId: string, limit = 20): Promise<AlertEventView[]> {
  const db = await getDb();
  const events = await db
    .collection<AlertEventDocument>("alert_events")
    .find({ userId })
    .sort({ observedAt: -1 })
    .limit(limit)
    .toArray();

  if (events.length === 0) return [];

  const productIds = [...new Set(events.map((event) => event.productId))];
  const products = await db
    .collection<ProductDocument>("products")
    .find({ _id: { $in: productIds } })
    .project({ title: 1, storeLabel: 1 })
    .toArray();
  const productMeta = new Map(
    products.map((product) => [product._id?.toString(), { title: product.title, storeLabel: product.storeLabel }])
  );

  return events.map((event) => ({
    id: event._id?.toString() || "",
    productId: event.productId.toString(),
    productTitle: productMeta.get(event.productId.toString())?.title || "Tracked product",
    productStoreLabel: productMeta.get(event.productId.toString())?.storeLabel,
    target: event.target,
    observedPrice: event.observedPrice,
    currency: event.currency,
    observedAt: event.observedAt.toISOString(),
    read: event.readAt != null
  }));
}

/** Mark one event (or all) as read. Returns the number of events updated. */
export async function markAlertsRead(
  userId: string,
  options: { id?: string; all?: boolean }
): Promise<number> {
  const db = await getDb();
  const filter: Record<string, unknown> = { userId, readAt: { $exists: false } };
  if (!options.all) {
    if (!options.id || !ObjectId.isValid(options.id)) return 0;
    filter._id = new ObjectId(options.id);
  }
  const result = await db
    .collection<AlertEventDocument>("alert_events")
    .updateMany(filter, { $set: { readAt: new Date() } });
  return result.modifiedCount;
}

/** Dismiss (delete) one alert event owned by the user. */
export async function dismissAlert(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const result = await db
    .collection<AlertEventDocument>("alert_events")
    .deleteOne({ _id: new ObjectId(id), userId });
  return result.deletedCount > 0;
}

/** Remove every alert event for a product (used when the product is deleted). */
export async function deleteAlertEventsForProduct(productId: ObjectId): Promise<void> {
  const db = await getDb();
  await db.collection<AlertEventDocument>("alert_events").deleteMany({ productId });
}
