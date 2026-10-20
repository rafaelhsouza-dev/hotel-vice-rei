import { describe, expect, it } from "vitest";
import {
  STANDARD_PLAN,
  addDays,
  cancellationFee,
  quoteStay,
  touristTaxFor,
  type NightInfo,
  type QuoteRequest,
  type RatePlan,
} from "./pricing";
import { DEFAULT_RULES, normaliseRules } from "./rules";

const night = (date: string, over: Partial<NightInfo> = {}): NightInfo => ({
  date,
  rate: 50,
  free: 3,
  closed: false,
  minStay: 1,
  maxStay: null,
  closedArrival: false,
  closedDeparture: false,
  ...over,
});

function req(over: Partial<QuoteRequest> = {}): QuoteRequest {
  const checkIn = over.checkIn ?? "2026-11-10";
  const checkOut = over.checkOut ?? "2026-11-13";
  const nights: NightInfo[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) nights.push(night(d));
  return {
    checkIn,
    checkOut,
    adults: 2,
    children: 0,
    capacity: 2,
    nights,
    departure: night(checkOut),
    plan: STANDARD_PLAN,
    extras: [],
    promoPercent: 0,
    rules: DEFAULT_RULES,
    today: "2026-10-20",
    nowTime: "10:00",
    ...over,
  };
}

describe("quoteStay", () => {
  it("prices each night from the calendar rate", () => {
    const r = req();
    r.nights[1].rate = 80;
    const q = quoteStay(r);
    expect(q.ok).toBe(true);
    expect(q.nights).toBe(3);
    expect(q.nightly.map((n) => n.price)).toEqual([50, 80, 50]);
    expect(q.base).toBe(180);
    expect(q.total).toBe(180);
  });

  it("refuses a sold-out or closed night, and a missing calendar day", () => {
    const sold = req();
    sold.nights[2].free = 0;
    expect(quoteStay(sold).violations).toContainEqual({ code: "sold_out", date: "2026-11-12" });

    const closed = req();
    closed.nights[0].closed = true;
    expect(quoteStay(closed).violations).toContainEqual({ code: "closed", date: "2026-11-10" });

    const gap = req();
    gap.nights.splice(1, 1);
    const q = quoteStay(gap);
    expect(q.ok).toBe(false);
    expect(q.violations).toContainEqual({ code: "sold_out", date: "2026-11-11" });
  });

  it("applies arrival-day length-of-stay rules and CTA/CTD", () => {
    const r = req();
    r.nights[0].minStay = 4;
    expect(quoteStay(r).violations).toContainEqual({ code: "min_stay", nights: 4 });

    const m = req();
    m.nights[0].maxStay = 2;
    expect(quoteStay(m).violations).toContainEqual({ code: "max_stay", nights: 2 });

    const cta = req();
    cta.nights[0].closedArrival = true;
    expect(quoteStay(cta).violations[0]).toEqual({ code: "closed_arrival", date: "2026-11-10" });

    const ctd = req();
    ctd.departure = night("2026-11-13", { closedDeparture: true });
    expect(quoteStay(ctd).violations).toContainEqual({ code: "closed_departure", date: "2026-11-13" });
  });

  it("rejects invalid, past, too-long and over-capacity stays", () => {
    expect(quoteStay(req({ checkOut: "2026-11-10" })).violations[0].code).toBe("invalid_dates");
    expect(quoteStay(req({ checkIn: "2026-10-19", checkOut: "2026-10-21" })).violations.map((v) => v.code)).toContain("past_date");
    expect(quoteStay(req({ adults: 2, children: 1 })).violations.map((v) => v.code)).toContain("capacity");
    const long = req({ checkIn: "2026-11-01", checkOut: "2026-12-15" });
    expect(long.nights.length).toBe(44);
    expect(quoteStay(long).violations.map((v) => v.code)).toContain("too_long");
  });

  it("closes same-day booking after the cut-off, but not for staff", () => {
    const r = req({ checkIn: "2026-10-20", checkOut: "2026-10-21", nowTime: "20:30" });
    expect(quoteStay(r).violations.map((v) => v.code)).toContain("same_day_cutoff");
    expect(quoteStay({ ...r, staff: true }).ok).toBe(true);
  });

  it("applies plan adjustment, per-guest supplement, extras, promo and deposit", () => {
    const plan: RatePlan = {
      ...STANDARD_PLAN,
      id: "bb",
      adjustPct: -10,
      adjustAmount: 0,
      perGuestAmount: 7.5,
      paymentPolicy: "deposit",
      depositPct: 30,
    };
    const q = quoteStay(req({ plan, extras: [{ id: "park", price: 12, perNight: true }, { id: "late", price: 20, perNight: false }], promoPercent: 0.1 }));
    // 50 × 0.9 + 7.5 × 2 = 60 per night
    expect(q.nightly[0].price).toBe(60);
    expect(q.base).toBe(180);
    expect(q.extrasTotal).toBe(56);
    expect(q.discount).toBe(23.6);
    expect(q.total).toBe(212.4);
    expect(q.dueNow).toBe(63.72);
  });

  it("enforces plan advance-booking windows for the public site", () => {
    const plan = { ...STANDARD_PLAN, minAdvanceDays: 30 };
    expect(quoteStay(req({ plan })).violations).toContainEqual({ code: "advance_min", days: 30 });
    expect(quoteStay(req({ plan, staff: true })).ok).toBe(true);
  });
});

describe("tourist tax", () => {
  it("charges adults per night up to the cap", () => {
    expect(touristTaxFor(DEFAULT_RULES, 3, 2, 1)).toBe(18);
    expect(touristTaxFor(DEFAULT_RULES, 10, 1, 0)).toBe(21);
  });
  it("charges children when their declared age range reaches the taxable age", () => {
    const rules = { ...DEFAULT_RULES, childMaxAge: 15 };
    expect(touristTaxFor(rules, 2, 2, 1)).toBe(18);
  });
  it("is off when disabled", () => {
    expect(touristTaxFor({ ...DEFAULT_RULES, touristTax: { ...DEFAULT_RULES.touristTax, enabled: false } }, 3, 2, 0)).toBe(0);
  });
});

describe("cancellation fee", () => {
  const booking = { checkIn: "2026-11-10", total: 150, nightly: [{ price: 50 }, { price: 50 }, { price: 50 }] };
  const policy = { ...STANDARD_PLAN, planId: "standard", planName: STANDARD_PLAN.name };
  it("is free before the deadline and the first night after", () => {
    expect(cancellationFee(policy, booking, "2026-11-07")).toBe(0);
    expect(cancellationFee(policy, booking, "2026-11-08")).toBe(50);
  });
  it("charges everything on non-refundable rates", () => {
    expect(cancellationFee({ ...policy, refundable: false }, booking, "2026-10-01")).toBe(150);
  });
  it("supports percent penalties", () => {
    expect(cancellationFee({ ...policy, cancelPenalty: "percent", cancelPenaltyPct: 25 }, booking, "2026-11-09")).toBe(37.5);
  });
});

describe("normaliseRules", () => {
  it("falls back to defaults for missing or malformed values", () => {
    const r = normaliseRules({ checkInFrom: "25:00", maxNights: "abc", touristTax: { amount: 4 } });
    expect(r.checkInFrom).toBe(DEFAULT_RULES.checkInFrom);
    expect(r.maxNights).toBe(DEFAULT_RULES.maxNights);
    expect(r.touristTax.amount).toBe(4);
    expect(r.touristTax.maxNights).toBe(7);
  });
});
