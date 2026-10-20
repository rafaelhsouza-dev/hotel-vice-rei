import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction } from "../db";
import { getCalendar, type DayAvailability } from "../repo/availability";
import { findRatePlan, readBookingRules } from "../repo/rate-plans";
import {
  addDays,
  hotelNow,
  planAppliesToRoom,
  quoteStay,
  type NightInfo,
  type Quote,
  type RatePlan,
  type Violation,
} from "./pricing";
import type { BookingRules } from "./rules";

/**
 * Writing bookings. The one place where inventory is checked and taken.
 *
 * Two guests reserving the last room at the same instant is the classic
 * failure: both read "1 free", both insert. Every write here takes a
 * transaction-scoped advisory lock on the room type first, then re-reads the
 * calendar *inside* that transaction, so the second writer waits for the
 * first to commit and then sees the room as taken.
 */

export type BookingSource = "site" | "desk" | "phone" | "email" | "walk_in" | "channel" | "extranet";

export type StayRequest = {
  roomId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  extras: string[];
  promoCode: string;
};

export type GuestInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  locale: string;
};

type RoomRow = { id: string; capacity: number; published: boolean };
type ExtraRow = { id: string; price: string; per_night: boolean };

export type PricedStay = {
  quote: Quote;
  plan: RatePlan | null;
  room: RoomRow | null;
  extras: string[];
  promo: { code: string; percent: number } | null;
};

function toNight(d: DayAvailability): NightInfo {
  return {
    date: d.date,
    rate: d.rate,
    free: d.free,
    closed: d.closed,
    minStay: d.minStay,
    maxStay: d.maxStay,
    closedArrival: d.closedArrival,
    closedDeparture: d.closedDeparture,
  };
}

async function loadRoom(roomId: string, client?: PoolClient): Promise<RoomRow | null> {
  const sql = `SELECT id, capacity, published FROM rooms WHERE id = $1`;
  const rows = client
    ? (await client.query<RoomRow>(sql, [roomId])).rows
    : await query<RoomRow>(sql, [roomId]);
  return rows[0] ?? null;
}

async function loadExtras(ids: string[], client?: PoolClient): Promise<{ id: string; price: number; perNight: boolean }[]> {
  if (ids.length === 0) return [];
  const sql = `SELECT id, price, per_night FROM extras WHERE active = true AND id = ANY($1::text[])`;
  const rows = client ? (await client.query<ExtraRow>(sql, [ids])).rows : await query<ExtraRow>(sql, [ids]);
  return rows.map((r) => ({ id: r.id, price: Number(r.price), perNight: r.per_night }));
}

async function loadPromo(code: string, client?: PoolClient): Promise<{ code: string; percent: number } | null> {
  const clean = code.toUpperCase().trim();
  if (!clean) return null;
  const sql = `SELECT code, percent FROM promo_codes
     WHERE code = $1 AND active = true AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)`;
  const rows = client
    ? (await client.query<{ code: string; percent: string }>(sql, [clean])).rows
    : await query<{ code: string; percent: string }>(sql, [clean]);
  return rows[0] ? { code: rows[0].code, percent: Number(rows[0].percent) } : null;
}

/**
 * Prices a stay against live inventory. With `client`, reads inside the
 * caller's transaction (after the lock); without, it is a plain quote.
 */
export async function priceStay(
  req: StayRequest,
  opts: { staff?: boolean; client?: PoolClient; rules?: BookingRules } = {},
): Promise<PricedStay> {
  const rules = opts.rules ?? (await readBookingRules());
  const now = hotelNow();
  // Sequential on purpose: a pg client runs one query at a time, and inside
  // the booking transaction everything must go through that one client.
  const room = await loadRoom(req.roomId, opts.client);
  const plan = await findRatePlan(req.ratePlanId, opts.client);
  const extras = await loadExtras([...new Set(req.extras)].slice(0, 20), opts.client);
  const promo = await loadPromo(req.promoCode, opts.client);

  const unavailable = (code: Violation): PricedStay => ({
    room,
    plan,
    extras: [],
    promo,
    quote: {
      ok: false,
      violations: [code],
      nights: 0,
      nightly: [],
      base: 0,
      extrasTotal: 0,
      discount: 0,
      total: 0,
      touristTax: 0,
      dueNow: 0,
      policy: {
        planId: req.ratePlanId,
        planName: plan?.name ?? {},
        board: plan?.board ?? "room_only",
        refundable: plan?.refundable ?? true,
        freeCancelDays: plan?.freeCancelDays ?? 0,
        cancelPenalty: plan?.cancelPenalty ?? "none",
        cancelPenaltyPct: plan?.cancelPenaltyPct ?? 0,
        paymentPolicy: plan?.paymentPolicy ?? "hotel",
        depositPct: plan?.depositPct ?? 0,
      },
    },
  });

  if (!room || (!opts.staff && !room.published)) return unavailable({ code: "sold_out", date: req.checkIn });
  if (!plan || !planAppliesToRoom(plan, room.id)) return unavailable({ code: "plan_unavailable" });

  // Read one day past check-out for closed-to-departure.
  const lastNight = addDays(req.checkOut, -1);
  const days =
    req.checkOut > req.checkIn
      ? await getCalendar(room.id, req.checkIn, req.checkOut, opts.client)
      : [];
  const nights = days.filter((d) => d.date <= lastNight).map(toNight);
  const departure = days.find((d) => d.date === req.checkOut);

  const quote = quoteStay({
    checkIn: req.checkIn,
    checkOut: req.checkOut,
    adults: req.adults,
    children: req.children,
    capacity: room.capacity,
    nights,
    departure: departure ? toNight(departure) : null,
    plan,
    extras,
    promoPercent: promo?.percent ?? 0,
    rules,
    today: now.date,
    nowTime: now.time,
    staff: opts.staff,
  });

  return { quote, plan, room, extras: extras.map((e) => e.id), promo };
}

/** Human-friendly, non-sequential reference such as VR-7F3K9Q. */
export function makeReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `VR-${out}`;
}

/** Long random token for the guest's own links (check-in, payment). */
export function makeGuestToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function lockRoomType(client: PoolClient, roomId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`vicerei:room:${roomId}`]);
}

/** First unit of the type free for the whole stay, or null. */
async function pickUnit(
  client: PoolClient,
  roomId: string,
  checkIn: string,
  checkOut: string,
): Promise<number | null> {
  const { rows } = await client.query<{ id: number }>(
    `SELECT u.id FROM units u
     WHERE u.active AND u.room_id = $1 AND u.status <> 'blocked'
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.unit_id = u.id AND b.status NOT IN ('cancelled','no_show')
           AND b.check_in < $3::date AND b.check_out > $2::date)
     ORDER BY u.floor, u.code
     LIMIT 1`,
    [roomId, checkIn, checkOut],
  );
  return rows[0]?.id ?? null;
}

/** Violations the desk may knowingly override. Inventory is never one of them. */
const OVERRIDABLE = new Set<Violation["code"]>([
  "min_stay",
  "max_stay",
  "closed_arrival",
  "closed_departure",
  "advance_min",
  "advance_max",
  "same_day_cutoff",
  "too_far",
]);

export type PlaceResult =
  | {
      ok: true;
      id: string;
      reference: string;
      guestToken: string;
      status: "pending" | "confirmed";
      quote: Quote;
      unitId: number | null;
    }
  | { ok: false; violations: Violation[] };

export async function placeBooking(
  req: StayRequest,
  guest: GuestInput,
  opts: {
    source: BookingSource;
    staff?: boolean;
    /** Desk only: accept restriction violations (never inventory). */
    overrideRestrictions?: boolean;
    channelId?: string | null;
    externalRef?: string;
    commission?: number;
    /** Desk/extranet price agreed outside the engine. */
    totalOverride?: number | null;
    createdBy?: string;
    forceStatus?: "pending" | "confirmed";
  },
): Promise<PlaceResult> {
  const rules = await readBookingRules();

  return transaction(async (client) => {
    await lockRoomType(client, req.roomId);
    const priced = await priceStay(req, { staff: opts.staff, client, rules });
    const { quote } = priced;

    const blocking = quote.violations.filter(
      (v) => !(opts.staff && opts.overrideRestrictions && OVERRIDABLE.has(v.code)),
    );
    if (blocking.length > 0 || quote.nights <= 0) {
      return { ok: false, violations: blocking.length ? blocking : quote.violations };
    }

    let total = quote.total;
    let discount = quote.discount;
    if (opts.totalOverride != null && opts.totalOverride >= 0) {
      total = Math.round(opts.totalOverride * 100) / 100;
      discount = 0;
    }
    const dueNow =
      opts.source === "site" ? quote.dueNow : 0;
    const status =
      opts.forceStatus ?? (dueNow > 0 ? "pending" : rules.autoConfirm || opts.staff ? "confirmed" : "pending");

    const unitId = await pickUnit(client, req.roomId, req.checkIn, req.checkOut);
    const guestToken = makeGuestToken();

    for (let attempt = 0; attempt < 5; attempt++) {
      const reference = makeReference();
      try {
        await client.query("SAVEPOINT ref_attempt");
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO bookings
             (reference, first_name, last_name, email, phone, country, notes, room_id,
              check_in, check_out, nights, adults, children, extras, promo_code, base,
              extras_total, discount, total, payment_method, status, locale, rate_plan_id,
              policy, nightly, tourist_tax, source, channel_id, external_ref, commission,
              amount_due_now, payment_status, guest_token, unit_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,
                   $20,$21,$22,$23,$24::jsonb,$25::jsonb,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
           RETURNING id`,
          [
            reference,
            guest.firstName,
            guest.lastName,
            guest.email,
            guest.phone,
            guest.country,
            guest.notes,
            req.roomId,
            req.checkIn,
            req.checkOut,
            quote.nights,
            req.adults,
            req.children,
            JSON.stringify(priced.extras),
            priced.promo?.code ?? null,
            quote.base,
            quote.extrasTotal,
            discount,
            total,
            dueNow > 0 ? "online" : "hotel",
            status,
            guest.locale,
            priced.plan!.id,
            JSON.stringify(quote.policy),
            JSON.stringify(quote.nightly),
            quote.touristTax,
            opts.source,
            opts.channelId ?? null,
            opts.externalRef ?? "",
            opts.commission ?? 0,
            dueNow,
            dueNow > 0 ? "pending" : "unpaid",
            guestToken,
            unitId,
            opts.createdBy ?? "",
          ],
        );
        await client.query("RELEASE SAVEPOINT ref_attempt");
        const id = rows[0].id;

        await client.query(
          `INSERT INTO booking_guests (booking_id, is_primary, first_name, last_name, residence_country)
           VALUES ($1, true, $2, $3, $4)`,
          [id, guest.firstName, guest.lastName, guest.country.slice(0, 80)],
        );
        if (priced.promo) {
          await client.query(`UPDATE promo_codes SET uses = uses + 1 WHERE code = $1`, [priced.promo.code]);
        }
        return { ok: true, id, reference, guestToken, status, quote: { ...quote, total, discount, dueNow }, unitId };
      } catch (err) {
        await client.query("ROLLBACK TO SAVEPOINT ref_attempt");
        if (!(err as Error).message.includes("bookings_reference_key")) throw err;
      }
    }
    throw new Error("Could not allocate a booking reference");
  });
}

export type StayOption = {
  roomId: string;
  /** Some plan can be booked for these dates and guests. */
  available: boolean;
  /** Why not, when nothing can be booked: the first blocking rule. */
  reason: Violation | null;
  plans: {
    planId: string;
    ok: boolean;
    violations: Violation[];
    total: number;
    nightlyAverage: number;
    touristTax: number;
    dueNow: number;
  }[];
};

/**
 * Every room type × rate plan for one search, from a single calendar read.
 * Used by the public booking flow to show what can actually be booked.
 */
export async function searchStays(input: {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  plans: RatePlan[];
  /** Plans that take money online are hidden when no provider is set up. */
  onlinePayments: boolean;
}): Promise<{ violations: Violation[]; options: StayOption[] }> {
  const rules = await readBookingRules();
  const now = hotelNow();
  const rooms = await query<RoomRow>(
    `SELECT id, capacity, published FROM rooms WHERE published = true ORDER BY position, id`,
  );
  const sellable = input.plans.filter(
    (p) => p.active && (input.onlinePayments || p.paymentPolicy === "hotel"),
  );

  const valid = input.checkOut > input.checkIn;
  const days = valid ? await getCalendar(null, input.checkIn, input.checkOut) : [];
  const lastNight = valid ? addDays(input.checkOut, -1) : input.checkIn;

  const options: StayOption[] = rooms.map((room) => {
    const roomDays = days.filter((d) => d.roomId === room.id);
    const nights = roomDays.filter((d) => d.date <= lastNight).map(toNight);
    const dep = roomDays.find((d) => d.date === input.checkOut);
    const plans = sellable
      .filter((p) => planAppliesToRoom(p, room.id))
      .map((plan) => {
        const q = quoteStay({
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          adults: input.adults,
          children: input.children,
          capacity: room.capacity,
          nights,
          departure: dep ? toNight(dep) : null,
          plan,
          extras: [],
          promoPercent: 0,
          rules,
          today: now.date,
          nowTime: now.time,
        });
        return {
          planId: plan.id,
          ok: q.ok,
          violations: q.violations,
          total: q.total,
          nightlyAverage: q.nights > 0 ? Math.round((q.base / q.nights) * 100) / 100 : 0,
          touristTax: q.touristTax,
          dueNow: q.dueNow,
        };
      });
    const ok = plans.some((p) => p.ok);
    return {
      roomId: room.id,
      available: ok,
      reason: ok ? null : plans[0]?.violations[0] ?? { code: "plan_unavailable" },
      plans,
    };
  });

  // Rules that do not depend on the room (dates, lead time) are reported once.
  const GLOBAL = new Set(["invalid_dates", "past_date", "same_day_cutoff", "too_far", "too_long"]);
  const first = options.flatMap((o) => o.plans.flatMap((p) => p.violations));
  const violations = valid ? first.filter((v) => GLOBAL.has(v.code)).slice(0, 1) : [{ code: "invalid_dates" } as Violation];
  return { violations, options };
}
