import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CRON_SCHEDULE } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const PING_TIMEOUT_MS = 3_000;

/**
 * Readiness check: the app cannot serve products or scans without MongoDB, so a
 * successful `ping` is a meaningful readiness signal (not just "process alive").
 * Never returns env values, connection strings or error details.
 */
export async function GET() {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const db = await getDb();
    await Promise.race([
      db.command({ ping: 1 }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("db ping timeout")), PING_TIMEOUT_MS);
      })
    ]);

    return NextResponse.json(
      {
        status: "ok",
        db: "up",
        schedule: CRON_SCHEDULE,
        latencyMs: Date.now() - startedAt
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        db: "down",
        schedule: CRON_SCHEDULE,
        latencyMs: Date.now() - startedAt
      },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
