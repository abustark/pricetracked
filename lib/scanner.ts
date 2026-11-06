import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { assertAllowedProductUrl, canonicalizeStoreUrl, detectStore, getStoreLabel, resolveSupportedProductUrl } from "@/lib/stores";
import type { PriceSampleDocument, ProductDocument, ScanResult, StoreKey } from "@/lib/types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 18000;
const MAX_ATTEMPTS = 3;

type ParsedProduct = {
  title: string;
  price?: number;
  mrp?: number;
  discountPercent?: number;
  currency: string;
  imageUrl?: string;
  inStock?: boolean;
};

type ProxyConfig = {
  endpoint?: string;
  token?: string;
  urlParam: string;
  tokenParam?: string;
  authHeader?: string;
};

export async function fetchProductSnapshot(url: string): Promise<ScanResult> {
  const { store } = assertAllowedProductUrl(url);
  const canonicalUrl = canonicalizeStoreUrl(url, store);
  let directError: unknown;

  try {
    const direct = await fetchHtml(canonicalUrl, store, "direct");
    const parsed = parseProductHtml(direct.html, store);
    if (parsed.price) {
      return {
        ...parsed,
        price: parsed.price,
        mrp: parsed.mrp,
        discountPercent: parsed.discountPercent,
        source: direct.source
      };
    }
  } catch (error) {
    directError = error;
  }

  if (process.env.SCRAPER_PROXY_ENDPOINT) {
    try {
      const proxy = await fetchHtml(canonicalUrl, store, "proxy");
      const proxyParsed = parseProductHtml(proxy.html, store);
      if (proxyParsed.price) {
        return {
          ...proxyParsed,
          price: proxyParsed.price,
          mrp: proxyParsed.mrp,
          discountPercent: proxyParsed.discountPercent,
          source: proxy.source
        };
      }
    } catch {
    }
  }

  throw buildUserFacingScanError(store, directError);
}

export async function scanAndSaveProduct(inputUrl: string, userId?: string): Promise<ProductDocument> {
  const resolvedUrl = await resolveSupportedProductUrl(inputUrl);
  const { store, normalizedUrl } = assertAllowedProductUrl(resolvedUrl);
  const canonicalUrl = canonicalizeStoreUrl(normalizedUrl, store);
  const snapshot = await fetchProductSnapshot(canonicalUrl);
  const db = await getDb();
  const now = new Date();

  const existing = await db.collection<ProductDocument>("products").findOne({ normalizedUrl: canonicalUrl, userId });
  const productId = existing?._id || new ObjectId();

  const productUpdate: Omit<ProductDocument, "_id" | "createdAt"> = {
    url: canonicalUrl,
    normalizedUrl: canonicalUrl,
    userId,
    store,
    storeLabel: getStoreLabel(store, canonicalUrl, existing?.storeLabel),
    title: snapshot.title,
    imageUrl: snapshot.imageUrl,
    currency: snapshot.currency,
    active: true,
    scanEveryHours: existing?.scanEveryHours || 6,
    nextScanAt: new Date(now.getTime() + (existing?.scanEveryHours || 6) * 60 * 60 * 1000),
    lastScannedAt: now,
    lastPrice: snapshot.price,
    mrp: snapshot.mrp || existing?.mrp,
    discountPercent: snapshot.discountPercent || existing?.discountPercent,
    targetPrice: existing?.targetPrice,
    targetPriceReached:
      existing?.targetPrice != null && snapshot.price != null
        ? snapshot.price <= existing.targetPrice
        : existing?.targetPriceReached,
    targetAlertEnabled: existing?.targetAlertEnabled,
    updatedAt: now
  };

  await db.collection<ProductDocument>("products").updateOne(
    { _id: productId },
    {
      $set: productUpdate,
      $unset: { lastError: "" },
      $setOnInsert: {
        _id: productId,
        createdAt: now
      }
    },
    { upsert: true }
  );

  await db.collection<PriceSampleDocument>("price_samples").insertOne({
    productId,
    price: snapshot.price,
    currency: snapshot.currency,
    inStock: snapshot.inStock,
    source: snapshot.source,
    capturedAt: now,
    createdAt: now
  });

  return {
    _id: productId,
    createdAt: existing?.createdAt || now,
    ...productUpdate
  };
}

export async function scanDueProducts(limit = 20) {
  const db = await getDb();
  const now = new Date();
  const products = await db
    .collection<ProductDocument>("products")
    .find({
      active: true,
      nextScanAt: { $lte: now },
      userId: { $exists: true, $nin: ["", "guest"] }
    })
    .sort({ nextScanAt: 1 })
    .limit(limit)
    .toArray();

  const results = [];
  for (const product of products) {
    try {
      const updated = await scanAndSaveProduct(product.normalizedUrl, product.userId);
      results.push({ id: updated._id?.toString(), ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scan error";
      await db.collection<ProductDocument>("products").updateOne(
        { _id: product._id },
        {
          $set: {
            lastError: message,
            nextScanAt: new Date(now.getTime() + product.scanEveryHours * 60 * 60 * 1000),
            updatedAt: now
          }
        }
      );
      results.push({ id: product._id?.toString(), ok: false, error: message });
    }
  }

  return results;
}

async function fetchHtml(
  url: string,
  store: StoreKey,
  mode: "direct" | "proxy"
): Promise<{ html: string; source: "direct" | "proxy" }> {
  const proxyConfig = getProxyConfig();
  let target = mode === "proxy" ? buildProxyUrl(url, proxyConfig) : url;
  let lastError: unknown;
  let redirects = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(target, {
        redirect: mode === "direct" ? "manual" : "follow",
        headers: {
          ...buildBrowserHeaders(store, target),
          ...buildProxyHeaders(proxyConfig)
        },
        cache: "no-store"
      });

      if (mode === "direct" && isRedirect(response.status)) {
        redirects += 1;
        if (redirects > 5) throw new Error("The store returned too many redirects.");
        target = followSafeRedirect(target, response, store);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Store request failed with HTTP ${response.status}`);
      }

      const html = await response.text();
      if (looksBlocked(html)) {
        throw new Error("The store returned a bot-check or blocked response instead of the product page.");
      }

      return { html, source: mode };
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || attempt === MAX_ATTEMPTS) break;
      await sleep(350 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Product page fetch failed.");
}

function getProxyConfig(): ProxyConfig {
  return {
    endpoint: process.env.SCRAPER_PROXY_ENDPOINT,
    token: process.env.SCRAPER_PROXY_TOKEN,
    urlParam: process.env.SCRAPER_PROXY_URL_PARAM || "url",
    tokenParam: process.env.SCRAPER_PROXY_TOKEN_PARAM || "token",
    authHeader: process.env.SCRAPER_PROXY_AUTH_HEADER
  };
}

function buildProxyUrl(url: string, config: ProxyConfig): string {
  if (!config.endpoint) return url;

  const proxy = new URL(config.endpoint);
  proxy.searchParams.set(config.urlParam, url);
  if (config.token && config.tokenParam && !config.authHeader) {
    proxy.searchParams.set(config.tokenParam, config.token);
  }

  return proxy.toString();
}

function buildProxyHeaders(config: ProxyConfig): Record<string, string> {
  if (!config.token || !config.authHeader) return {};
  return { [config.authHeader]: config.token };
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildBrowserHeaders(store: StoreKey, url: string): Record<string, string> {
  const origin = new URL(url).origin;
  return {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-IN,en-US;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache",
    priority: "u=0, i",
    referer: store === "flipkart" ? "https://www.flipkart.com/" : origin,
    "sec-ch-ua": "\"Chromium\";v=\"125\", \"Google Chrome\";v=\"125\", \"Not.A/Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": USER_AGENT
  };
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function followSafeRedirect(currentUrl: string, response: Response, store: StoreKey): string {
  const location = response.headers.get("location");
  if (!location) {
    throw new Error("The store redirected without a destination URL.");
  }

  const nextUrl = new URL(location, currentUrl).toString();
  const nextStore = detectStore(nextUrl);
  if (nextStore !== store) {
    throw new Error("The product URL redirected away from the supported store.");
  }

  return canonicalizeStoreUrl(nextUrl, store);
}

function looksBlocked(html: string): boolean {
  // Real blocked / challenge pages are tiny (< 50KB) and have captcha in the <title> or <h1>
  if (html.length > 50000) return false;
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").toLowerCase();
  return /robot check|captcha|access denied|request blocked|unusual traffic|are you a human/i.test(title) ||
    /<h1>\s*(?:access denied|blocked|captcha)\s*<\/h1>/i.test(html);
}

function isRetryableFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|network|timeout|aborted|econnreset|etimedout|tls|ssl|handshake|internal error|HTTP 429|HTTP 500|HTTP 502|HTTP 503|HTTP 504/i.test(
    message
  );
}

function buildUserFacingScanError(store: StoreKey, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error || "");
  const isTls = /tls|ssl|handshake|ssl3_read_bytes|alert internal error|fetch failed/i.test(message);

  if (store === "flipkart" && isTls) {
    return new Error(
      "Flipkart blocked the direct secure connection. Configure SCRAPER_PROXY_ENDPOINT in .env.local for reliable scans."
    );
  }

  if (store === "flipkart") {
    return new Error(
      "Could not read the Flipkart product price. Paste the final www.flipkart.com product URL, or configure SCRAPER_PROXY_ENDPOINT if Flipkart blocks requests."
    );
  }

  if (store === "amazon" && isTls) {
    return new Error(
      "Amazon blocked the direct connection. Configure SCRAPER_PROXY_ENDPOINT for reliable scans."
    );
  }

  if (store === "myntra" && isTls) {
    return new Error(
      "Myntra blocked the direct connection. Configure SCRAPER_PROXY_ENDPOINT for reliable scans."
    );
  }

  if (store === "ajio" && isTls) {
    return new Error(
      "Ajio blocked the direct connection. Configure SCRAPER_PROXY_ENDPOINT for reliable scans."
    );
  }

  if (/blocked|denied|robot|captcha|403|429/i.test(message)) {
    return new Error("The store blocked this request. Configure SCRAPER_PROXY_ENDPOINT to bypass.");
  }

  return new Error("Could not read this product price. The store may have blocked the request or changed its page format.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseProductHtml(html: string, store: StoreKey): ParsedProduct {
  const jsonLd = parseJsonLd(html);
  const meta = parseMeta(html);
  const title = cleanText(jsonLd.title || meta.title || extractTitle(html) || "Tracked product");
  const price = jsonLd.price || meta.price || parseStoreSpecificPrice(html, store) || parseVisiblePrice(html);
  const mrp = jsonLd.mrp || parseStoreSpecificMrp(html, store);
  const currency = normalizeCurrency(jsonLd.currency || meta.currency || "INR");
  const imageUrl = jsonLd.imageUrl || meta.imageUrl;

  const discountPercent = mrp && price && mrp > price
    ? Math.round(((mrp - price) / mrp) * 100)
    : undefined;

  return {
    title,
    price,
    mrp: mrp && price && mrp > price ? mrp : undefined,
    discountPercent,
    currency,
    imageUrl,
    inStock: !/out of stock|currently unavailable|sold out/i.test(html)
  };
}

function parseJsonLd(html: string) {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of matches) {
    const content = decodeHtml(match[1].trim());
    const candidates = parseJsonSafely(content);
    for (const item of flattenJsonLd(candidates)) {
      const type = Array.isArray(item?.["@type"]) ? item["@type"].join(" ") : item?.["@type"];
      if (!/product/i.test(String(type || "")) && !item?.offers) continue;

      const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
      const price = toPrice(offer?.price || offer?.lowPrice || item.price);
      const mrp = toPrice(offer?.highPrice || item?.highPrice || (offer?.price && offer?.lowPrice && offer.price > offer.lowPrice ? offer.price : undefined));
      if (price) {
        return {
          title: item.name,
          price,
          mrp,
          currency: offer?.priceCurrency || item.priceCurrency || "INR",
          imageUrl: Array.isArray(item.image) ? item.image[0] : item.image
        };
      }
    }
  }

  return {};
}

function parseMeta(html: string) {
  const values = new Map<string, string>();
  const tags = html.matchAll(/<meta\b[^>]*>/gi);

  for (const match of tags) {
    const tag = match[0];
    const key = readAttribute(tag, "property") || readAttribute(tag, "name");
    const content = readAttribute(tag, "content");
    if (key && content) values.set(key.toLowerCase(), decodeHtml(content));
  }

  const meta = (name: string) => values.get(name.toLowerCase());
  return {
    title: meta("og:title"),
    price: toPrice(meta("product:price:amount") || meta("og:price:amount")),
    currency: meta("product:price:currency") || meta("og:price:currency") || "INR",
    imageUrl: meta("og:image")
  };
}

function readAttribute(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1];
}

function parseStoreSpecificPrice(html: string, store: StoreKey): number | undefined {
  const decoded = decodeHtml(html);
  const candidates: Array<number | undefined> = [];

  if (store === "flipkart") {
    candidates.push(
      parseFirst(decoded, /class=["'][^"']*(?:_30jeq3|Nx9bqj|CxhGGd|hl05eU|_16Jk6d|yRaY8j)[^"']*["'][^>]*>\s*(?:\u20b9|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i),
      parseFirst(decoded, /"finalPrice"\s*:\s*\{[^{}]*"value"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"sellingPrice"\s*:\s*\{[^{}]*"value"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"discountedPrice"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"price"\s*:\s*([0-9,.]+)\s*,\s*"discount"/i),
      parseFirst(decoded, /"displayAmount"\s*:\s*"?\s*(?:\u20b9|Rs\.?)?\s*([0-9,.]+)"?/i),
      parseFirst(decoded, /"specialPrice"\s*:\s*([0-9,.]+)/i)
    );
  }

  if (store === "amazon") {
    candidates.push(
      parseFirst(decoded, /class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([0-9,]+)\s*</i),
      parseFirst(decoded, /id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>\s*(?:\u20b9|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i),
      parseFirst(decoded, /"priceToPay"\s*:\s*\{[^{}]*"amount"\s*:\s*([0-9,.]+)/i)
    );
  }

  if (store === "myntra") {
    candidates.push(
      parseFirst(decoded, /class=["'][^"']*pdp-price[^"']*["'][^>]*>\s*(?:\u20b9|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i),
      parseFirst(decoded, /"discountedPrice"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"price"\s*:\s*([0-9,.]+)\s*,\s*"discountedPrice"/i)
    );
  }

  if (store === "ajio") {
    candidates.push(
      parseFirst(decoded, /class=["'][^"']*(?:prod-sp|price)[^"']*["'][^>]*>\s*(?:\u20b9|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i),
      parseFirst(decoded, /"wasPriceData"\s*:\s*\{[^{}]*"value"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"price"\s*:\s*\{[^{}]*"formattedValue"[^{}]*(?:\u20b9|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i)
    );
  }

  // The generic adapter handles stores that expose common ecommerce markup but
  // do not have a dedicated adapter. JSON-LD and Open Graph are preferred above.
  if (store === "other") {
    candidates.push(
      parseFirst(decoded, /data-testid=["'][^"']*(?:sale|current|selling)?price[^"']*["'][^>]*>\s*(?:[^0-9]{0,8})?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i),
      parseFirst(decoded, /(?:data-price|data-sale-price|data-current-price)=["']([0-9,.]+)["']/i),
      parseFirst(decoded, /class=["'][^"']*(?:sale-price|current-price|selling-price|product-price|price)[^"']*["'][^>]*>\s*(?:[^0-9]{0,8})([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i),
      parseFirst(decoded, /"(?:salePrice|currentPrice|sellingPrice)"\s*:\s*["']?([0-9,.]+)/i)
    );
  }

  return candidates.find((price) => price && price > 0);
}

function parseStoreSpecificMrp(html: string, store: StoreKey): number | undefined {
  const decoded = decodeHtml(html);
  const candidates: Array<number | undefined> = [];

  if (store === "flipkart") {
    candidates.push(
      parseFirst(decoded, /class=["'][^"']*(?:yRaY8j|_2p6MwQ|cPHDOP)[^"']*["'][^>]*>\s*(?:\u20b9|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i),
      parseFirst(decoded, /"mrp"\s*:\s*\{[^{}]*"value"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"maximumRetailPrice"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"originalPrice"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"strikeOffPrice"\s*:\s*([0-9,.]+)/i)
    );
  }

  if (store === "amazon") {
    candidates.push(
      parseFirst(decoded, /class=["'][^"']*a-text-price[^"']*["'][^>]*>\s*<span[^>]*>(?:\u20b9|Rs\.?)\s*([0-9,]+)/i),
      parseFirst(decoded, /"basisPrice"\s*:\s*\{[^{}]*"amount"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"listPrice"\s*:\s*\{[^{}]*"amount"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /"recommendedRetailPrice"\s*:\s*([0-9,.]+)/i)
    );
  }

  if (store === "myntra") {
    candidates.push(
      parseFirst(decoded, /"mrp"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /class=["'][^"']*pdp-mrp[^"']*["'][^>]*>\s*(?:\u20b9|Rs\.?)\s*([0-9,]+)/i)
    );
  }

  if (store === "ajio") {
    candidates.push(
      parseFirst(decoded, /"wasPriceData"\s*:\s*\{[^{}]*"value"\s*:\s*([0-9,.]+)/i),
      parseFirst(decoded, /class=["'][^"']*orginal-price[^"']*["'][^>]*>\s*(?:\u20b9|Rs\.?)\s*([0-9,]+)/i)
    );
  }

  if (store === "other") {
    candidates.push(
      parseFirst(decoded, /(?:data-mrp|data-original-price|data-list-price)=["']([0-9,.]+)["']/i),
      parseFirst(decoded, /class=["'][^"']*(?:mrp|original-price|list-price|was-price|regular-price|strike)[^"']*["'][^>]*>\s*(?:[^0-9]{0,8})([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)
    );
  }

  return candidates.find((mrp) => mrp && mrp > 0);
}

function parseVisiblePrice(html: string): number | undefined {
  const patterns = [/data-price=["']([0-9,.]+)["']/i, /itemprop=["']price["'][^>]+content=["']([0-9,.]+)["']/i];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const price = toPrice(match?.[1]);
    if (price) return price;
  }

  return undefined;
}

function parseFirst(value: string, pattern: RegExp): number | undefined {
  const match = value.match(pattern);
  return toPrice(match?.[1]);
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]) : undefined;
}

function parseJsonSafely(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function flattenJsonLd(items: unknown[]): any[] {
  const output: any[] = [];
  for (const item of items as any[]) {
    if (Array.isArray(item?.["@graph"])) output.push(...item["@graph"]);
    output.push(item);
  }
  return output;
}

function toPrice(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const price = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

function normalizeCurrency(value: unknown): string {
  const raw = String(value || "INR").trim().toUpperCase();
  if (raw === "₹" || raw === "RS" || raw === "RS.") return "INR";
  if (raw === "$" || raw === "US$") return "USD";
  if (raw === "£") return "GBP";
  if (raw === "€") return "EUR";
  return /^[A-Z]{3}$/.test(raw) ? raw : "INR";
}

function cleanText(value: string): string {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
