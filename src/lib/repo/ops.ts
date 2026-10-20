import { query, queryOne } from "../db";

/** Bookings, inbox, subscribers, media and admin accounts. */

const num = (v: unknown) => Number(v ?? 0);

const isoDate = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").slice(0, 10);

// --- bookings --------------------------------------------------------------

export type BookingStatus = "pending" | "confirmed" | "checked_in" | "cancelled";

export type BookingInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  roomId: string | null;
  offerId: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  extras: string[];
  promoCode: string | null;
  base: number;
  extrasTotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  locale: string;
};

export type Booking = BookingInput & {
  id: string;
  reference: string;
  status: BookingStatus;
  createdAt: string;
  /** Physical unit assigned to this stay, if any. */
  unitId: number | null;
};

function toBooking(r: Record<string, unknown>): Booking {
  return {
    id: r.id as string,
    reference: r.reference as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    email: r.email as string,
    phone: r.phone as string,
    country: r.country as string,
    notes: r.notes as string,
    roomId: (r.room_id as string) ?? null,
    offerId: (r.offer_id as string) ?? null,
    checkIn: isoDate(r.check_in),
    checkOut: isoDate(r.check_out),
    nights: r.nights as number,
    adults: r.adults as number,
    children: r.children as number,
    extras: (r.extras as string[]) ?? [],
    promoCode: (r.promo_code as string) ?? null,
    base: num(r.base),
    extrasTotal: num(r.extras_total),
    discount: num(r.discount),
    total: num(r.total),
    paymentMethod: r.payment_method as string,
    locale: r.locale as string,
    status: r.status as BookingStatus,
    createdAt: (r.created_at as Date)?.toISOString?.() ?? String(r.created_at),
    unitId: (r.unit_id as number) ?? null,
  };
}

export async function listBookings(opts: {
  status?: BookingStatus | "all";
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: Booking[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.status && opts.status !== "all") {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(
      `(lower(first_name || ' ' || last_name) LIKE $${params.length}
        OR lower(email) LIKE $${params.length}
        OR lower(reference) LIKE $${params.length})`,
    );
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM bookings ${clause}`,
    params,
  );

  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  const rows = await query(
    `SELECT * FROM bookings ${clause} ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  return { items: rows.map(toBooking), total: Number(totalRow?.n ?? 0) };
}

export async function getBooking(id: string): Promise<Booking | null> {
  const row = await queryOne(`SELECT * FROM bookings WHERE id = $1`, [id]);
  return row ? toBooking(row) : null;
}

export async function setBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<void> {
  await query(
    `UPDATE bookings SET status = $2, updated_at = now() WHERE id = $1`,
    [id, status],
  );
}

export async function deleteBooking(id: string): Promise<void> {
  await query(`DELETE FROM bookings WHERE id = $1`, [id]);
}

export type DashboardStats = {
  bookingsThisMonth: number;
  revenueThisMonth: number;
  arrivalsToday: number;
  occupancy: number;
  pending: number;
  unreadMessages: number;
  subscribers: number;
  upcoming: (Booking & { roomName?: string })[];
};

export async function getDashboardStats(totalRooms: number): Promise<DashboardStats> {
  const row = await queryOne<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM bookings
         WHERE created_at >= date_trunc('month', now()) AND status <> 'cancelled')::text AS bookings_month,
       (SELECT coalesce(sum(total),0) FROM bookings
         WHERE created_at >= date_trunc('month', now()) AND status <> 'cancelled')::text AS revenue_month,
       (SELECT count(*) FROM bookings
         WHERE check_in = CURRENT_DATE AND status <> 'cancelled')::text AS arrivals_today,
       (SELECT count(*) FROM bookings
         WHERE status <> 'cancelled' AND check_in <= CURRENT_DATE AND check_out > CURRENT_DATE)::text AS occupied,
       (SELECT count(*) FROM bookings WHERE status = 'pending')::text AS pending,
       (SELECT count(*) FROM messages WHERE read = false)::text AS unread,
       (SELECT count(*) FROM subscribers WHERE active = true)::text AS subs`,
  );

  const upcoming = await query(
    `SELECT * FROM bookings
     WHERE status <> 'cancelled' AND check_out >= CURRENT_DATE
     ORDER BY check_in ASC LIMIT 8`,
  );

  const occupied = Number(row?.occupied ?? 0);
  return {
    bookingsThisMonth: Number(row?.bookings_month ?? 0),
    revenueThisMonth: Number(row?.revenue_month ?? 0),
    arrivalsToday: Number(row?.arrivals_today ?? 0),
    occupancy: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
    pending: Number(row?.pending ?? 0),
    unreadMessages: Number(row?.unread ?? 0),
    subscribers: Number(row?.subs ?? 0),
    upcoming: upcoming.map(toBooking),
  };
}

/** Revenue per month for the last 12 months, oldest first. */
export async function getRevenueSeries(): Promise<{ month: string; total: number }[]> {
  const rows = await query<{ month: Date; total: string }>(
    `SELECT date_trunc('month', created_at) AS month, sum(total)::text AS total
     FROM bookings
     WHERE status <> 'cancelled' AND created_at >= date_trunc('month', now()) - interval '11 months'
     GROUP BY 1 ORDER BY 1`,
  );
  return rows.map((r) => ({ month: isoDate(r.month).slice(0, 7), total: num(r.total) }));
}

// --- messages --------------------------------------------------------------

export type Message = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
  read: boolean;
  createdAt: string;
};

export async function createMessage(m: {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
}): Promise<void> {
  await query(
    `INSERT INTO messages (name, email, subject, message, locale)
     VALUES ($1,$2,$3,$4,$5)`,
    [m.name, m.email, m.subject, m.message, m.locale],
  );
}

export async function listMessages(limit = 100): Promise<Message[]> {
  const rows = await query(
    `SELECT * FROM messages ORDER BY created_at DESC LIMIT ${limit}`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    subject: r.subject as string,
    message: r.message as string,
    locale: r.locale as string,
    read: r.read as boolean,
    createdAt: (r.created_at as Date)?.toISOString?.() ?? String(r.created_at),
  }));
}

export async function setMessageRead(id: string, read: boolean): Promise<void> {
  await query(`UPDATE messages SET read = $2 WHERE id = $1`, [id, read]);
}

export async function deleteMessage(id: string): Promise<void> {
  await query(`DELETE FROM messages WHERE id = $1`, [id]);
}

// --- subscribers -----------------------------------------------------------

export type Subscriber = {
  id: string;
  email: string;
  locale: string;
  active: boolean;
  createdAt: string;
};

export async function addSubscriber(email: string, locale: string): Promise<void> {
  await query(
    `INSERT INTO subscribers (email, locale) VALUES ($1,$2)
     ON CONFLICT (email) DO UPDATE SET active = true`,
    [email.toLowerCase().trim(), locale],
  );
}

export async function listSubscribers(): Promise<Subscriber[]> {
  const rows = await query(
    `SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 500`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    email: r.email as string,
    locale: r.locale as string,
    active: r.active as boolean,
    createdAt: (r.created_at as Date)?.toISOString?.() ?? String(r.created_at),
  }));
}

export async function deleteSubscriber(id: string): Promise<void> {
  await query(`DELETE FROM subscribers WHERE id = $1`, [id]);
}

// --- media -----------------------------------------------------------------

export type MediaItem = {
  id: string;
  filename: string;
  path: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  createdAt: string;
};

export async function insertMedia(m: {
  filename: string;
  path: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO media (filename, path, mime, size, width, height)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (path) DO NOTHING`,
    [m.filename, m.path, m.mime, m.size, m.width, m.height],
  );
}

export async function listMedia(): Promise<MediaItem[]> {
  const rows = await query(
    `SELECT * FROM media ORDER BY created_at DESC LIMIT 500`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    filename: r.filename as string,
    path: r.path as string,
    mime: r.mime as string,
    size: r.size as number,
    width: (r.width as number) ?? null,
    height: (r.height as number) ?? null,
    alt: r.alt as string,
    createdAt: (r.created_at as Date)?.toISOString?.() ?? String(r.created_at),
  }));
}

export async function deleteMedia(id: string): Promise<string | null> {
  const row = await queryOne<{ path: string }>(
    `DELETE FROM media WHERE id = $1 RETURNING path`,
    [id],
  );
  return row?.path ?? null;
}
