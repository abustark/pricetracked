import { fetchProductSnapshot } from "@/lib/scanner";
import type { ScanResult, StoreKey } from "@/lib/types";

export type DropCandidate = { name: string; store: StoreKey; url: string };
export type DropItem = {
  name: string;
  store: StoreKey;
  url: string;
  price: number;
  mrp?: number;
  drop?: string;
};

/** Rotation window: same 3 drops per browser for 6h from first open. */
export const DROPS_WINDOW_MS = 6 * 60 * 60 * 1000;
export const DROPS_COOKIE = "pricetracked-drops";

const FETCH_TIMEOUT_MS = 8000;
const MAX_TRIES = 5;

/**
 * Famous products under ₹1,00,000 — real product-page URLs verified via web
 * search (Sep 2026). Prices are never hardcoded here; they are scanned live
 * from the store page when a new window opens.
 */
export const DROP_POOL: DropCandidate[] = [
  { name: "iPhone 16", store: "amazon", url: "https://www.amazon.in/iPhone-16-128-GB-Control/dp/B0DGJHBX5Y" },
  { name: "Nord CE4 Lite", store: "amazon", url: "https://www.amazon.in/OnePlus-Super-Silver-128GB-Storage/dp/B0D5YCYS1G" },
  { name: "WH-1000XM5", store: "amazon", url: "https://www.amazon.in/Sony-WH-1000XM5-Cancelling-Headphones-Connectivity/dp/B0BZP2H373" },
  { name: "JBL 770NC", store: "amazon", url: "https://www.amazon.in/JBL-Tune-770NC-Lightweight-Comfortable/dp/B0CTB1BM3P" },
  { name: "boAt Rockerz 450", store: "amazon", url: "https://www.amazon.in/Rockerz-450-Wireless-Bluetooth-Headphone/dp/B07PR1CL3S" },
  { name: "Amazfit Bip 6", store: "amazon", url: "https://www.amazon.in/Amazfit-Battery-Bluetooth-Water-Resistance-Charcoal/dp/B0DYJKWLV8" },
  { name: "Galaxy S25 FE", store: "flipkart", url: "https://www.flipkart.com/samsung-galaxy-s25-fe-5g-navy-128-gb/p/itm7c78f4eee8160" },
  { name: "Galaxy S25", store: "flipkart", url: "https://www.flipkart.com/samsung-s25-5g-silver-shadow-256-gb/p/itmab25415a98d9f" },
  { name: "IdeaPad Slim 3", store: "flipkart", url: "https://www.flipkart.com/lenovo-intel-core-i5-13th-gen-13420h-16-gb-512-gb-ssd-windows-11-home-83em0023in-laptop/p/itmf7d627b58c63f" },
  { name: "Adidas Advantage", store: "myntra", url: "https://www.myntra.com/sports-shoes/adidas/adidas-advantage-20-men-lace-ups-running-sports-shoes/39282607/buy" },
  { name: "Nike Interact Run", store: "myntra", url: "https://www.myntra.com/sports-shoes/nike/nike-men-interact-run-road-running-shoes/25503846/buy" },
  { name: "Nike Pegasus Plus", store: "myntra", url: "https://www.myntra.com/sports-shoes/nike/-nike-pegasus-plus-road-running-shoes/30061975/buy" },
  { name: "Levi's 511", store: "myntra", url: "https://www.myntra.com/jeans/levis/levis-men-redloop-511-slim-fit-mid-rise-light-fade-stretchable-jeans/32285562/buy" },
  { name: "Levi's 501", store: "myntra", url: "https://www.myntra.com/jeans/levis/levis-mens-501-light-blue-straight-fit-mid-rise-jeans/39381582/buy" }
];

type CachedDrops = { items: DropItem[]; fetchedAt: number };
const cache = new Map<string, CachedDrops>();

/** Deterministic shuffle seeded by the window start → same picks on refresh. */
function orderedCandidates(windowStart: number): DropCandidate[] {
  let seed = windowStart >>> 0;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const pool = [...DROP_POOL];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export async function getRecentDrops(windowStart: number): Promise<DropItem[]> {
  const key = String(windowStart);
  const windowEnd = windowStart + DROPS_WINDOW_MS;
  const hit = cache.get(key);

  if (hit && hit.items.length > 0 && Date.now() < windowEnd) return hit.items;
  if (hit && hit.items.length === 0 && Date.now() - hit.fetchedAt < 60_000) return [];

  const items = await scanDrops(windowStart);
  cache.set(key, { items, fetchedAt: Date.now() });
  if (cache.size > 100) {
    for (const [k, entry] of cache) {
      if (entry.fetchedAt + DROPS_WINDOW_MS < Date.now()) cache.delete(k);
    }
  }
  return items;
}

async function scanDrops(windowStart: number): Promise<DropItem[]> {
  const ordered = orderedCandidates(windowStart);
  const items: DropItem[] = [];
  let index = 0;

  while (items.length < 3 && index < ordered.length && index < MAX_TRIES) {
    const batch = ordered.slice(index, index + Math.min(3 - items.length, MAX_TRIES - index));
    index += batch.length;
    const results = await Promise.allSettled(
      batch.map((candidate) => withTimeout(fetchProductSnapshot(candidate.url), FETCH_TIMEOUT_MS))
    );

    results.forEach((result, i) => {
      if (items.length >= 3) return;
      if (result.status === "fulfilled" && result.value?.price) {
        items.push(toDropItem(batch[i], result.value));
      }
    });
  }

  return items;
}

function toDropItem(candidate: DropCandidate, snapshot: ScanResult): DropItem {
  const price = Math.round(snapshot.price);
  const mrp = snapshot.mrp && snapshot.mrp > price ? Math.round(snapshot.mrp) : undefined;
  const drop = snapshot.discountPercent
    ? `▼ ${snapshot.discountPercent}%`
    : mrp
      ? `▼ ₹${(mrp - price).toLocaleString("en-IN")}`
      : undefined;
  return { name: candidate.name, store: candidate.store, url: candidate.url, price, mrp, drop };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Drop fetch timed out.")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}
