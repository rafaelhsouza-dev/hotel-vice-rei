import { query, transaction } from "../db";
import { getCalendar } from "../repo/availability";
import { getBooking, setBookingUnit, unitIsFree, type Booking } from "../repo/bookings";
import { readBookingRules } from "../repo/rate-plans";
import {
  addDays,
  cancellationFee,
  hotelNow,
  quoteStay,
  type PolicySnapshot,
  type Violation,
} from "./pricing";
import { findRatePlan } from "../repo/rate-plans";
import { lockRoomType } from "./service";

/**
 * State changes of a booking after it exists: modify, cancel, check-in,
 * check-out, no-show. Each runs in one transaction together with the unit
 * and housekeeping side effects, so the floor plan never disagrees with the
 * reservation list.
 */

export class BookingRuleError extends Error {
  constructor(message: string, readonly violations: Violation[] = []) {
    super(message);
    this.name = "BookingRuleError";
  }
}

const ALLOWED: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show", "pending"],
  checked_in: ["checked_out", "confirmed"],
  checked_out: ["checked_in"],
  cancelled: [],
  no_show: ["confirmed"],
};

export function canTransition(from: string, to: string): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

/** Fee the guest owes if the booking were cancelled today. */
export function feeIfCancelledToday(b: Booking): number {
  const policy = b.policy as PolicySnapshot;
  if (!policy || policy.refundable === undefined) return 0;
  return cancellationFee(policy, { checkIn: b.checkIn, total: b.total, nightly: b.nightly }, hotelNow().date);
}

export async function cancelBooking(
  id: string,
  opts: { reason: string; fee?: number | null; by: string },
): Promise<Booking> {
  const booking = await getBooking(id);
  if (!booking) throw new BookingRuleError("Reserva não encontrada.");
  if (!canTransition(booking.status, "cancelled")) {
    throw new BookingRuleError("Esta reserva já não pode ser cancelada.");
  }
  const fee = opts.fee != null && opts.fee >= 0 ? Math.round(opts.fee * 100) / 100 : feeIfCancelledToday(booking);
  await query(
    `UPDATE bookings SET status='cancelled', cancelled_at=now(), cancel_reason=$2, cancel_fee=$3, updated_at=now()
     WHERE id=$1`,
    [id, opts.reason.slice(0, 300), fee],
  );
  return (await getBooking(id))!;
}

export async function markNoShow(id: string, fee: number | null): Promise<void> {
  const booking = await getBooking(id);
  if (!booking) throw new BookingRuleError("Reserva não encontrada.");
  if (!canTransition(booking.status, "no_show")) throw new BookingRuleError("Só reservas confirmadas podem ficar como não comparência.");
  if (booking.checkIn > hotelNow().date) throw new BookingRuleError("A data de chegada ainda não passou.");
  const charge = fee != null ? fee : booking.policy.refundable === false ? booking.total : booking.nightly[0]?.price ?? 0;
  await query(
    `UPDATE bookings SET status='no_show', cancel_fee=$2, updated_at=now() WHERE id=$1`,
    [id, Math.round(charge * 100) / 100],
  );
}

/**
 * Guest arrives. Assigns a unit if none was, and marks it occupied. Refuses a
 * unit that is still being cleaned or under maintenance unless forced, so the
 * desk is told instead of sending a guest to a dirty room.
 */
export async function checkIn(id: string, opts: { unitId?: number | null; force?: boolean }): Promise<void> {
  await transaction(async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT id, status, room_id, unit_id, check_in, check_out FROM bookings WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const b = rows[0];
    if (!b) throw new BookingRuleError("Reserva não encontrada.");
    if (b.status !== "confirmed" && b.status !== "pending") throw new BookingRuleError("Esta reserva não está à espera de check-in.");
    const checkInDate = String(b.check_in).slice(0, 10);
    const checkOutDate = String(b.check_out).slice(0, 10);
    if (checkInDate > hotelNow().date) throw new BookingRuleError("O check-in só pode ser feito no dia da chegada.");

    let unitId = opts.unitId ?? (b.unit_id as number | null);
    if (!unitId) {
      const { rows: free } = await client.query<{ id: number }>(
        `SELECT u.id FROM units u
         WHERE u.active AND u.room_id = $1 AND u.status = 'available'
           AND NOT EXISTS (SELECT 1 FROM bookings x WHERE x.unit_id = u.id AND x.id <> $4
             AND x.status NOT IN ('cancelled','no_show') AND x.check_in < $3::date AND x.check_out > $2::date)
         ORDER BY u.floor, u.code LIMIT 1`,
        [b.room_id, checkInDate, checkOutDate, id],
      );
      unitId = free[0]?.id ?? null;
    }
    if (!unitId) throw new BookingRuleError("Não há nenhum quarto livre e limpo desta tipologia. Atribua um quarto manualmente.");
    if (!(await unitIsFree(client, unitId, checkInDate, checkOutDate, id))) {
      throw new BookingRuleError("Esse quarto está atribuído a outra estadia nestas datas.");
    }
    const { rows: unit } = await client.query<{ status: string; code: string }>(
      `SELECT status, code FROM units WHERE id=$1 FOR UPDATE`,
      [unitId],
    );
    if (!unit[0]) throw new BookingRuleError("Quarto inexistente.");
    if (!opts.force && unit[0].status !== "available") {
      throw new BookingRuleError(`O quarto ${unit[0].code} está em "${unit[0].status}". Confirme para fazer o check-in na mesma.`);
    }

    await setBookingUnit(client, id, unitId);
    await client.query(
      `UPDATE bookings SET status='checked_in', checked_in_at=now(), updated_at=now() WHERE id=$1`,
      [id],
    );
    await client.query(`UPDATE units SET status='occupied', updated_at=now() WHERE id=$1`, [unitId]);
  });
}

/**
 * Guest leaves. The unit goes to cleaning and a cleaning task is created for
 * housekeeping in the same transaction. An early departure shortens the stay
 * so the remaining nights go back on sale (the price is not changed here; the
 * desk adjusts the folio if the policy says so).
 */
export async function checkOut(id: string, opts: { by: string }): Promise<void> {
  await transaction(async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT id, status, unit_id, check_in, check_out, reference, room_id FROM bookings WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const b = rows[0];
    if (!b) throw new BookingRuleError("Reserva não encontrada.");
    if (b.status !== "checked_in") throw new BookingRuleError("Só é possível fazer check-out de uma estadia em curso.");
    const today = hotelNow().date;
    const plannedOut = String(b.check_out).slice(0, 10);
    const early = today < plannedOut && today > String(b.check_in).slice(0, 10);
    if (b.room_id) await lockRoomType(client, String(b.room_id));

    await client.query(
      `UPDATE bookings SET status='checked_out', checked_out_at=now(),
         check_out = CASE WHEN $2 THEN $3::date ELSE check_out END,
         nights = CASE WHEN $2 THEN ($3::date - check_in) ELSE nights END,
         updated_at=now() WHERE id=$1`,
      [id, early, today],
    );
    if (b.unit_id) {
      await client.query(
        `UPDATE units SET status='cleaning', updated_at=now() WHERE id=$1 AND status IN ('occupied','available')`,
        [b.unit_id],
      );
      await client.query(
        `INSERT INTO tasks (unit_id, kind, title, description, priority, due_date, booking_id)
         VALUES ($1,'cleaning',$2,$3,'high',$4::date,$5)`,
        [
          b.unit_id,
          "Limpeza de saída",
          `Check-out da reserva ${b.reference}${early ? " (saída antecipada)" : ""}.`,
          today,
          id,
        ],
      );
    }
  });
}

/** Back one step, for a mistaken click at the desk. */
export async function revertStatus(id: string, to: "confirmed" | "checked_in"): Promise<void> {
  const b = await getBooking(id);
  if (!b || !canTransition(b.status, to)) throw new BookingRuleError("Não é possível repor este estado.");
  await transaction(async (client) => {
    await client.query(`UPDATE bookings SET status=$2, updated_at=now() WHERE id=$1`, [id, to]);
    if (to === "confirmed" && b.status === "checked_in" && b.unitId) {
      await client.query(`UPDATE units SET status='available', updated_at=now() WHERE id=$1 AND status='occupied'`, [b.unitId]);
    }
    if (to === "checked_in" && b.status === "checked_out" && b.unitId) {
      await client.query(`UPDATE units SET status='occupied', updated_at=now() WHERE id=$1`, [b.unitId]);
    }
  });
}

export async function setStatusSimple(id: string, to: "confirmed" | "pending"): Promise<void> {
  const b = await getBooking(id);
  if (!b || !canTransition(b.status, to)) throw new BookingRuleError("Mudança de estado não permitida.");
  await query(`UPDATE bookings SET status=$2, updated_at=now() WHERE id=$1`, [id, to]);
}

/**
 * Changes dates, room type, guests or plan of a live booking. Availability
 * is re-checked under the room-type lock with this booking's own nights
 * discounted, so a booking can always be shortened or kept as it is.
 * `reprice` recomputes the total; otherwise the agreed total is kept.
 */
export async function modifyStay(
  id: string,
  change: {
    roomId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    ratePlanId: string;
    reprice: boolean;
    overrideRestrictions: boolean;
  },
): Promise<Booking> {
  const rules = await readBookingRules();
  await transaction(async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT * FROM bookings WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const b = rows[0];
    if (!b) throw new BookingRuleError("Reserva não encontrada.");
    if (!["pending", "confirmed", "checked_in"].includes(String(b.status))) {
      throw new BookingRuleError("Só reservas ativas podem ser alteradas.");
    }
    if (String(b.status) === "checked_in" && change.checkIn !== String(b.check_in).slice(0, 10)) {
      throw new BookingRuleError("Com o hóspede em casa, só a data de saída pode mudar.");
    }

    // Lock both room types (old and new) in a fixed order to avoid deadlocks.
    const ids = [...new Set([String(b.room_id ?? ""), change.roomId].filter(Boolean))].sort();
    for (const rid of ids) await lockRoomType(client, rid);

    const plan = await findRatePlan(change.ratePlanId, client);
    if (!plan) throw new BookingRuleError("Plano de tarifa inexistente.");
    const { rows: roomRows } = await client.query<{ capacity: number }>(`SELECT capacity FROM rooms WHERE id=$1`, [change.roomId]);
    if (!roomRows[0]) throw new BookingRuleError("Tipologia inexistente.");

    const days = await getCalendar(change.roomId, change.checkIn, change.checkOut, client);
    const ownIn = String(b.check_in).slice(0, 10);
    const ownOut = String(b.check_out).slice(0, 10);
    const sameRoom = String(b.room_id) === change.roomId;
    const lastNight = addDays(change.checkOut, -1);
    const nights = days
      .filter((d) => d.date <= lastNight)
      .map((d) => {
        // This booking already occupies these nights; give them back.
        const own = sameRoom && d.date >= ownIn && d.date < ownOut ? 1 : 0;
        return {
          date: d.date,
          rate: d.rate,
          free: d.free + own,
          closed: d.closed && !own,
          minStay: d.minStay,
          maxStay: d.maxStay,
          closedArrival: d.closedArrival,
          closedDeparture: d.closedDeparture,
        };
      });
    const dep = days.find((d) => d.date === change.checkOut);
    const now = hotelNow();
    const quote = quoteStay({
      checkIn: change.checkIn,
      checkOut: change.checkOut,
      adults: change.adults,
      children: change.children,
      capacity: roomRows[0].capacity,
      nights,
      departure: dep
        ? { date: dep.date, rate: dep.rate, free: dep.free, closed: dep.closed, minStay: dep.minStay, maxStay: dep.maxStay, closedArrival: dep.closedArrival, closedDeparture: dep.closedDeparture }
        : null,
      plan,
      extras: [],
      promoPercent: 0,
      rules,
      // Past arrival is fine when the guest is already in house.
      today: String(b.status) === "checked_in" ? ownIn : now.date,
      nowTime: now.time,
      staff: true,
    });
    const soft = new Set(["min_stay", "max_stay", "closed_arrival", "closed_departure", "advance_min", "advance_max", "too_far"]);
    const blocking = quote.violations.filter((v) => !(change.overrideRestrictions && soft.has(v.code)));
    if (blocking.length > 0) throw new BookingRuleError("A alteração não é possível com estas datas.", blocking);

    const extrasTotal = Number(b.extras_total);
    const discount = Number(b.discount);
    const total = change.reprice ? Math.max(0, Math.round((quote.base + extrasTotal - discount) * 100) / 100) : Number(b.total);

    let unitId = (b.unit_id as number | null) ?? null;
    if (unitId) {
      const { rows: u } = await client.query<{ room_id: string }>(`SELECT room_id FROM units WHERE id=$1`, [unitId]);
      const stillFits = u[0]?.room_id === change.roomId && (await unitIsFree(client, unitId, change.checkIn, change.checkOut, id));
      if (!stillFits) unitId = null;
    }

    await client.query(
      `UPDATE bookings SET room_id=$2, check_in=$3, check_out=$4, nights=$5, adults=$6, children=$7,
         rate_plan_id=$8, policy=$9::jsonb, nightly=$10::jsonb, base=$11, total=$12, tourist_tax=$13,
         unit_id=$14, updated_at=now()
       WHERE id=$1`,
      [
        id,
        change.roomId,
        change.checkIn,
        change.checkOut,
        quote.nights,
        change.adults,
        change.children,
        plan.id,
        JSON.stringify(quote.policy),
        JSON.stringify(quote.nightly),
        change.reprice ? quote.base : Number(b.base),
        total,
        quote.touristTax,
        unitId,
      ],
    );
  });
  return (await getBooking(id))!;
}
