/**
 * Booking-engine settings the hotel edits in the admin (Definições → Reservas).
 *
 * Stored as one jsonb document in `settings.booking_rules` and always read
 * through `normaliseRules`, so a missing or malformed key falls back to a safe
 * default instead of breaking the booking flow.
 */

export type BookingRules = {
  touristTax: {
    enabled: boolean;
    /** € per guest per night. Porto: 3 € (CM Porto), under review. */
    amount: number;
    /** Nights charged at most per stay. Porto: 7. */
    maxNights: number;
    /** Guests younger than this are exempt. Porto: 13. */
    exemptUnderAge: number;
  };
  /** Children in the booking form are 0 up to this age (inclusive). */
  childMaxAge: number;
  checkInFrom: string;
  checkInUntil: string;
  checkOutUntil: string;
  /** Latest local time (HH:MM) to book a same-day arrival on the site. */
  sameDayCutoff: string;
  maxNights: number;
  maxAdvanceDays: number;
  /** Site bookings land confirmed when inventory was locked and checked. */
  autoConfirm: boolean;
  /** VAT on accommodation, used when issuing invoices. */
  vatAccommodation: number;
  /** Unpaid online reservations release the room after this many hours. */
  paymentHoldHours: number;
  /** Days before arrival when the reminder with the check-in link goes out. */
  reminderDaysBefore: number;
};

export const DEFAULT_RULES: BookingRules = {
  touristTax: { enabled: true, amount: 3, maxNights: 7, exemptUnderAge: 13 },
  childMaxAge: 12,
  checkInFrom: "15:00",
  checkInUntil: "21:30",
  checkOutUntil: "12:00",
  sameDayCutoff: "20:00",
  maxNights: 30,
  maxAdvanceDays: 500,
  autoConfirm: true,
  vatAccommodation: 6,
  paymentHoldHours: 48,
  reminderDaysBefore: 3,
};

const time = (v: unknown, fallback: string) =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function normaliseRules(raw: unknown): BookingRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const t = (r.touristTax && typeof r.touristTax === "object" ? r.touristTax : {}) as Record<string, unknown>;
  const d = DEFAULT_RULES;
  return {
    touristTax: {
      enabled: bool(t.enabled, d.touristTax.enabled),
      amount: num(t.amount, d.touristTax.amount, 0, 50),
      maxNights: num(t.maxNights, d.touristTax.maxNights, 1, 365),
      exemptUnderAge: num(t.exemptUnderAge, d.touristTax.exemptUnderAge, 0, 30),
    },
    childMaxAge: num(r.childMaxAge, d.childMaxAge, 0, 17),
    checkInFrom: time(r.checkInFrom, d.checkInFrom),
    checkInUntil: time(r.checkInUntil, d.checkInUntil),
    checkOutUntil: time(r.checkOutUntil, d.checkOutUntil),
    sameDayCutoff: time(r.sameDayCutoff, d.sameDayCutoff),
    maxNights: num(r.maxNights, d.maxNights, 1, 365),
    maxAdvanceDays: num(r.maxAdvanceDays, d.maxAdvanceDays, 1, 1000),
    autoConfirm: bool(r.autoConfirm, d.autoConfirm),
    vatAccommodation: num(r.vatAccommodation, d.vatAccommodation, 0, 30),
    paymentHoldHours: num(r.paymentHoldHours, d.paymentHoldHours, 1, 240),
    reminderDaysBefore: num(r.reminderDaysBefore, d.reminderDaysBefore, 0, 30),
  };
}
