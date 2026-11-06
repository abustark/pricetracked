import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/db";
import { scanDueProducts } from "@/lib/scanner";
import { CRON_SCHEDULE } from "@/lib/schedule";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token =
    new URL(request.url).searchParams.get("token") ||
    request.headers.get("x-cron-secret") ||
    bearerToken;

  if (process.env.NODE_ENV === "production" || configuredSecret) {
    if (!configuredSecret || token !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
    }
  }

  await ensureIndexes();
  const startedAt = Date.now();
  const results = await scanDueProducts();
  const okCount = results.filter((result) => result.ok).length;
  const skippedCount = results.filter((result) => result.skipped).length;

  return NextResponse.json({
    scanned: results.length,
    ok: okCount,
    failed: results.length - okCount - skippedCount,
    skipped: skippedCount,
    durationMs: Date.now() - startedAt,
    schedule: CRON_SCHEDULE,
    results
  });
}
