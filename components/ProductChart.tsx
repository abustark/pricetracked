"use client";

import { useMemo, useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { ChartRangeTabs } from "@/components/ChartRangeTabs";

export type ChartSample = {
  price: number;
  capturedAt: string;
  source?: "direct" | "proxy";
};

const RANGES = [
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "all", label: "ALL", days: 0 }
] as const;

/**
 * History chart with a client-side range window: switching windows filters
 * the already-loaded snapshots by age, keeping chart state (hover) alive.
 */
export function ProductChart({
  samples,
  currency,
  mrp
}: {
  samples: ChartSample[];
  currency: string;
  mrp?: number;
}) {
  const [rangeId, setRangeId] = useState<string>("all");

  const range = useMemo(
    () => RANGES.find((r) => r.id === rangeId) ?? RANGES[RANGES.length - 1],
    [rangeId]
  );

  const visibleSamples = useMemo(() => {
    if (range.days === 0) return samples;
    const cutoff = Date.now() - range.days * 24 * 60 * 60 * 1000;
    return samples.filter((sample) => new Date(sample.capturedAt).getTime() >= cutoff);
  }, [samples, range]);

  return (
    <>
      <ChartRangeTabs ranges={[...RANGES]} value={rangeId} onChange={setRangeId} />
      <PriceChart samples={visibleSamples} currency={currency} mrp={mrp} />
    </>
  );
}
