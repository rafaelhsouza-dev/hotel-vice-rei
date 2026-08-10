import { NextResponse } from "next/server";
import { buildIcal, type IcalEvent } from "@/lib/channels/ical";
import { addDays, getBusyPeriods, today } from "@/lib/repo/availability";
import { verifyIcalToken } from "@/lib/repo/ical-token";
import { recordSync } from "@/lib/repo/channels";

/**
 * Published availability feed, one calendar per room type.
 *
 * This is the outbound half of iCal connectivity: instead of us pushing to a
 * channel, the channel subscribes here and pulls. Airbnb, Vrbo, Google and
 * Booking.com all accept a URL in this shape.
 *
 * `roomId` may be `todos` for a combined calendar, which is what a property
 * with a single listing wants.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HORIZON_DAYS = 540;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const token = new URL(request.url).searchParams.get("token");

  if (!(await verifyIcalToken(token))) {
    // No hint about why: a 404 leaks less than a 401 to anyone probing.
    return new NextResponse("Not found", { status: 404 });
  }

  const from = today();
  const to = addDays(from, HORIZON_DAYS);
  const scope = roomId === "todos" ? null : roomId;

  let periods: Awaited<ReturnType<typeof getBusyPeriods>>;
  try {
    periods = await getBusyPeriods(scope, from, to);
  } catch {
    return new NextResponse("Calendar unavailable", { status: 503 });
  }

  const events: IcalEvent[] = periods.map((period) => ({
    // Stable across runs so channels update events instead of duplicating them.
    uid: `${period.roomId}-${period.start}-${period.end}@hotelvicerei.com`,
    start: period.start,
    end: period.end,
    summary: period.reason === "closed" ? "Encerrado" : "Não disponível",
    description: `${period.roomName} · Hotel Vice-Rei`,
  }));

  // Bucketed to the hour: channels treat a changed DTSTAMP as a changed
  // calendar, and a per-request timestamp would make every poll look like an
  // update.
  const stamp = `${new Date().toISOString().slice(0, 13).replace(/[-:]/g, "")}0000Z`;

  const body = buildIcal(events, {
    name: scope ? `Hotel Vice-Rei · ${scope}` : "Hotel Vice-Rei",
    stamp,
  });

  await recordSync({
    channelId: null,
    direction: "out",
    action: "ical-feed",
    status: "ok",
    items: events.length,
    message: `Feed ${roomId} servido com ${events.length} períodos.`,
  }).catch(() => {
    /* logging must never break the feed */
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="vicerei-${roomId}.ics"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
