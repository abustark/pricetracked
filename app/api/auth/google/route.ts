import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { encode } from "next-auth/jwt";

/**
 * Fast popup sign-in endpoint.
 *
 * Receives the authorization code returned to /auth/google/callback by
 * Google's popup window, exchanges it server-to-server for tokens, verifies
 * the ID token once, then mints a NextAuth-compatible JWT session cookie —
 * the exact same cookie the old OAuth redirect flow issued, so `auth()`,
 * `getViewer()` and existing sessions/watchlists keep working unchanged.
 */

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // matches Auth.js default
const POPUP_REDIRECT_PATH = "/auth/google/callback";

function resolveAuthSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? undefined : "pricetracked-local-development-secret");
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return secret;
}

/**
 * Mirror Auth.js's cookie naming: `defaultCookies(useSecureCookies)` with
 * `useSecureCookies = url.protocol === "https:"` (init.ts). The cookie name
 * doubles as the HKDF salt for JWT encryption — it must match exactly or
 * `auth()` will not decode the cookie we set.
 */
function resolveSessionCookie(): { name: string; secure: boolean } {
  let secure = process.env.NODE_ENV === "production";
  const authUrl = process.env.AUTH_URL;
  if (authUrl) {
    try {
      secure = new URL(authUrl).protocol === "https:";
    } catch {
      // keep the NODE_ENV-derived default
    }
  }
  return {
    name: secure ? "__Secure-authjs.session-token" : "authjs.session-token",
    secure
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code?: string };
    const code = body?.code;
    if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "sign-in is not configured" }, { status: 503 });
    }

    // redirect_uri must byte-match the one sent in the authorization request
    // (the client built it from window.location.origin on this same origin).
    const redirectUri = `${new URL(req.url).origin}${POPUP_REDIRECT_PATH}`;

    // Server-to-server code exchange (client_secret stays on the server).
    const client = new OAuth2Client(clientId, clientSecret, redirectUri);
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      return NextResponse.json({ error: "no id_token in exchange" }, { status: 401 });
    }

    // One verification: signature, issuer, expiry, audience.
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }

    // Same default token shape Auth.js builds on OAuth sign-in
    // ({ name, email, picture, sub: user.id }) — for Google user.id ===
    // profile.sub, so identity and existing watchlists carry over unchanged.
    const token = {
      name: payload.name ?? null,
      email: payload.email,
      picture: payload.picture ?? null,
      sub: payload.sub
    };

    const cookie = resolveSessionCookie();
    const encoded = await encode({
      token,
      secret: resolveAuthSecret(),
      salt: cookie.name,
      maxAge: SESSION_MAX_AGE
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookie.name, encoded, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookie.secure,
      path: "/",
      maxAge: SESSION_MAX_AGE
    });
    return response;
  } catch (error) {
    console.warn(
      "[auth/google] sign-in rejected:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "invalid code" }, { status: 401 });
  }
}
