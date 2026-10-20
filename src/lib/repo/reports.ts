import { query, queryOne } from "../db";

/**
 * Hotel KPIs for a stay-date range [from, to]. Room revenue is taken night by
 * night from each booking's `nightly` breakdown, so a stay that straddles the
 * range only counts the nights inside it — the way STR and every PMS report
 * ADR and RevPAR.
 *
 *   Occupancy = room-nights sold / room-nights available
 *   ADR       = room revenue / room-nights sold
 *   RevPAR    = room revenue / room-nights available
 */

export type ReportRange = { from: string; to: string };

export type Kpis = {
  nightsAvailable: number;
  nightsSold: number;
  occupancy: number;
  roomRevenue: number;
  adr: number;
  revpar: number;
  extrasRevenue: number;
  folioRevenue: number;
  touristTax: number;
  bookings: number;
  cancellations: number;
  cancellationRate: number;
  noShows: number;
  avgLengthOfStay: number;
  avgLeadDays: number;
  commission: number;
};

const LIVE = `b.status NOT IN ('cancelled','no_show')`;

export async function getKpis({ from, to }: ReportRange): Promise<Kpis> {
  const r = await queryOne<Record<string, string>>(
    `WITH nights AS (
       SELECT b.id, (n->>'date')::date AS d, (n->>'price')::numeric AS price
       FROM bookings b, jsonb_array_elements(b.nightly) n
       WHERE ${LIVE} AND (n->>'date')::date BETWEEN $1::date AND $2::date
     ),
     -- Bookings created before rate plans existed have no nightly breakdown:
     -- spread their room total evenly over the nights inside the range.
     legacy AS (
       SELECT b.id, d::date AS d, (b.base / NULLIF(b.nights,0)) AS price
       FROM bookings b, generate_series(b.check_in, b.check_out - 1, interval '1 day') d
       WHERE ${LIVE} AND jsonb_array_length(b.nightly) = 0 AND d::date BETWEEN $1::date AND $2::date
     ),
     all_nights AS (SELECT * FROM nights UNION ALL SELECT * FROM legacy),
     stays AS (
       SELECT * FROM bookings b WHERE b.check_in BETWEEN $1::date AND $2::date
     )
     SELECT
       ((SELECT count(*) FROM units WHERE active) * (($2::date - $1::date) + 1))::text AS available,
       (SELECT count(*) FROM all_nights)::text AS sold,
       (SELECT COALESCE(sum(price),0) FROM all_nights)::text AS room_revenue,
       (SELECT COALESCE(sum(extras_total - CASE WHEN base + extras_total > 0 THEN discount * extras_total / (base + extras_total) ELSE 0 END),0) FROM stays b WHERE ${LIVE})::text AS extras,
       (SELECT COALESCE(sum(c.total),0) FROM booking_charges c JOIN bookings b ON b.id = c.booking_id
          WHERE NOT c.voided AND c.created_at::date BETWEEN $1::date AND $2::date)::text AS folio,
       (SELECT COALESCE(sum(tourist_tax),0) FROM stays b WHERE ${LIVE})::text AS tax,
       (SELECT count(*) FROM stays)::text AS bookings,
       (SELECT count(*) FROM stays WHERE status = 'cancelled')::text AS cancelled,
       (SELECT count(*) FROM stays WHERE status = 'no_show')::text AS no_shows,
       (SELECT COALESCE(avg(nights),0) FROM stays b WHERE ${LIVE})::text AS los,
       (SELECT COALESCE(avg(check_in - created_at::date),0) FROM stays b WHERE ${LIVE})::text AS lead,
       (SELECT COALESCE(sum(commission),0) FROM stays b WHERE ${LIVE})::text AS commission`,
    [from, to],
  );
  const n = (k: string) => Number(r?.[k] ?? 0);
  const available = n("available");
  const sold = n("sold");
  const revenue = n("room_revenue");
  const bookings = n("bookings");
  return {
    nightsAvailable: available,
    nightsSold: sold,
    occupancy: available ? sold / available : 0,
    roomRevenue: revenue,
    adr: sold ? revenue / sold : 0,
    revpar: available ? revenue / available : 0,
    extrasRevenue: n("extras"),
    folioRevenue: n("folio"),
    touristTax: n("tax"),
    bookings,
    cancellations: n("cancelled"),
    cancellationRate: bookings ? n("cancelled") / bookings : 0,
    noShows: n("no_shows"),
    avgLengthOfStay: n("los"),
    avgLeadDays: n("lead"),
    commission: n("commission"),
  };
}

export type Breakdown = { key: string; label: string; bookings: number; nights: number; revenue: number; commission: number };

/** Room revenue and nights by booking source (and channel) or by room type. */
export async function getBreakdown({ from, to }: ReportRange, by: "source" | "room"): Promise<Breakdown[]> {
  const keyExpr =
    by === "source"
      ? `COALESCE(c.name, CASE b.source WHEN 'site' THEN 'Site' WHEN 'desk' THEN 'Balcão' WHEN 'phone' THEN 'Telefone' WHEN 'email' THEN 'E-mail' WHEN 'walk_in' THEN 'Sem reserva' ELSE b.source END)`
      : `COALESCE(r.name->>'pt', b.room_id, '—')`;
  const rows = await query<{ label: string; bookings: string; nights: string; revenue: string; commission: string }>(
    `WITH nights AS (
       SELECT b.id, (n->>'price')::numeric AS price
       FROM bookings b, jsonb_array_elements(b.nightly) n
       WHERE ${LIVE} AND (n->>'date')::date BETWEEN $1::date AND $2::date
       UNION ALL
       SELECT b.id, (b.base / NULLIF(b.nights,0))
       FROM bookings b, generate_series(b.check_in, b.check_out - 1, interval '1 day') d
       WHERE ${LIVE} AND jsonb_array_length(b.nightly) = 0 AND d::date BETWEEN $1::date AND $2::date
     )
     , per_booking AS (SELECT id, count(*) AS nights, sum(price) AS revenue FROM nights GROUP BY id)
     SELECT ${keyExpr} AS label,
            count(*)::text AS bookings,
            COALESCE(sum(pb.nights),0)::text AS nights,
            COALESCE(sum(pb.revenue),0)::text AS revenue,
            COALESCE(sum(b.commission),0)::text AS commission
     FROM per_booking pb JOIN bookings b ON b.id = pb.id
     LEFT JOIN channels c ON c.id = b.channel_id
     LEFT JOIN rooms r ON r.id = b.room_id
     GROUP BY 1 ORDER BY 4 DESC`,
    [from, to],
  );
  return rows.map((r) => ({
    key: r.label,
    label: r.label,
    bookings: Number(r.bookings),
    nights: Number(r.nights),
    revenue: Number(r.revenue),
    commission: Number(r.commission),
  }));
}

export type DailyRow = { date: string; sold: number; available: number; revenue: number; arrivals: number; departures: number };

export async function getDaily({ from, to }: ReportRange): Promise<DailyRow[]> {
  const rows = await query<{ date: string; sold: string; available: string; revenue: string; arrivals: string; departures: string }>(
    `WITH days AS (SELECT d::date AS date FROM generate_series($1::date, $2::date, interval '1 day') d)
     SELECT days.date::text AS date,
       (SELECT count(*) FROM bookings b WHERE ${LIVE} AND b.check_in <= days.date AND b.check_out > days.date)::text AS sold,
       (SELECT count(*) FROM units WHERE active)::text AS available,
       (SELECT COALESCE(sum((n->>'price')::numeric),0) FROM bookings b, jsonb_array_elements(b.nightly) n
          WHERE ${LIVE} AND (n->>'date')::date = days.date)::text AS revenue,
       (SELECT count(*) FROM bookings b WHERE ${LIVE} AND b.check_in = days.date)::text AS arrivals,
       (SELECT count(*) FROM bookings b WHERE ${LIVE} AND b.check_out = days.date)::text AS departures
     FROM days ORDER BY days.date`,
    [from, to],
  );
  return rows.map((r) => ({
    date: r.date,
    sold: Number(r.sold),
    available: Number(r.available),
    revenue: Number(r.revenue),
    arrivals: Number(r.arrivals),
    departures: Number(r.departures),
  }));
}

/** Bookings taken (by creation date) per day — the "pickup". */
export async function getPickup({ from, to }: ReportRange): Promise<{ date: string; bookings: number; value: number }[]> {
  const rows = await query<{ date: string; bookings: string; value: string }>(
    `SELECT created_at::date::text AS date, count(*)::text AS bookings, COALESCE(sum(total),0)::text AS value
     FROM bookings WHERE created_at::date BETWEEN $1::date AND $2::date AND status <> 'cancelled'
     GROUP BY 1 ORDER BY 1`,
    [from, to],
  );
  return rows.map((r) => ({ date: r.date, bookings: Number(r.bookings), value: Number(r.value) }));
}
