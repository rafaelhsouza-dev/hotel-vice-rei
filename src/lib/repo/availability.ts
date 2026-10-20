import type { PoolClient } from "pg";
import { query } from "../db";

/**
 * Availability, rates and restrictions per room type and date.
 *
 * The calendar is *derived*, not stored: physical inventory comes from the
 * `units` table, occupancy from our own `bookings` and from reservations
 * imported off each channel. The `availability` table holds only the manual
 * override layer — extra blocks, length-of-stay rules, stop-sell,
 * closed-to-arrival/departure and a rate that differs from the room's base
 * price.
 *
 * Deriving instead of materialising means the numbers cannot drift out of
 * sync with the bookings that produced them, which is the single most
 * expensive failure mode in channel management: an overbooking caused by a
 * stale counter.
 */

export type DayAvailability = {
  roomId: string;
  roomName: string;
  date: string;
  unitsTotal: number;
  /** Reservations held in the PMS (site, desk, extranets). */
  unitsBooked: number;
  /** Reservations imported from a channel, manual blocks and allotments. */
  unitsBlocked: number;
  /** Of unitsBlocked: units held back for manual extranets (allotments). */
  unitsAllotted: number;
  /** What we can still sell: total − booked − blocked, never negative. */
  free: number;
  minStay: number;
  maxStay: number | null;
  closed: boolean;
  closedArrival: boolean;
  closedDeparture: boolean;
  rate: number;
  /** True when real reservations exceed the inventory — needs attention. */
  overbooked: boolean;
};

// Bookings that occupy a unit: anything not cancelled and not a no-show.
const OCCUPYING = `b.status NOT IN ('cancelled','no_show')`;

export const CALENDAR_SQL = `
  WITH days AS (
    SELECT d::date AS date
    FROM generate_series($2::date, $3::date, interval '1 day') d
  ),
  inv AS (
    SELECT room_id, count(*)::int AS total
    FROM units
    WHERE active = true AND room_id IS NOT NULL
    GROUP BY room_id
  )
  SELECT
    r.id                                   AS room_id,
    r.name->>'pt'                          AS room_name,
    d.date                                 AS date,
    COALESCE(inv.total, 0)                 AS units_total,
    (SELECT count(*) FROM bookings b
      WHERE b.room_id = r.id
        AND ${OCCUPYING}
        AND b.check_in <= d.date AND b.check_out > d.date)::int  AS units_booked,
    (SELECT count(*) FROM channel_reservations cr
      WHERE cr.room_id = r.id
        AND cr.status = 'confirmed'
        AND cr.booking_id IS NULL
        AND cr.check_in <= d.date AND cr.check_out > d.date)::int AS units_channel,
    -- Allotment still held for each manual extranet: what was reserved for it
    -- minus what it has already sold that night (those sales are bookings).
    (SELECT COALESCE(sum(GREATEST(
        (c.settings->'allotments'->>r.id)::int
        - (SELECT count(*) FROM bookings b
            WHERE b.channel_id = c.id AND b.room_id = r.id AND ${OCCUPYING}
              AND b.check_in <= d.date AND b.check_out > d.date),
        0)), 0)
      FROM channels c
      WHERE c.provider = 'extranet' AND c.enabled
        AND jsonb_typeof(c.settings->'allotments'->r.id) = 'number')::int AS units_allotted,
    COALESCE(a.units_blocked, 0)           AS units_manual,
    COALESCE(a.min_stay, 1)                AS min_stay,
    a.max_stay                             AS max_stay,
    COALESCE(a.closed, false)              AS closed,
    COALESCE(a.closed_arrival, false)      AS closed_arrival,
    COALESCE(a.closed_departure, false)    AS closed_departure,
    COALESCE(a.rate, r.price_from)         AS rate
  FROM rooms r
  CROSS JOIN days d
  LEFT JOIN inv ON inv.room_id = r.id
  LEFT JOIN availability a ON a.room_id = r.id AND a.date = d.date
  WHERE ($1::text IS NULL OR r.id = $1)
  ORDER BY r.position, r.id, d.date
`;

type CalendarRow = {
  room_id: string;
  room_name: string;
  date: string;
  units_total: number;
  units_booked: number;
  units_channel: number;
  units_allotted: number;
  units_manual: number;
  min_stay: number;
  max_stay: number | null;
  closed: boolean;
  closed_arrival: boolean;
  closed_departure: boolean;
  rate: string | number;
};

function toDay(r: CalendarRow): DayAvailability {
  const blocked = r.units_channel + r.units_manual + r.units_allotted;
  const free = r.units_total - r.units_booked - blocked;
  return {
    roomId: r.room_id,
    roomName: r.room_name ?? r.room_id,
    date: String(r.date).slice(0, 10),
    unitsTotal: r.units_total,
    unitsBooked: r.units_booked,
    unitsBlocked: blocked,
    unitsAllotted: r.units_allotted,
    free: Math.max(0, free),
    minStay: r.min_stay,
    maxStay: r.max_stay ?? null,
    closed: r.closed,
    closedArrival: r.closed_arrival,
    closedDeparture: r.closed_departure,
    rate: Number(r.rate ?? 0),
    // Allotments are a soft hold; only real reservations can oversell.
    overbooked: r.units_total - r.units_booked - r.units_channel - r.units_manual < 0,
  };
}

/**
 * Day-by-day availability for one room type, or all of them when null.
 * Pass `client` to read inside a transaction (the booking lock).
 */
export async function getCalendar(
  roomId: string | null,
  from: string,
  to: string,
  client?: PoolClient,
): Promise<DayAvailability[]> {
  const rows = client
    ? (await client.query<CalendarRow>(CALENDAR_SQL, [roomId, from, to])).rows
    : await query<CalendarRow>(CALENDAR_SQL, [roomId, from, to]);
  return rows.map(toDay);
}

/** Days where bookings plus blocks exceed the physical inventory. */
export async function getOverbookings(from: string, to: string): Promise<DayAvailability[]> {
  return (await getCalendar(null, from, to)).filter((d) => d.overbooked);
}

export type AvailabilityOverride = {
  unitsBlocked?: number;
  minStay?: number;
  /** null clears the limit. */
  maxStay?: number | null;
  closed?: boolean;
  closedArrival?: boolean;
  closedDeparture?: boolean;
  /** null clears the override and falls back to the room's base price. */
  rate?: number | null;
};

/**
 * Writes the override layer for a date range. Only the keys present in
 * `patch` are touched, so closing a period does not wipe its rates and
 * changing a price does not reopen a closed day. `weekdays` (0 = Sunday)
 * limits the change to those days of the week.
 */
export async function setAvailability(
  roomId: string,
  from: string,
  to: string,
  patch: AvailabilityOverride,
  weekdays?: number[],
): Promise<number> {
  const has = (k: keyof AvailabilityOverride) => patch[k] !== undefined;
  const rows = await query<{ count: string }>(
    `WITH days AS (
       SELECT d::date AS date
       FROM generate_series($2::date, $3::date, interval '1 day') d
       WHERE $13::int[] IS NULL OR extract(dow FROM d)::int = ANY($13::int[])
     ), upserted AS (
       INSERT INTO availability
         (room_id, date, units_blocked, min_stay, max_stay, closed, closed_arrival, closed_departure, rate)
       SELECT $1, date,
              COALESCE($4::int, 0), COALESCE($5::int, 1), $6::int,
              COALESCE($7::boolean, false), COALESCE($8::boolean, false), COALESCE($9::boolean, false),
              $10::numeric
       FROM days
       ON CONFLICT (room_id, date) DO UPDATE SET
         units_blocked    = COALESCE($4::int, availability.units_blocked),
         min_stay         = COALESCE($5::int, availability.min_stay),
         max_stay         = CASE WHEN $11::boolean THEN $6::int ELSE availability.max_stay END,
         closed           = COALESCE($7::boolean, availability.closed),
         closed_arrival   = COALESCE($8::boolean, availability.closed_arrival),
         closed_departure = COALESCE($9::boolean, availability.closed_departure),
         rate             = CASE WHEN $12::boolean THEN $10::numeric ELSE availability.rate END,
         updated_at       = now()
       RETURNING 1
     )
     SELECT count(*)::text AS count FROM upserted`,
    [
      roomId,
      from,
      to,
      patch.unitsBlocked ?? null,
      patch.minStay ?? null,
      patch.maxStay ?? null,
      patch.closed ?? null,
      patch.closedArrival ?? null,
      patch.closedDeparture ?? null,
      patch.rate ?? null,
      has("maxStay"),
      has("rate"),
      weekdays && weekdays.length > 0 && weekdays.length < 7 ? weekdays : null,
    ],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Drops the override rows so the range returns to its derived defaults. */
export async function clearAvailability(roomId: string, from: string, to: string) {
  await query(
    `DELETE FROM availability WHERE room_id = $1 AND date BETWEEN $2::date AND $3::date`,
    [roomId, from, to],
  );
}

/**
 * Busy periods per room type, in the shape an iCal feed needs: one entry per
 * contiguous run of fully-sold days. Channels import these as blocked dates.
 */
export type BusyPeriod = {
  roomId: string;
  roomName: string;
  start: string;
  /** Exclusive, matching iCal's DTEND for all-day events. */
  end: string;
  reason: "sold-out" | "closed";
};

export async function getBusyPeriods(
  roomId: string | null,
  from: string,
  to: string,
): Promise<BusyPeriod[]> {
  const days = await getCalendar(roomId, from, to);
  const periods: BusyPeriod[] = [];

  for (const day of days) {
    const blocked = day.closed || day.free <= 0;
    if (!blocked) continue;

    const reason: BusyPeriod["reason"] = day.closed ? "closed" : "sold-out";
    const last = periods[periods.length - 1];
    const contiguous =
      last &&
      last.roomId === day.roomId &&
      last.reason === reason &&
      last.end === day.date;

    if (contiguous) {
      last.end = addDays(day.date, 1);
    } else {
      periods.push({
        roomId: day.roomId,
        roomName: day.roomName,
        start: day.date,
        end: addDays(day.date, 1),
        reason,
      });
    }
  }
  return periods;
}

/** Date maths in UTC so a DST boundary never shifts a calendar day. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today in the hotel's timezone (Europe/Lisbon), not the server's. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

/** Physical inventory per room type, used by the admin and by outbound pushes. */
export async function getInventoryTotals(): Promise<Record<string, number>> {
  const rows = await query<{ room_id: string; total: number }>(
    `SELECT room_id, count(*)::int AS total
     FROM units WHERE active = true AND room_id IS NOT NULL
     GROUP BY room_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.room_id, r.total]));
}

/** True when the room type still has a free unit for every night of the stay. */
export async function hasAvailability(
  roomId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const days = await getCalendar(roomId, checkIn, addDays(checkOut, -1));
  return days.length > 0 && days.every((d) => !d.closed && d.free > 0);
}
