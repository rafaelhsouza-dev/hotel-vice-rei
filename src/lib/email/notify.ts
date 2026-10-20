import { query, queryOne } from "../db";
import { SITE_URL } from "../site";
import { getBooking, type Booking } from "../repo/bookings";
import { readBookingRules } from "../repo/rate-plans";
import { penaltyFrom, type PolicySnapshot } from "../booking/pricing";
import { sendEmail } from "./send";
import { bookingEmail, multibancoBlock, type Block, type Lang, type StaySummary } from "./templates";

/**
 * High-level guest notifications. Each takes a booking id, loads what it
 * needs and never throws — a failed e-mail is logged in `email_log` and must
 * never undo the booking, payment or cancellation that triggered it.
 */

const LANGS = ["pt", "en", "es", "fr"] as const;
const lang = (v: string): Lang => ((LANGS as readonly string[]).includes(v) ? (v as Lang) : "pt");

export function guestUrl(b: Pick<Booking, "locale" | "guestToken">, path = ""): string {
  return `${SITE_URL}/${lang(b.locale)}/reserva/${b.guestToken ?? ""}${path}`;
}

async function summary(b: Booking): Promise<StaySummary> {
  const rules = await readBookingRules();
  const hotel = await queryOne<{ phones: string[] }>(`SELECT phones FROM settings WHERE id = 1`).catch(() => null);
  const room = await queryOne<{ name: Record<string, string> }>(`SELECT name FROM rooms WHERE id = $1`, [b.roomId]).catch(
    () => null,
  );
  const l = lang(b.locale);
  const policy = b.policy as Partial<PolicySnapshot>;
  return {
    lang: l,
    firstName: b.firstName,
    reference: b.reference,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    roomName: room?.name?.[l] ?? b.roomName,
    planName: policy.planName?.[l] ?? policy.planName?.pt ?? "",
    adults: b.adults,
    children: b.children,
    total: b.total,
    touristTax: b.touristTax,
    paid: b.paidTotal,
    refundable: policy.refundable !== false,
    penaltyFrom: policy.refundable !== undefined ? penaltyFrom(policy as PolicySnapshot, b.checkIn) : null,
    payAtHotel: b.amountDueNow <= 0,
    manageUrl: guestUrl(b),
    checkInFrom: rules.checkInFrom,
    checkInUntil: rules.checkInUntil,
    checkOutUntil: rules.checkOutUntil,
    phone: hotel?.phones?.[0] ?? "+351 225 430 120",
  };
}

async function deliver(
  b: Booking,
  template: string,
  mail: { subject: string; html: string; text: string },
  copyReception: boolean,
) {
  return sendEmail({ to: b.email, ...mail, template, bookingId: b.id, copyReception });
}

/** Right after the booking is placed (and again when a pending one confirms). */
export async function notifyBookingPlaced(
  bookingId: string,
  payment?: { entity: string; reference: string; amount: number; expiresAt: string | null } | { url: string },
): Promise<boolean> {
  try {
    const b = await getBooking(bookingId);
    if (!b) return false;
    const s = await summary(b);
    const blocks: Block[] = [];
    let payUrl: string | undefined;
    if (payment && "entity" in payment) blocks.push(multibancoBlock(s.lang, payment));
    if (payment && "url" in payment) payUrl = payment.url;
    const kind = b.status === "confirmed" ? "confirmed" : "pending";
    const r = await deliver(b, `booking_${kind}`, bookingEmail(kind, s, { blocks, payUrl }), true);
    return r.ok;
  } catch (err) {
    console.error("[notify] booking placed:", (err as Error).message);
    return false;
  }
}

export async function notifyPaymentReceived(bookingId: string) {
  try {
    const b = await getBooking(bookingId);
    if (!b) return;
    const s = await summary(b);
    await deliver(b, "payment_received", bookingEmail(b.status === "confirmed" ? "confirmed" : "paid", s), true);
  } catch (err) {
    console.error("[notify] payment:", (err as Error).message);
  }
}

export async function notifyCancelled(bookingId: string, reason: "guest" | "hotel" | "expired") {
  try {
    const b = await getBooking(bookingId);
    if (!b) return;
    const s = await summary(b);
    await deliver(
      b,
      reason === "expired" ? "booking_expired" : "booking_cancelled",
      bookingEmail(reason === "expired" ? "expired" : "cancelled", s, { cancelFee: b.cancelFee }),
      true,
    );
  } catch (err) {
    console.error("[notify] cancel:", (err as Error).message);
  }
}

export async function notifyCheckinDone(bookingId: string) {
  try {
    const b = await getBooking(bookingId);
    if (!b) return;
    await deliver(b, "checkin_done", bookingEmail("checkin_done", await summary(b)), false);
  } catch (err) {
    console.error("[notify] checkin:", (err as Error).message);
  }
}

/**
 * Daily job: reminder with the online check-in link, N days before arrival,
 * once per booking. Marked sent before the e-mail goes out, so a crash never
 * produces a second reminder.
 */
export async function sendArrivalReminders(): Promise<number> {
  const rules = await readBookingRules();
  if (rules.reminderDaysBefore <= 0) return 0;
  const due = await query<{ id: string }>(
    `UPDATE bookings SET reminder_sent_at = now()
     WHERE id IN (
       SELECT id FROM bookings
       WHERE status = 'confirmed' AND reminder_sent_at IS NULL AND checkin_done_at IS NULL
         AND email <> '' AND source IN ('site','desk','phone','email')
         AND check_in > (now() AT TIME ZONE 'Europe/Lisbon')::date
         AND check_in <= (now() AT TIME ZONE 'Europe/Lisbon')::date + $1::int
       LIMIT 100)
     RETURNING id`,
    [rules.reminderDaysBefore],
  );
  for (const { id } of due) {
    try {
      const b = await getBooking(id);
      if (!b) continue;
      const s = await summary(b);
      await deliver(b, "arrival_reminder", bookingEmail("reminder", s, { checkinUrl: guestUrl(b, "/checkin") }), false);
    } catch (err) {
      console.error("[notify] reminder:", (err as Error).message);
    }
  }
  return due.length;
}

/** Sends a sample of each template to an address, from the admin. */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; message: string }> {
  const s: StaySummary = {
    lang: "pt",
    firstName: "Teste",
    reference: "VR-TESTE1",
    checkIn: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10),
    nights: 2,
    roomName: "Duplo Superior",
    planName: "Tarifa flexível",
    adults: 2,
    children: 0,
    total: 111.8,
    touristTax: 12,
    paid: 0,
    refundable: true,
    penaltyFrom: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    payAtHotel: true,
    manageUrl: `${SITE_URL}/pt`,
    checkInFrom: "15:00",
    checkInUntil: "21:30",
    checkOutUntil: "12:00",
    phone: "+351 225 430 120",
  };
  const mail = bookingEmail("confirmed", s);
  return sendEmail({ to, ...mail, subject: `[Teste] ${mail.subject}`, template: "test" });
}
