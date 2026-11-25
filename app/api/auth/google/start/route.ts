import { NextResponse } from "next/server";
import { issueAuthState } from "@/lib/auth-state";

/**
 * Issue a server-signed state token for the Google popup sign-in flow. The
 * client includes it in the authorization request and returns it with the
 * code; /api/auth/google verifies it before exchanging the code.
 */
export async function GET() {
  try {
    return NextResponse.json(issueAuthState());
  } catch {
    return NextResponse.json({ error: "sign-in is not configured" }, { status: 503 });
  }
}
