import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDueJobs, runJob, listJobs, type JobName } from "@/lib/jobs";

/**
 * External trigger for the background jobs, for setups where the in-process
 * timer is disabled (DISABLE_JOBS=1) or as a monitoring probe.
 *
 *   curl -X POST https://…/api/cron -H "x-sync-secret: $SYNC_SECRET"
 *   curl -X POST "https://…/api/cron?job=siba" -H "x-sync-secret: $SYNC_SECRET"
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret || secret.length < 16) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(request.headers.get("x-sync-secret") ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = new URL(request.url).searchParams.get("job") as JobName | null;
  if (job) {
    const r = await runJob(job, { force: true });
    return NextResponse.json(r, { status: r.ok ? 200 : 500 });
  }
  await runDueJobs();
  const jobs = await listJobs();
  return NextResponse.json({ jobs }, { status: jobs.some((j) => j.lastOk === false) ? 207 : 200 });
}
