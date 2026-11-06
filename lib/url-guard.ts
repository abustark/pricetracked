/**
 * Server-only fetch-target guard. `lib/stores.ts` stays isomorphic (it is
 * imported by client components) — anything needing `node:dns` lives here.
 */
import { lookup } from "node:dns/promises";
import { assertNoUrlCredentials, assertWebProtocol, isSafePublicHostname } from "@/lib/stores";

/**
 * Validate a URL is safe to fetch server-side:
 * web protocol only, no embedded credentials, public hostname, and — via DNS
 * resolution — every resolved address must itself be a public IP. This closes
 * the numeric-hostname and DNS-rebinding gaps that string checks alone cannot.
 *
 * Known limitation: without connection-level IP pinning a determined rebinding
 * attack can still race between validation and fetch (TOCTOU). Accepted and
 * documented; do not remove this check.
 */
export async function assertSafeFetchTarget(input: string): Promise<void> {
  const url = new URL(input);
  assertWebProtocol(url);
  assertNoUrlCredentials(url);

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!isSafePublicHostname(hostname)) {
    throw new Error("This product URL does not point to a public store host.");
  }

  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve this product host.");
  }

  if (!records || records.length === 0) {
    throw new Error("Could not resolve this product host.");
  }

  for (const record of records) {
    if (!isSafePublicHostname(record.address)) {
      throw new Error("This product host resolves to a non-public address.");
    }
  }
}
