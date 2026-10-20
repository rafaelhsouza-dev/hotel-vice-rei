import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";

/**
 * Liveness/readiness probe for EasyPanel or an uptime monitor (UptimeRobot,
 * Better Stack…). Reports only whether the app and its database answer —
 * nothing about configuration, so it is safe to leave public.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const started = Date.now();
  const db = await pingDb();
  return NextResponse.json(
    { status: db ? "ok" : "degraded", database: db, latencyMs: Date.now() - started, time: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
