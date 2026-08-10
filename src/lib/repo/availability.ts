import { query, queryOne } from "../db";

/**
 * Availability, rates and restrictions per room type and date.
 *
 * The calendar is *derived*, not stored: physical inventory comes from the
 * `units` table, occupancy from our own `bookings` and from reservations
 * imported off each channel. The `availability` table holds only the manual
 * override layer — extra blocks, minimum stay, stop-sell and a rate that
 * differs from the room's base price.
 *
 * Deriving instead of materialising means the numbers cannot drift out of
 * sync with the bookings that produced them, which is the single most
 * expensive failure mode in channel management: an overbooking caused by a
 * stale counter. The one snapshot we do keep (`units_total`/`units_booked`)
 * records what we last pushed to a channel, so the sync engine can send only
 * the days that actually changed.
 */

export type DayAvailability = {
  roomId: string;
  roomName: string;
  date: string;
  unitsTotal: number;
  /** Reservations taken on our own site. */
  unitsBooked: number;
  /** Reservations imported from a channel plus manual blocks. */
  unitsBlocked: number;
  /** What we can still sell: total − booked − blocked, never negative. */
  free: number;
  minStay: number;
  closed: boolean;
  rate: number;
  /** True when the day is oversold — needs the operator's attention. */
  overbooked: boolean;
};

const CALENDAR_SQL = `
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
        AND b.status <> 'cancelled'
        AND b.check_in <= d.date AND b.check_out > d.date)::int  AS units_booked,
    (SELECT count(*) FROM channel_reservations cr
      WHERE cr.room_id = r.id
        AND cr.status = 'confirmed'
        AND cr.booking_id IS NULL
        AND cr.check_in <= d.date AND cr.check_out > d.date)::int AS units_channel,
    COALESCE(a.units_blocked, 0)           AS units_manual,
    COALESCE(a.min_stay, 1)                AS min_stay,
    COALESCE(a.closed, false)              AS closed,
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
  units_manual: number;
  min_stay: number;
  closed: boolean;
  rate: string | number;
};

function toDay(r: CalendarRow): DayAvailability {
  const blocked = r.units_channel + r.units_manual;
  const free = r.units_total - r.units_booked - blocked;
  return {
    roomId: r.room_id,
    roomName: r.room_name ?? r.room_id,
    date: String(r.date).slice(0, 10),
    unitsTotal: r.units_total,
    unitsBooked: r.units_booked,
    unitsBlocked: blocked,
    free: Math.max(0, free),
    minStay: r.min_stay,
    closed: r.closed,
    rate: Number(r.rate ?? 0),
    overbooked: free < 0,
  };
}

/** Day-by-day availability for one room type, or all of them when null. */
export async function getCalendar(
  roomId: string | null,
  from: string,
  to: string,
): Promise<DayAvailability[]> {
  const rows = await query<CalendarRow>(CALENDAR_SQL, [roomId, from, to]);
  return rows.map(toDay);
}

/** Days where bookings plus blocks exceed the physical inventory. */
export async function getOverbookings(from: string, to: string): Promise<DayAvailability[]> {
  return (await getCalendar(null, from, to)).filter((d) => d.overbooked);
}

export type AvailabilityOverride = {
  unitsBlocked?: number;
  minStay?: number;
  closed?: boolean;
  /** null clears the override and falls back to the room's base price. */
  rate?: number | null;
};

/**
 * Writes the override layer for a date range. Only the keys present in
 * `patch` are touched, so closing a period does not wipe its rates.
 */
export async function setAvailability(
  roomId: string,
  from: string,
  to: string,
  patch: AvailabilityOverride,
): Promise<number> {
  const rows = await query<{ count: string }>(
    `WITH days AS (
       SELECT d::date AS date
       FROM generate_series($2::date, $3::date, interval '1 day') d
     ), upserted AS (
       INSERT INTO availability (room_id, date, units_blocked, min_stay, closed, rate)
       SELECT $1, date,
              COALESCE($4::int, 0), COALESCE($5::int, 1),
              COALESCE($6::boolean, false), $7::numeric
       FROM days
       ON CONFLICT (room_id, date) DO UPDATE SET
         units_blocked = COALESCE($4::int, availability.units_blocked),
         min_stay      = COALESCE($5::int, availability.min_stay),
         closed        = COALESCE($6::boolean, availability.closed),
         rate          = CASE WHEN $8::boolean THEN $7::numeric ELSE availability.rate END,
         updated_at    = now()
       RETURNING 1
     )
     SELECT count(*)::text AS count FROM upserted`,
    [
      roomId,
      from,
      to,
      patch.unitsBlocked ?? null,
      patch.minStay ?? null,
      patch.closed ?? null,
      patch.rate ?? null,
      patch.rate !== undefined,
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

export function today(): string {
  return new Date().toISOString().slice(0, 10);
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

/** True when the room type still has a free unit for the whole stay. */
export async function hasAvailability(
  roomId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const row = await queryOne<{ blocked: string }>(
    `SELECT count(*)::text AS blocked FROM (
       ${CALENDAR_SQL}
     ) c
     WHERE c.closed
        OR c.units_total - c.units_booked - c.units_channel - c.units_manual <= 0`,
    [roomId, checkIn, addDays(checkOut, -1)],
  );
  return Number(row?.blocked ?? 1) === 0;
}
