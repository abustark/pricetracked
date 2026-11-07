import type { StoreKey } from "@/lib/types";

const STORE_HOSTS: Record<Exclude<StoreKey, "other">, string[]> = {
  amazon: ["amazon.in", "www.amazon.in", "smile.amazon.in"],
  flipkart: ["flipkart.com", "www.flipkart.com"],
  myntra: ["myntra.com", "www.myntra.com"],
  ajio: ["ajio.com", "www.ajio.com"]
};

const SHORT_LINK_HOSTS: Partial<Record<Exclude<StoreKey, "other">, string[]>> = {
  amazon: ["amzn.in", "amzn.to", "a.co"],
  flipkart: ["fkrt.it", "dl.flipkart.com", "dl.dl.flipkart.com"],
  ajio: ["ajiio.in"]
};

const KEEP_PARAMS = new Set([
  "affExtParam1",
  "affExtParam2",
  "affid",
  "asin",
  "lid",
  "marketplace",
  "pid",
  "psc",
  "sku",
  "tag",
  "th",
  "variant"
].map((key) => key.toLowerCase()));

/** Return a known adapter, or the generic ecommerce adapter for any public domain. */
export function detectStore(input: string): StoreKey | null {
  try {
    const url = new URL(input);
    if (!isSafePublicHostname(url.hostname)) return null;
    const hostname = normalizeHostname(url.hostname);
    const match = Object.entries(STORE_HOSTS).find(([, hosts]) => hosts.includes(hostname));
    if (match) return match[0] as StoreKey;
    const isShortLink = Object.values(SHORT_LINK_HOSTS).some((hosts) => hosts?.includes(hostname));
    return isShortLink ? null : "other";
  } catch {
    return null;
  }
}

export function detectShortLinkStore(input: string): Exclude<StoreKey, "other"> | null {
  try {
    const url = new URL(input);
    const hostname = normalizeHostname(url.hostname);
    const match = Object.entries(SHORT_LINK_HOSTS).find(([, hosts]) => hosts?.includes(hostname));
    return match?.[0] as Exclude<StoreKey, "other"> | null;
  } catch {
    return null;
  }
}

export async function resolveSupportedProductUrl(input: string): Promise<string> {
  const url = new URL(input);
  assertWebProtocol(url);
  assertNoUrlCredentials(url);

  const directStore = detectStore(input);
  if (directStore) {
    return canonicalizeStoreUrl(input, directStore);
  }

  const shortLinkStore = detectShortLinkStore(input);
  if (!shortLinkStore) {
    throw new Error("Paste a public product link from any ecommerce store.");
  }

  const resolvedUrl = await followKnownShortLink(input);
  const resolvedStore = detectStore(resolvedUrl);
  if (!resolvedStore || (resolvedStore !== shortLinkStore && resolvedStore !== "other")) {
    throw new Error("The short link did not resolve to a supported ecommerce product page.");
  }

  return canonicalizeStoreUrl(resolvedUrl, resolvedStore);
}

export function normalizeProductUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";

  [...url.searchParams.keys()].forEach((key) => {
    if (!KEEP_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  });

  const store = detectStore(url.toString());
  return store ? canonicalizeStoreUrl(url.toString(), store) : url.toString();
}

export function assertAllowedProductUrl(input: string): { store: StoreKey; normalizedUrl: string } {
  const url = new URL(input);
  assertWebProtocol(url);
  assertNoUrlCredentials(url);

  const store = detectStore(input);
  if (!store) {
    throw new Error("Paste a public product link from any ecommerce store.");
  }

  return { store, normalizedUrl: normalizeProductUrl(input) };
}

/** Only intended web protocols may be fetched. */
export function assertWebProtocol(url: URL): void {
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Only http and https product links are supported.");
  }
}

/** Reject URLs with embedded credentials (`user:pass@host`) outright. */
export function assertNoUrlCredentials(url: URL): void {
  if (url.username || url.password) {
    throw new Error("Product URLs with embedded credentials are not supported.");
  }
}

export function getStoreLabel(store: StoreKey, url?: string, storedLabel?: string): string {
  if (storedLabel) return storedLabel;
  if (store === "amazon") return "Amazon";
  if (store === "flipkart") return "Flipkart";
  if (store === "myntra") return "Myntra";
  if (store === "ajio") return "AJIO";

  try {
    return new URL(url || "").hostname.replace(/^www\./i, "");
  } catch {
    return "Online store";
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^m\./, "www.");
}

export function canonicalizeStoreUrl(input: string, store: StoreKey): string {
  const url = new URL(input);
  url.protocol = "https:";

  if (store === "flipkart") {
    url.hostname = "www.flipkart.com";
  }

  if (store === "amazon" && url.hostname.toLowerCase() === "amazon.in") {
    url.hostname = "www.amazon.in";
  }

  url.hash = "";
  return url.toString();
}

/**
 * String-level safety check for a hostname OR a literal IP address.
 * Rejects localhost/link-local site names and every private, loopback,
 * link-local, CGNAT, benchmark, multicast or reserved IPv4/IPv6 form,
 * including numeric encodings (decimal `2130706433`, hex `0x7f000001`,
 * octal `0177.0.0.1`) and IPv4-mapped IPv6. Fails closed on malformed
 * numeric hosts. This alone is NOT a complete SSRF defence — pair it with
 * DNS resolution checks (lib/url-guard.ts) before fetching.
 */
export function isSafePublicHostname(hostname: string): boolean {
  const value = hostname.toLowerCase().trim().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (!value) return false;
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local") || value.endsWith(".internal") || value.endsWith(".home.arpa")) {
    return false;
  }

  // IPv6 literal (URL.hostname keeps brackets stripped here via the replace above,
  // and a raw hostname can still contain colons).
  if (value.includes(":")) return isSafePublicIpv6(value);

  // Dotted-quad IPv4 literal (incl. hex/octal octet encodings, e.g.
  // 8.8.8.8 or 0x7f.0.0.1) — classify it properly.
  if (isIpv4Like(value)) return isSafePublicIpv4(value);

  // Any other purely numeric host — decimal/hex single-integer encodings
  // (2130706433, 0x7f000001) or short 1–3-part numeric forms — is never a
  // store hostname. A public store hostname always contains a letter.
  if (/^0x[0-9a-f]+$/.test(value) || !/[a-z]/.test(value)) return false;

  return true;
}

function isIpv4Like(value: string): boolean {
  const parts = value.split(".");
  if (parts.length === 4) {
    return parts.every((part) => /^\d+$/.test(part) || /^0x[0-9a-f]+$/i.test(part));
  }
  // Legacy 1–3 part numeric forms (a, a.b, a.b.c) — never valid store hosts.
  return false;
}

function parseIpPart(part: string): number | null {
  if (/^0x[0-9a-f]+$/i.test(part)) {
    const parsed = parseInt(part, 16);
    return Number.isFinite(parsed) && parsed <= 255 ? parsed : null;
  }
  if (/^0\d+$/.test(part)) {
    const parsed = parseInt(part, 8); // octal form, e.g. 0177 = 127
    return Number.isFinite(parsed) && parsed <= 255 ? parsed : null;
  }
  const parsed = Number(part);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255 ? parsed : null;
}

function isSafePublicIpv4(value: string): boolean {
  const parts = value.split(".");
  let octets: number[];

  if (parts.length === 4) {
    const parsed = parts.map(parseIpPart);
    // Malformed numeric components (overflowing octet, bad hex/octal) fail closed.
    if (parsed.some((octet) => octet === null)) return false;
    octets = parsed as number[];
  } else {
    return false; // unreachable — isIpv4Like gated above; kept for safety
  }

  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false; // this-network, private, loopback
  if (a === 169 && b === 254) return false; // link-local
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0 && c === 0) return false; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  if (a >= 224) return false; // multicast (224-239), reserved, broadcast (255)
  return true;
}

function isSafePublicIpv6(value: string): boolean {
  const v = value.toLowerCase();
  if (v === "::" || v === "::1") return false; // unspecified, loopback

  // IPv4-mapped / IPv4-compatible (::ffff:a.b.c.d) — treat fail-closed.
  if (v.includes("::ffff:")) return false;
  const embeddedV4 = v.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (embeddedV4) return false;

  // link-local fe80::/10, unique-local fc00::/7, multicast ff00::/8
  if (/^fe[89ab]/.test(v)) return false;
  if (/^f[cd]/.test(v)) return false;
  if (/^ff/.test(v)) return false;

  // documentation 2001:db8::/32, 6to4 2002::/16 (embeds arbitrary IPv4), Teredo 2001::/32
  if (v.startsWith("2001:db8:")) return false;
  if (v.startsWith("2002:")) return false;
  if (v.startsWith("2001:0:")) return false;

  // Only global unicast (first hextet 2xxx/3xxx, minus the blocks above) passes.
  const firstHextet = v.split(":")[0];
  if (!/^[23][0-9a-f]{3}$/.test(firstHextet)) return false;

  return true;
}

async function followKnownShortLink(input: string): Promise<string> {
  let current = input;

  for (let hop = 0; hop < 5; hop += 1) {
    assertSafeShortLinkHop(current);

    let response = await fetchRedirect(current, "HEAD");

    // Some shorteners reject HEAD; retry the same hop with GET (still manual).
    if (!isRedirectStatus(response.status)) {
      response = await fetchRedirect(current, "GET");
    }

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      if (!location) break;
      current = new URL(location, current).toString();
      if (detectStore(current)) return current;
      if (!detectShortLinkStore(current)) break;
      continue;
    }

    break;
  }

  if (detectStore(current)) return current;

  throw new Error("Could not resolve this short link. Paste the final product URL if the short link fails.");
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function assertSafeShortLinkHop(input: string): void {
  const url = new URL(input);
  assertWebProtocol(url);
  assertNoUrlCredentials(url);
  if (!isSafePublicHostname(url.hostname)) {
    throw new Error("The short link redirected to a non-public host.");
  }
}

async function fetchRedirect(input: string, method: "GET" | "HEAD") {
  try {
    return await fetch(input, {
      method,
      redirect: "manual",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-IN,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
      },
      cache: "no-store"
    });
  } catch {
    if (method === "HEAD") {
      return fetchRedirect(input, "GET");
    }
    throw new Error("Could not resolve this short link. Paste the final product URL if the short link fails.");
  }
}
