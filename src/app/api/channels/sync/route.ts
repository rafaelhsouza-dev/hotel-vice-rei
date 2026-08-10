import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncAllChannels } from "@/lib/channels/engine";
import { pruneSyncLog } from "@/lib/repo/channels";

/**
 * Scheduled synchronisation entry point.
 *
 * Meant to be called every 15–30 minutes by EasyPanel's cron (or any external
 * scheduler) with the shared secret. iCal feeds only change on the channel's
 * own polling schedule, so anything more frequent burns rate limit for
 * nothing.
 *
 *   curl -X POST https://…/api/channels/sync -H "x-sync-secret: $SYNC_SECRET"
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  // Without a configured secret the endpoint stays shut rather than open.
  if (!secret || secret.length < 16) return false;

  const provided = request.headers.get("x-sync-secret") ?? "";
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
    const outcomes = await syncAllChannels();
    await pruneSyncLog().catch(() => {
      /* housekeeping only */
    });

    const failed = outcomes.filter((o) => !o.ok);
    return NextResponse.json(
      {
        ranFor: outcomes.length,
        failed: failed.length,
        durationMs: Date.now() - started,
        outcomes,
      },
      // 207 tells a monitoring probe that something needs attention without
      // claiming the whole run collapsed.
      { status: failed.length > 0 ? 207 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 },
    );
  }
}
