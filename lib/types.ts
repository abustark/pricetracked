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
