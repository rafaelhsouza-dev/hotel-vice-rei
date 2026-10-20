import type { PoolClient } from "pg";
import { query, queryOne, transaction } from "../db";
import type { PolicySnapshot } from "../booking/pricing";

/** Bookings as the PMS reads and changes them. Writing new ones: booking/service.ts. */

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_SOURCES = ["site", "desk", "phone", "email", "walk_in", "channel", "extranet"] as const;
export type BookingSourceId = (typeof BOOKING_SOURCES)[number];

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  checked_in: "Em estadia",
  checked_out: "Saída feita",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
};

export const SOURCE_LABEL: Record<BookingSourceId, string> = {
  site: "Site",
  desk: "Balcão",
  phone: "Telefone",
  email: "E-mail",
  walk_in: "Sem reserva",
  channel: "Plataforma (sincronizada)",
  extranet: "Plataforma (extranet)",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "Por pagar",
  pending: "A aguardar pagamento",
  partial: "Pago em parte",
  paid: "Pago",
  refunded: "Reembolsado",
};

export type Booking = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  roomId: string | null;
  roomName: string;
  unitId: number | null;
  unitCode: string | null;
  offerId: string | null;
  ratePlanId: string | null;
  policy: Partial<PolicySnapshot>;
  nightly: { date: string; price: number }[];
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
  touristTax: number;
  amountDueNow: number;
  paidTotal: number;
  paymentStatus: string;
  paymentMethod: string;
  status: BookingStatus;
  source: BookingSourceId;
  channelId: string | null;
  channelName: string | null;
  externalRef: string;
  commission: number;
  locale: string;
  guestToken: string | null;
  eta: string;
  checkinDoneAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  cancelFee: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const day = (v: unknown) => String(v ?? "").slice(0, 10);

export const BOOKING_SELECT = `
  SELECT b.*, r.name->>'pt' AS room_name, u.code AS unit_code, c.name AS channel_name
  FROM bookings b
  LEFT JOIN rooms r ON r.id = b.room_id
  LEFT JOIN units u ON u.id = b.unit_id
  LEFT JOIN channels c ON c.id = b.channel_id
`;

export function toBooking(r: Record<string, unknown>): Booking {
  return {
    id: String(r.id),
    reference: String(r.reference),
    firstName: String(r.first_name ?? ""),
    lastName: String(r.last_name ?? ""),
    email: String(r.email ?? ""),
    phone: String(r.phone ?? ""),
    country: String(r.country ?? ""),
    notes: String(r.notes ?? ""),
    roomId: (r.room_id as string) ?? null,
    roomName: String(r.room_name ?? r.room_id ?? "—"),
    unitId: (r.unit_id as number) ?? null,
    unitCode: (r.unit_code as string) ?? null,
    offerId: (r.offer_id as string) ?? null,
    ratePlanId: (r.rate_plan_id as string) ?? null,
    policy: (r.policy as Partial<PolicySnapshot>) ?? {},
    nightly: Array.isArray(r.nightly) ? (r.nightly as { date: string; price: number }[]) : [],
    checkIn: day(r.check_in),
    checkOut: day(r.check_out),
    nights: Number(r.nights ?? 0),
    adults: Number(r.adults ?? 1),
    children: Number(r.children ?? 0),
    extras: Array.isArray(r.extras) ? (r.extras as string[]) : [],
    promoCode: (r.promo_code as string) ?? null,
    base: Number(r.base ?? 0),
    extrasTotal: Number(r.extras_total ?? 0),
    discount: Number(r.discount ?? 0),
    total: Number(r.total ?? 0),
    touristTax: Number(r.tourist_tax ?? 0),
    amountDueNow: Number(r.amount_due_now ?? 0),
    paidTotal: Number(r.paid_total ?? 0),
    paymentStatus: String(r.payment_status ?? "unpaid"),
    paymentMethod: String(r.payment_method ?? "hotel"),
    status: r.status as BookingStatus,
    source: (r.source as BookingSourceId) ?? "site",
    channelId: (r.channel_id as string) ?? null,
    channelName: (r.channel_name as string) ?? null,
    externalRef: String(r.external_ref ?? ""),
    commission: Number(r.commission ?? 0),
    locale: String(r.locale ?? "pt"),
    guestToken: (r.guest_token as string) ?? null,
    eta: String(r.eta ?? ""),
    checkinDoneAt: iso(r.checkin_done_at),
    checkedInAt: iso(r.checked_in_at),
    checkedOutAt: iso(r.checked_out_at),
    cancelledAt: iso(r.cancelled_at),
    cancelReason: String(r.cancel_reason ?? ""),
    cancelFee: Number(r.cancel_fee ?? 0),
    createdBy: String(r.created_by ?? ""),
    createdAt: iso(r.created_at) ?? "",
    updatedAt: iso(r.updated_at) ?? "",
  };
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await queryOne<Record<string, unknown>>(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
  return r ? toBooking(r) : null;
}

export async function getBookingByToken(token: string): Promise<Booking | null> {
  if (!token || token.length < 20 || token.length > 64) return null;
  const r = await queryOne<Record<string, unknown>>(`${BOOKING_SELECT} WHERE b.guest_token = $1`, [token]);
  return r ? toBooking(r) : null;
}

export async function getBookingByReference(reference: string): Promise<Booking | null> {
  const r = await queryOne<Record<string, unknown>>(`${BOOKING_SELECT} WHERE b.reference = $1`, [
    reference.trim().toUpperCase(),
  ]);
  return r ? toBooking(r) : null;
}

export type BookingFilter = {
  status?: BookingStatus | "all" | "active";
  source?: BookingSourceId | "all";
  channelId?: string;
  search?: string;
  /** Stays overlapping [from, to]. */
  from?: string;
  to?: string;
  arrivalOn?: string;
  departureOn?: string;
  sort?: "created" | "arrival";
  limit?: number;
  offset?: number;
};

export async function listBookings(f: BookingFilter = {}): Promise<{ items: Booking[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (f.status === "active") where.push(`b.status NOT IN ('cancelled','no_show')`);
  else if (f.status && f.status !== "all") add("b.status = ?", f.status);
  if (f.source && f.source !== "all") add("b.source = ?", f.source);
  if (f.channelId) add("b.channel_id = ?", f.channelId);
  if (f.from) add("b.check_out > ?::date", f.from);
  if (f.to) add("b.check_in <= ?::date", f.to);
  if (f.arrivalOn) add("b.check_in = ?::date", f.arrivalOn);
  if (f.departureOn) add("b.check_out = ?::date", f.departureOn);
  if (f.search) {
    params.push(`%${f.search.toLowerCase()}%`);
    const p = `$${params.length}`;
    where.push(
      `(lower(b.first_name || ' ' || b.last_name) LIKE ${p} OR lower(b.email) LIKE ${p}
        OR lower(b.reference) LIKE ${p} OR lower(b.external_ref) LIKE ${p} OR b.phone LIKE ${p})`,
    );
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order = f.sort === "arrival" ? "b.check_in ASC, b.created_at" : "b.created_at DESC";
  const limit = Math.min(500, Math.max(1, f.limit ?? 25));
  const offset = Math.max(0, f.offset ?? 0);

  const [rows, count] = await Promise.all([
    query<Record<string, unknown>>(`${BOOKING_SELECT} ${clause} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    query<{ n: string }>(`SELECT count(*)::text AS n FROM bookings b ${clause}`, params),
  ]);
  return { items: rows.map(toBooking), total: Number(count[0]?.n ?? 0) };
}

/** Updates the guest's contact data — never prices or dates. */
export async function updateBookingGuest(
  id: string,
  g: { firstName: string; lastName: string; email: string; phone: string; country: string; notes: string; eta: string },
): Promise<void> {
  await query(
    `UPDATE bookings SET first_name=$2, last_name=$3, email=$4, phone=$5, country=$6, notes=$7, eta=$8, updated_at=now()
     WHERE id=$1`,
    [id, g.firstName, g.lastName, g.email, g.phone, g.country, g.notes, g.eta],
  );
}

export async function setBookingUnit(client: PoolClient | null, id: string, unitId: number | null): Promise<void> {
  const sql = `UPDATE bookings SET unit_id=$2, updated_at=now() WHERE id=$1`;
  if (client) await client.query(sql, [id, unitId]);
  else await query(sql, [id, unitId]);
}

/** True when the unit has no other stay overlapping [checkIn, checkOut). */
export async function unitIsFree(
  client: PoolClient | null,
  unitId: number,
  checkIn: string,
  checkOut: string,
  excludeBookingId: string,
): Promise<boolean> {
  const sql = `SELECT 1 FROM bookings b
     WHERE b.unit_id = $1 AND b.id <> $4 AND b.status NOT IN ('cancelled','no_show')
       AND b.check_in < $3::date AND b.check_out > $2::date LIMIT 1`;
  const params = [unitId, checkIn, checkOut, excludeBookingId];
  const rows = client ? (await client.query(sql, params)).rows : await query(sql, params);
  return rows.length === 0;
}

export async function deleteBooking(id: string): Promise<void> {
  await query(`DELETE FROM bookings WHERE id = $1`, [id]);
}

// --- folio ------------------------------------------------------------------

export const CHARGE_CATEGORIES = [
  "extra",
  "breakfast",
  "laundry",
  "parking",
  "restaurant",
  "bar",
  "minibar",
  "damage",
  "cancellation",
  "other",
] as const;
export type ChargeCategory = (typeof CHARGE_CATEGORIES)[number] | "room" | "tourist_tax";

export const CHARGE_LABEL: Record<ChargeCategory, string> = {
  room: "Alojamento",
  tourist_tax: "Taxa municipal turística",
  extra: "Extra",
  breakfast: "Pequeno-almoço",
  laundry: "Lavandaria",
  parking: "Estacionamento",
  restaurant: "Refeições",
  bar: "Bar",
  minibar: "Minibar",
  damage: "Danos",
  cancellation: "Penalização de cancelamento",
  other: "Outro",
};

/** Default VAT per category (mainland Portugal). Editable per line. */
export const DEFAULT_VAT: Record<ChargeCategory, number> = {
  room: 6,
  tourist_tax: 0,
  extra: 23,
  breakfast: 13,
  laundry: 23,
  parking: 23,
  restaurant: 13,
  bar: 23,
  minibar: 23,
  damage: 23,
  cancellation: 0,
  other: 23,
};

export type Charge = {
  id: string;
  category: ChargeCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  vatRate: number;
  voided: boolean;
  createdBy: string;
  createdAt: string;
};

export async function listCharges(bookingId: string): Promise<Charge[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM booking_charges WHERE booking_id = $1 ORDER BY created_at`,
    [bookingId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    category: r.category as ChargeCategory,
    description: String(r.description ?? ""),
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    total: Number(r.total),
    vatRate: Number(r.vat_rate),
    voided: Boolean(r.voided),
    createdBy: String(r.created_by ?? ""),
    createdAt: (r.created_at as Date).toISOString(),
  }));
}

export async function addCharge(input: {
  bookingId: string;
  category: ChargeCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  createdBy: string;
}): Promise<string> {
  const total = Math.round(input.quantity * input.unitPrice * 100) / 100;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO booking_charges (booking_id, category, description, quantity, unit_price, total, vat_rate, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [input.bookingId, input.category, input.description, input.quantity, input.unitPrice, total, input.vatRate, input.createdBy],
  );
  return row!.id;
}

/** Charges are voided, never deleted, so the folio keeps its history. */
export async function voidCharge(id: string): Promise<string | null> {
  const row = await queryOne<{ booking_id: string }>(
    `UPDATE booking_charges SET voided = true WHERE id = $1 AND voided = false RETURNING booking_id`,
    [id],
  );
  return row?.booking_id ?? null;
}

export type Folio = {
  lines: { label: string; category: ChargeCategory; amount: number; vatRate: number; chargeId?: string }[];
  /** Everything the guest owes for the stay. */
  grandTotal: number;
  paid: number;
  balance: number;
};

/**
 * The guest's account: the stay as booked (room, extras, discount, tourist
 * tax) plus every folio charge, minus what was paid. A cancellation fee
 * replaces the stay when the booking is cancelled.
 */
export function buildFolio(b: Booking, charges: Charge[]): Folio {
  const lines: Folio["lines"] = [];
  const live = b.status !== "cancelled" && b.status !== "no_show";
  if (live) {
    lines.push({ label: `Alojamento · ${b.nights} noite(s)`, category: "room", amount: b.base, vatRate: 6 });
    if (b.extrasTotal > 0) lines.push({ label: "Extras da reserva", category: "extra", amount: b.extrasTotal, vatRate: 23 });
    if (b.discount > 0) lines.push({ label: `Desconto${b.promoCode ? ` · ${b.promoCode}` : ""}`, category: "room", amount: -b.discount, vatRate: 6 });
    // A total agreed at the desk replaces the computed price; show the gap.
    const computed = Math.round((b.base + b.extrasTotal - b.discount) * 100) / 100;
    if (Math.abs(computed - b.total) > 0.009) {
      lines.push({ label: "Ajuste ao preço acordado", category: "room", amount: Math.round((b.total - computed) * 100) / 100, vatRate: 6 });
    }
    if (b.touristTax > 0) lines.push({ label: "Taxa municipal turística", category: "tourist_tax", amount: b.touristTax, vatRate: 0 });
  } else if (b.cancelFee > 0) {
    lines.push({ label: "Penalização de cancelamento", category: "cancellation", amount: b.cancelFee, vatRate: 0 });
  }
  for (const c of charges) {
    if (c.voided) continue;
    lines.push({ label: c.description || CHARGE_LABEL[c.category], category: c.category, amount: c.total, vatRate: c.vatRate, chargeId: c.id });
  }
  const grandTotal = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return { lines, grandTotal, paid: b.paidTotal, balance: Math.round((grandTotal - b.paidTotal) * 100) / 100 };
}

// --- guests (SIBA) -------------------------------------------------------------

export type Guest = {
  id: string;
  bookingId: string;
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  nationality: string;
  birthDate: string | null;
  birthPlace: string;
  documentType: string;
  documentNumber: string;
  documentCountry: string;
  residenceCountry: string;
  residenceCity: string;
  sibaStatus: "pending" | "not_required" | "sent" | "error";
  sibaSentAt: string | null;
  sibaMessage: string;
};

export function toGuest(r: Record<string, unknown>): Guest {
  return {
    id: String(r.id),
    bookingId: String(r.booking_id),
    isPrimary: Boolean(r.is_primary),
    firstName: String(r.first_name ?? ""),
    lastName: String(r.last_name ?? ""),
    nationality: String(r.nationality ?? ""),
    birthDate: r.birth_date ? day(r.birth_date) : null,
    birthPlace: String(r.birth_place ?? ""),
    documentType: String(r.document_type ?? ""),
    documentNumber: String(r.document_number ?? ""),
    documentCountry: String(r.document_country ?? ""),
    residenceCountry: String(r.residence_country ?? ""),
    residenceCity: String(r.residence_city ?? ""),
    sibaStatus: (r.siba_status as Guest["sibaStatus"]) ?? "pending",
    sibaSentAt: iso(r.siba_sent_at),
    sibaMessage: String(r.siba_message ?? ""),
  };
}

export async function listGuests(bookingId: string): Promise<Guest[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM booking_guests WHERE booking_id = $1 ORDER BY is_primary DESC, created_at`,
    [bookingId],
  );
  return rows.map(toGuest);
}

export type GuestInput = Omit<Guest, "id" | "bookingId" | "isPrimary" | "sibaStatus" | "sibaSentAt" | "sibaMessage">;

/**
 * Replaces the guest list of a booking (online check-in or the desk form).
 * Guests already reported to SIBA keep their status when their data did not
 * change, so re-saving the form never sends a duplicate bulletin.
 */
export async function saveGuests(bookingId: string, guests: GuestInput[], requiresBulletin: (nat: string) => boolean): Promise<void> {
  await transaction(async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT * FROM booking_guests WHERE booking_id = $1 ORDER BY is_primary DESC, created_at`,
      [bookingId],
    );
    const existing = rows.map(toGuest);
    const fingerprint = (g: GuestInput | Guest) =>
      [g.firstName, g.lastName, g.nationality, g.birthDate, g.documentType, g.documentNumber, g.documentCountry, g.residenceCountry]
        .map((v) => String(v ?? "").trim().toUpperCase())
        .join("|");
    const sent = new Map(existing.filter((g) => g.sibaStatus === "sent").map((g) => [fingerprint(g), g]));

    await client.query(`DELETE FROM booking_guests WHERE booking_id = $1`, [bookingId]);
    for (const [i, g] of guests.entries()) {
      const previous = sent.get(fingerprint(g));
      const status = previous ? "sent" : requiresBulletin(g.nationality) ? "pending" : "not_required";
      await client.query(
        `INSERT INTO booking_guests
           (booking_id, is_primary, first_name, last_name, nationality, birth_date, birth_place,
            document_type, document_number, document_country, residence_country, residence_city,
            siba_status, siba_sent_at, siba_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          bookingId,
          i === 0,
          g.firstName,
          g.lastName,
          g.nationality.toUpperCase(),
          g.birthDate || null,
          g.birthPlace,
          g.documentType,
          g.documentNumber,
          g.documentCountry.toUpperCase(),
          g.residenceCountry.toUpperCase(),
          g.residenceCity,
          status,
          previous?.sibaSentAt ?? null,
          previous?.sibaMessage ?? "",
        ],
      );
    }
  });
}
