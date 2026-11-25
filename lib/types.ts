import type { ObjectId } from "mongodb";

/** Known adapters plus a structured-data fallback for any public ecommerce domain. */
export type StoreKey = "amazon" | "flipkart" | "myntra" | "ajio" | "other";

export type ProductDocument = {
  _id?: ObjectId;
  url: string;
  normalizedUrl: string;
  userId?: string;
  store: StoreKey;
  storeLabel?: string;
  title: string;
  imageUrl?: string;
  currency: string;
  active: boolean;
  scanEveryHours: number;
  nextScanAt: Date;
  lastScannedAt?: Date;
  lastAttemptAt?: Date;
  scanLockUntil?: Date | null;
  scanStartedAt?: Date;
  failureCount?: number;
  lastPrice?: number;
  mrp?: number;
  discountPercent?: number;
  targetPrice?: number;
  targetPriceReached?: boolean;
  targetAlertEnabled?: boolean;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Offer-scoped availability. `unknown` is deliberately distinct from
 * `out_of_stock`: availability must come from the selected offer, never from
 * whole-page text that may belong to a recommendation or footer. */
export type Availability = "in_stock" | "out_of_stock" | "unknown";

export type PriceSampleDocument = {
  _id?: ObjectId;
  productId: ObjectId;
  price: number;
  currency: string;
  availability?: Availability;
  inStock?: boolean;
  source: "direct" | "proxy" | "historical" | "mrp-baseline";
  capturedAt: Date;
  createdAt: Date;
};

export type ScanResult = {
  title: string;
  price: number;
  mrp?: number;
  discountPercent?: number;
  currency: string;
  imageUrl?: string;
  availability?: Availability;
  inStock?: boolean;
  /** How the price was extracted (structured data, meta, store adapter, …). */
  extractionMethod?: string;
  /** True when the parsed offer was bound to the product identity in the
   * requested URL. False means a single priced candidate was accepted without
   * verifiable identity (the page exposed no identity fields). */
  identityVerified?: boolean;
  source: "direct" | "proxy";
  /** Fetch attempts used (1 = no retry). Operational signal only. */
  attempts?: number;
};

export type DealVerdict = "buy_now" | "fair_price" | "wait";

export type BuyAdvice = {
  verdict: DealVerdict;
  headline: string;
  reason: string;
  score: number;
  /** Position of the current price within the observed min–max range (0–100).
   * This is a range position, NOT an empirical percentile. */
  rangePosition: number;
  recentTrend: "falling" | "stable" | "rising";
  recentChangeAmount?: number;
  potentialSavings?: number;
  /** True when there is not yet enough evidence (observation count and span)
   * for a buy recommendation — the advice falls back to a building-history
   * state instead of confident claims. */
  limitedHistory?: boolean;
};

/** In-app target-price alert event. Created only when a genuine scan observes
 * the price crossing from above the target to at-or-below it while the alert
 * is enabled. In-app only — there is no email/push delivery. */
export type AlertEventDocument = {
  _id?: ObjectId;
  productId: ObjectId;
  userId: string;
  target: number;
  observedPrice: number;
  currency: string;
  observedAt: Date;
  readAt?: Date;
  createdAt: Date;
};

/** Serialized alert event for client components. */
export type AlertEventView = {
  id: string;
  productId: string;
  productTitle: string;
  productStoreLabel?: string;
  target: number;
  observedPrice: number;
  currency: string;
  observedAt: string;
  read: boolean;
};

export type PriceStats = {
  sampleCount: number;
  highest?: { price: number; capturedAt: string };
  lowest?: { price: number; capturedAt: string };
  common?: { price: number; occurrences: number; percentage: number };
  current?: { price: number; capturedAt: string };
  mrp?: number;
  savings?: { amount: number; percentage: number };
  changes: {
    count: number;
    averageHoursBetweenChanges?: number;
    averageDaysBetweenChanges?: number;
    description: string;
  };
  advice?: BuyAdvice;
  /** Aggregates over the ENTIRE observed history, not just the display
   * window (latest `HISTORY_WINDOW_LIMIT` samples). */
  fullRange?: {
    sampleCount: number;
    highest?: { price: number; capturedAt: string };
    lowest?: { price: number; capturedAt: string };
  };
};
