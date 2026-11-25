import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Server-bound sign-in state for the custom Google popup flow.
 *
 * The client asks the server for a signed state token before opening Google's
 * consent screen; the token is returned with the authorization code and must
 * verify (HMAC signature + timestamp window + one-time nonce) before the code
 * is exchanged. This binds the login response to the initiating browser
 * transaction — previously the state was generated and checked entirely
 * client-side, so a code captured from any source could be replayed.
 *
 * Replay defence is two-layered: the timestamp window (primary, survives
 * multi-instance serverless deployments) and a per-process used-nonce set
 * (best-effort dedup within one instance).
 */

const REPLAY_WINDOW_MS = 10 * 60 * 1000;

const usedNonces = new Map<string, number>();

function resolveSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? undefined : "pricetracked-local-development-secret");
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return secret;
}

export function issueAuthState(): { state: string } {
  const nonce = randomBytes(16).toString("base64url");
  const issuedAt = Date.now();
  const payload = `${nonce}.${issuedAt}`;
  const signature = createHmac("sha256", resolveSecret()).update(payload).digest("base64url");
  return { state: `${payload}.${signature}` };
}

export function verifyAuthState(state: string): { valid: boolean } {
  const parts = state.split(".");
  if (parts.length !== 3) return { valid: false };

  const [nonce, timestampRaw, signature] = parts;
  const payload = `${nonce}.${timestampRaw}`;
  const expected = createHmac("sha256", resolveSecret()).update(payload).digest("base64url");

  const provided = Buffer.from(signature, "utf8");
  const computed = Buffer.from(expected, "utf8");
  if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
    return { valid: false };
  }

  const issuedAt = Number(timestampRaw);
  if (
    !Number.isFinite(issuedAt) ||
    Date.now() - issuedAt > REPLAY_WINDOW_MS ||
    issuedAt > Date.now() + 60_000 // tolerate small clock skew into the future
  ) {
    return { valid: false };
  }

  if (usedNonces.has(nonce)) return { valid: false };
  usedNonces.set(nonce, Date.now() + REPLAY_WINDOW_MS);
  evictExpiredNonces();
  return { valid: true };
}

function evictExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, expiry] of usedNonces) {
    if (expiry < now) usedNonces.delete(nonce);
  }
}
