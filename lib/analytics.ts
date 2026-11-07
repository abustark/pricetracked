import type { PriceSampleDocument, PriceStats } from "@/lib/types";

/** Sources produced by real scans. Synthetic legacy sources are never analysed. */
export const OBSERVED_SOURCES = ["direct", "proxy"] as const;

export type ObservedSource = (typeof OBSERVED_SOURCES)[number];

export type ObservedSample = PriceSampleDocument & { source: ObservedSource };

export function isObservedSample<T extends PriceSampleDocument>(
  sample: T
): sample is T & { source: ObservedSource } {
  return (OBSERVED_SOURCES as readonly string[]).includes(sample.source);
}

/**
 * Keep only genuine observations for analysis. Mixed currencies are never averaged
 * together; samples matching the latest observed currency win.
 */
export function selectObservedSamples(samples: PriceSampleDocument[]): ObservedSample[] {
  const observed = samples.filter(isObservedSample);
  if (observed.length <= 1) return observed;
  const latestCurrency = observed[observed.length - 1].currency;
  return observed.filter((sample) => sample.currency === latestCurrency);
}

export function calculatePriceStats(samples: PriceSampleDocument[], mrp?: number): PriceStats {
  const sorted = selectObservedSamples(samples).sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

  if (sorted.length === 0) {
    return {
      sampleCount: 0,
      mrp,
      changes: {
        count: 0,
        description: "No price history yet"
      }
    };
  }

  const highest = sorted.reduce((best, item) => (item.price > best.price ? item : best), sorted[0]);
  const lowest = sorted.reduce((best, item) => (item.price < best.price ? item : best), sorted[0]);
  const current = sorted[sorted.length - 1];

  const effectiveMrp = mrp && mrp > current.price ? mrp : undefined;
  const savings = effectiveMrp
    ? {
        amount: effectiveMrp - current.price,
        percentage: Math.round(((effectiveMrp - current.price) / effectiveMrp) * 100)
      }
    : undefined;

  const counts = new Map<number, number>();
  sorted.forEach((sample) => {
    counts.set(sample.price, (counts.get(sample.price) || 0) + 1);
  });

  const [commonPrice, commonCount] = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] - b[0];
  })[0];

  const changedAt: Date[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].price !== sorted[index - 1].price) {
      changedAt.push(sorted[index].capturedAt);
    }
  }

  const intervals = changedAt
    .slice(1)
    .map((date, index) => date.getTime() - changedAt[index].getTime())
    .filter((value) => value > 0);

  const averageMs =
    intervals.length > 0 ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : undefined;
  const averageHours = averageMs ? averageMs / (1000 * 60 * 60) : undefined;
  const averageDays = averageHours ? averageHours / 24 : undefined;

  const advice = generateBuyAdvice({
    sorted,
    highest,
    lowest,
    current,
    commonPrice,
    effectiveMrp,
    averageDays
  });

  return {
    sampleCount: sorted.length,
    highest: {
      price: highest.price,
      capturedAt: highest.capturedAt.toISOString()
    },
    lowest: {
      price: lowest.price,
      capturedAt: lowest.capturedAt.toISOString()
    },
    common: {
      price: commonPrice,
      occurrences: commonCount,
      percentage: Math.round((commonCount / sorted.length) * 100)
    },
    current: {
      price: current.price,
      capturedAt: current.capturedAt.toISOString()
    },
    mrp: effectiveMrp,
    savings,
    changes: {
      count: changedAt.length,
      averageHoursBetweenChanges: averageHours ? Math.round(averageHours * 10) / 10 : undefined,
      averageDaysBetweenChanges: averageDays ? Math.round(averageDays * 10) / 10 : undefined,
      description: describeChangeFrequency(changedAt.length, averageHours)
    },
    advice
  };
}

function generateBuyAdvice({
  sorted,
  highest,
  lowest,
  current,
  commonPrice,
  effectiveMrp,
  averageDays
}: {
  sorted: ObservedSample[];
  highest: ObservedSample;
  lowest: ObservedSample;
  current: ObservedSample;
  commonPrice: number;
  effectiveMrp?: number;
  averageDays?: number;
}) {
  if (sorted.length <= 1) {
    return {
      verdict: "fair_price" as const,
      headline: "Gathering Baseline",
      reason: "Tracking just began. Additional scans will detect upcoming price drops and seasonal sales.",
      score: 60,
      percentile: 50,
      recentTrend: "stable" as const
    };
  }

  // Recent trend detection
  let prevPrice = current.price;
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].price !== current.price) {
      prevPrice = sorted[i].price;
      break;
    }
  }

  const diff = current.price - prevPrice;
  const recentTrend: "falling" | "stable" | "rising" =
    diff < 0 ? "falling" : diff > 0 ? "rising" : "stable";
  const recentChangeAmount = Math.abs(diff);

  const range = highest.price - lowest.price;
  const percentile =
    range <= 0 ? 50 : Math.max(0, Math.min(100, Math.round(((current.price - lowest.price) / range) * 100)));

  // Calculate composite score (0 - 100)
  let score = 100 - percentile;

  if (current.price <= lowest.price) {
    score = Math.max(score, sorted.length > 2 ? 96 : 90);
  } else if (current.price <= commonPrice) {
    score = Math.max(score, 68);
  }

  if (effectiveMrp && effectiveMrp > current.price) {
    const discountRatio = (effectiveMrp - current.price) / effectiveMrp;
    if (discountRatio >= 0.25) score += 6;
  }

  if (recentTrend === "falling") score += 4;
  if (recentTrend === "rising") score -= 6;

  score = Math.max(10, Math.min(99, Math.round(score)));

  let verdict: "buy_now" | "fair_price" | "wait";
  if (score >= 75 || current.price <= lowest.price) {
    verdict = "buy_now";
  } else if (score >= 48) {
    verdict = "fair_price";
  } else {
    verdict = "wait";
  }

  const potentialSavings =
    current.price > lowest.price
      ? current.price - lowest.price
      : effectiveMrp && effectiveMrp > current.price
      ? effectiveMrp - current.price
      : 0;

  let headline = "";
  let reason = "";

  if (verdict === "buy_now") {
    if (current.price <= lowest.price) {
      headline = "Best Time to Buy — All-Time Low";
      reason = `Currently at the lowest price ever observed in tracking history (${formatPrice(current.price)}).`;
    } else {
      headline = "Great Deal — Near Historical Low";
      reason = `In the bottom ${Math.max(10, percentile)}% of observed prices, substantially below the high of ${formatPrice(highest.price)}.`;
    }
  } else if (verdict === "fair_price") {
    headline = "Fair Price — Typical Market Range";
    reason = `Matches typical selling price of ${formatPrice(commonPrice)}. Fair purchase if needed right away, or set a target alert for extra discounts.`;
  } else {
    headline = "Wait for Drop — Above Typical Price";
    reason = `Currently near peak recorded price (${formatPrice(highest.price)}). Waiting for a drop or setting an alert is recommended.${
      averageDays ? ` Prices historically adjust every ~${Math.round(averageDays)} days.` : ""
    }`;
  }

  return {
    verdict,
    headline,
    reason,
    score,
    percentile,
    recentTrend,
    recentChangeAmount: recentChangeAmount > 0 ? recentChangeAmount : undefined,
    potentialSavings: potentialSavings > 0 ? potentialSavings : undefined
  };
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function describeChangeFrequency(changeCount: number, averageHours?: number): string {
  if (changeCount === 0) return "No price changes observed yet";
  if (!averageHours) return "Changed once in the tracked history";
  if (averageHours < 24) return `Changes about every ${Math.round(averageHours)} hours`;
  return `Changes about every ${Math.round((averageHours / 24) * 10) / 10} days`;
}
