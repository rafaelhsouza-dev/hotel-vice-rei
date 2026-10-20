import type { BookingRules } from "./rules";

/**
 * Pure booking maths: which stays are sellable, what they cost, and what a
 * cancellation costs. No database, no clock — callers pass `today` and `now`
 * — so every rule here is covered by unit tests.
 */

export type NightInfo = {
  date: string;
  /** The room type's rate for this night, before the rate plan applies. */
  rate: number;
  free: number;
  closed: boolean;
  minStay: number;
  maxStay: number | null;
  closedArrival: boolean;
  closedDeparture: boolean;
};

export type RatePlan = {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  board: "room_only" | "breakfast" | "half_board";
  adjustPct: number;
  adjustAmount: number;
  perGuestAmount: number;
  refundable: boolean;
  freeCancelDays: number;
  cancelPenalty: "none" | "first_night" | "percent" | "total";
  cancelPenaltyPct: number;
  paymentPolicy: "hotel" | "deposit" | "full";
  depositPct: number;
  minStay: number;
  maxStay: number | null;
  minAdvanceDays: number;
  maxAdvanceDays: number | null;
  roomIds: string[];
  active: boolean;
  position: number;
};

/** What a booking keeps of its plan, so later edits to the plan never rewrite it. */
export type PolicySnapshot = {
  planId: string;
  planName: Record<string, string>;
  board: RatePlan["board"];
  refundable: boolean;
  freeCancelDays: number;
  cancelPenalty: RatePlan["cancelPenalty"];
  cancelPenaltyPct: number;
  paymentPolicy: RatePlan["paymentPolicy"];
  depositPct: number;
};

export type Extra = { id: string; price: number; perNight: boolean };

export type Violation =
  | { code: "invalid_dates" }
  | { code: "past_date" }
  | { code: "same_day_cutoff" }
  | { code: "too_far"; max: number }
  | { code: "too_long"; max: number }
  | { code: "capacity"; max: number }
  | { code: "plan_unavailable" }
  | { code: "sold_out"; date: string }
  | { code: "closed"; date: string }
  | { code: "min_stay"; nights: number }
  | { code: "max_stay"; nights: number }
  | { code: "closed_arrival"; date: string }
  | { code: "closed_departure"; date: string }
  | { code: "advance_min"; days: number }
  | { code: "advance_max"; days: number };

export type QuoteRequest = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  capacity: number;
  /** One entry per night, check-in inclusive, check-out exclusive. */
  nights: NightInfo[];
  /** The check-out day itself, for closed-to-departure. Null if unknown. */
  departure: NightInfo | null;
  plan: RatePlan;
  extras: Extra[];
  promoPercent: number;
  rules: BookingRules;
  /** Hotel-local date (Europe/Lisbon) and time, injected for testability. */
  today: string;
  nowTime: string;
  /** Desk staff can sell what the public site may not (e.g. past cut-off). */
  staff?: boolean;
};

export type Quote = {
  ok: boolean;
  violations: Violation[];
  nights: number;
  nightly: { date: string; price: number }[];
  base: number;
  extrasTotal: number;
  discount: number;
  /** Room + extras − discount: the hotel's revenue for the stay. */
  total: number;
  /** Collected on behalf of the municipality, shown and paid separately. */
  touristTax: number;
  /** What the guest pays online at booking time under the plan's policy. */
  dueNow: number;
  policy: PolicySnapshot;
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const DAY = 86_400_000;

export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / DAY) : NaN;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** Date and HH:MM in the hotel's timezone, regardless of the server's. */
export function hotelNow(at: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function snapshotPolicy(plan: RatePlan): PolicySnapshot {
  return {
    planId: plan.id,
    planName: plan.name,
    board: plan.board,
    refundable: plan.refundable,
    freeCancelDays: plan.freeCancelDays,
    cancelPenalty: plan.cancelPenalty,
    cancelPenaltyPct: plan.cancelPenaltyPct,
    paymentPolicy: plan.paymentPolicy,
    depositPct: plan.depositPct,
  };
}

export function planNightPrice(plan: RatePlan, rate: number, adults: number): number {
  const adjusted = rate * (1 + plan.adjustPct / 100) + plan.adjustAmount;
  return round2(Math.max(0, adjusted) + plan.perGuestAmount * adults);
}

export function planAppliesToRoom(plan: RatePlan, roomId: string): boolean {
  return plan.active && (plan.roomIds.length === 0 || plan.roomIds.includes(roomId));
}

export function touristTaxFor(
  rules: BookingRules,
  nights: number,
  adults: number,
  children: number,
): number {
  if (!rules.touristTax.enabled || nights <= 0) return 0;
  // Children are declared only as "up to childMaxAge"; if that range reaches
  // the taxable age we cannot prove they are exempt, so they are charged.
  const taxedChildren = rules.childMaxAge >= rules.touristTax.exemptUnderAge ? children : 0;
  const guests = adults + taxedChildren;
  return round2(guests * Math.min(nights, rules.touristTax.maxNights) * rules.touristTax.amount);
}

export function quoteStay(req: QuoteRequest): Quote {
  const violations: Violation[] = [];
  const nightsCount = daysBetween(req.checkIn, req.checkOut);
  const policy = snapshotPolicy(req.plan);
  const empty: Quote = {
    ok: false,
    violations,
    nights: 0,
    nightly: [],
    base: 0,
    extrasTotal: 0,
    discount: 0,
    total: 0,
    touristTax: 0,
    dueNow: 0,
    policy,
  };

  if (!isIsoDate(req.checkIn) || !isIsoDate(req.checkOut) || !(nightsCount > 0)) {
    violations.push({ code: "invalid_dates" });
    return empty;
  }

  const lead = daysBetween(req.today, req.checkIn);
  if (lead < 0) violations.push({ code: "past_date" });
  if (!req.staff && lead === 0 && req.nowTime > req.rules.sameDayCutoff) {
    violations.push({ code: "same_day_cutoff" });
  }
  if (!req.staff && lead > req.rules.maxAdvanceDays) {
    violations.push({ code: "too_far", max: req.rules.maxAdvanceDays });
  }
  if (nightsCount > req.rules.maxNights) {
    violations.push({ code: "too_long", max: req.rules.maxNights });
  }
  if (req.adults < 1 || req.adults + req.children > req.capacity) {
    violations.push({ code: "capacity", max: req.capacity });
  }
  if (!req.plan.active) violations.push({ code: "plan_unavailable" });
  if (!req.staff && lead < req.plan.minAdvanceDays) {
    violations.push({ code: "advance_min", days: req.plan.minAdvanceDays });
  }
  if (!req.staff && req.plan.maxAdvanceDays != null && lead > req.plan.maxAdvanceDays) {
    violations.push({ code: "advance_max", days: req.plan.maxAdvanceDays });
  }

  // Every night must be present; a gap means the calendar could not be read
  // for that date, which must never be treated as available.
  const byDate = new Map(req.nights.map((n) => [n.date, n]));
  const nightly: { date: string; price: number }[] = [];
  let minStay = req.plan.minStay;
  let maxStay = req.plan.maxStay;

  for (let i = 0; i < nightsCount; i++) {
    const date = addDays(req.checkIn, i);
    const night = byDate.get(date);
    if (!night) {
      violations.push({ code: "sold_out", date });
      continue;
    }
    if (night.closed) violations.push({ code: "closed", date });
    else if (night.free <= 0) violations.push({ code: "sold_out", date });
    if (i === 0) {
      if (night.closedArrival) violations.push({ code: "closed_arrival", date });
      // Length-of-stay rules are those of the arrival day, as OTAs apply them.
      minStay = Math.max(minStay, night.minStay);
      if (night.maxStay != null) maxStay = maxStay == null ? night.maxStay : Math.min(maxStay, night.maxStay);
    }
    nightly.push({ date, price: planNightPrice(req.plan, night.rate, req.adults) });
  }

  if (req.departure?.closedDeparture) {
    violations.push({ code: "closed_departure", date: req.departure.date });
  }
  if (nightsCount < minStay) violations.push({ code: "min_stay", nights: minStay });
  if (maxStay != null && nightsCount > maxStay) violations.push({ code: "max_stay", nights: maxStay });

  const base = round2(nightly.reduce((s, n) => s + n.price, 0));
  const extrasTotal = round2(
    req.extras.reduce((s, e) => s + (e.perNight ? e.price * nightsCount : e.price), 0),
  );
  const pct = Math.min(0.9, Math.max(0, req.promoPercent));
  const discount = round2((base + extrasTotal) * pct);
  const total = Math.max(0, round2(base + extrasTotal - discount));
  const touristTax = touristTaxFor(req.rules, nightsCount, req.adults, req.children);

  let dueNow = 0;
  if (req.plan.paymentPolicy === "full") dueNow = total;
  else if (req.plan.paymentPolicy === "deposit") {
    dueNow = round2(total * Math.min(100, Math.max(0, req.plan.depositPct)) / 100);
  }

  return {
    ok: violations.length === 0,
    violations,
    nights: nightsCount,
    nightly,
    base,
    extrasTotal,
    discount,
    total,
    touristTax,
    dueNow,
    policy,
  };
}

/**
 * Last moment a refundable booking can be cancelled for free: midnight
 * (hotel time) `freeCancelDays` before the arrival date. Returned as the
 * hotel-local date from which the penalty applies.
 */
export function penaltyFrom(policy: PolicySnapshot, checkIn: string): string | null {
  if (!policy.refundable) return null;
  return addDays(checkIn, -policy.freeCancelDays);
}

/** What cancelling costs today, given the policy the guest booked under. */
export function cancellationFee(
  policy: PolicySnapshot,
  booking: { checkIn: string; total: number; nightly: { price: number }[] },
  today: string,
): number {
  if (!policy.refundable) return round2(booking.total);
  const from = penaltyFrom(policy, booking.checkIn)!;
  if (today < from) return 0;
  switch (policy.cancelPenalty) {
    case "none":
      return 0;
    case "first_night":
      return round2(Math.min(booking.total, booking.nightly[0]?.price ?? 0));
    case "percent":
      return round2((booking.total * Math.min(100, Math.max(0, policy.cancelPenaltyPct))) / 100);
    case "total":
      return round2(booking.total);
  }
}

/** Fallback when the hotel has not configured any plan yet. */
export const STANDARD_PLAN: RatePlan = {
  id: "standard",
  name: { pt: "Tarifa flexível", en: "Flexible rate", es: "Tarifa flexible", fr: "Tarif flexible" },
  description: {
    pt: "Cancelamento gratuito até 48 horas antes da chegada. Pagamento no hotel.",
    en: "Free cancellation up to 48 hours before arrival. Pay at the hotel.",
    es: "Cancelación gratuita hasta 48 horas antes de la llegada. Pago en el hotel.",
    fr: "Annulation gratuite jusqu'à 48 heures avant l'arrivée. Paiement à l'hôtel.",
  },
  board: "room_only",
  adjustPct: 0,
  adjustAmount: 0,
  perGuestAmount: 0,
  refundable: true,
  freeCancelDays: 2,
  cancelPenalty: "first_night",
  cancelPenaltyPct: 0,
  paymentPolicy: "hotel",
  depositPct: 0,
  minStay: 1,
  maxStay: null,
  minAdvanceDays: 0,
  maxAdvanceDays: null,
  roomIds: [],
  active: true,
  position: 0,
};
