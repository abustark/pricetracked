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

export type PriceSampleDocument = {
  _id?: ObjectId;
  productId: ObjectId;
  price: number;
  currency: string;
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
  inStock?: boolean;
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
  percentile: number;
  recentTrend: "falling" | "stable" | "rising";
  recentChangeAmount?: number;
  potentialSavings?: number;
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
};
