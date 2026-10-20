"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isLocale } from "@/i18n/config";
import { findPromoCode } from "@/lib/repo/admin";
import { getActiveRatePlans, readBookingRules } from "@/lib/repo/rate-plans";
import { placeBooking, priceStay, searchStays, type StayOption } from "@/lib/booking/service";
import { isIsoDate, type Violation } from "@/lib/booking/pricing";
import { getPaymentSetup, startBookingPayment } from "@/lib/payments/service";
import type { PaymentMethod } from "@/lib/payments/types";
import { notifyBookingPlaced } from "@/lib/email/notify";
import { guestUrl } from "@/lib/email/notify";

/**
 * Public booking endpoints. Prices and availability are always computed on
 * the server against live inventory; the browser only displays them.
 */

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export type PublicPlan = {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  board: string;
  refundable: boolean;
  freeCancelDays: number;
  paymentPolicy: "hotel" | "deposit" | "full";
  depositPct: number;
};

export type SearchResult = {
  violations: Violation[];
  options: StayOption[];
  plans: PublicPlan[];
  methods: PaymentMethod[];
};

export async function searchAvailability(input: {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}): Promise<SearchResult> {
  const [plans, setup] = await Promise.all([getActiveRatePlans(), getPaymentSetup().catch(() => ({ methods: {}, any: false }))]);
  const publicPlans: PublicPlan[] = plans
    .filter((p) => setup.any || p.paymentPolicy === "hotel")
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      board: p.board,
      refundable: p.refundable,
      freeCancelDays: p.freeCancelDays,
      paymentPolicy: p.paymentPolicy,
      depositPct: p.depositPct,
    }));
  const methods = Object.keys(setup.methods) as PaymentMethod[];

  if (!isIsoDate(input.checkIn) || !isIsoDate(input.checkOut)) {
    return { violations: [{ code: "invalid_dates" }], options: [], plans: publicPlans, methods };
  }
  try {
    const { violations, options } = await searchStays({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: clampInt(input.adults, 1, 8, 2),
      children: clampInt(input.children, 0, 6, 0),
      plans,
      onlinePayments: setup.any,
    });
    return { violations, options, plans: publicPlans, methods };
  } catch (err) {
    console.error("[booking] search failed:", (err as Error).message);
    return { violations: [{ code: "sold_out", date: input.checkIn }], options: [], plans: publicPlans, methods };
  }
}

export type QuoteInput = {
  roomId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  extras: string[];
  promoCode: string;
};

export type ClientQuote = {
  ok: boolean;
  violations: Violation[];
  nights: number;
  base: number;
  extrasTotal: number;
  discount: number;
  total: number;
  touristTax: number;
  dueNow: number;
  promo: { code: string; percent: number } | null;
};

function sanitize(input: QuoteInput) {
  return {
    roomId: String(input.roomId ?? "").slice(0, 60),
    ratePlanId: String(input.ratePlanId ?? "").slice(0, 60),
    checkIn: String(input.checkIn ?? ""),
    checkOut: String(input.checkOut ?? ""),
    adults: clampInt(input.adults, 1, 8, 2),
    children: clampInt(input.children, 0, 6, 0),
    extras: Array.isArray(input.extras) ? input.extras.map(String).slice(0, 20) : [],
    promoCode: String(input.promoCode ?? "").slice(0, 40),
  };
}

export async function getQuote(input: QuoteInput): Promise<ClientQuote> {
  try {
    const priced = await priceStay(sanitize(input));
    const q = priced.quote;
    return {
      ok: q.ok,
      violations: q.violations,
      nights: q.nights,
      base: q.base,
      extrasTotal: q.extrasTotal,
      discount: q.discount,
      total: q.total,
      touristTax: q.touristTax,
      dueNow: q.dueNow,
      promo: priced.promo,
    };
  } catch (err) {
    console.error("[booking] quote failed:", (err as Error).message);
    return { ok: false, violations: [{ code: "sold_out", date: input.checkIn }], nights: 0, base: 0, extrasTotal: 0, discount: 0, total: 0, touristTax: 0, dueNow: 0, promo: null };
  }
}

export type PromoResult = { ok: boolean; code?: string; percent?: number };

export async function checkPromo(code: string): Promise<PromoResult> {
  const trimmed = String(code ?? "").trim().slice(0, 40);
  if (!trimmed) return { ok: false };
  try {
    const promo = await findPromoCode(trimmed);
    return promo ? { ok: true, code: promo.code, percent: promo.percent } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export type BookingResult =
  | {
      ok: true;
      reference: string;
      total: number;
      touristTax: number;
      manageUrl: string;
      status: "pending" | "confirmed";
      emailSent: boolean;
      payment:
        | null
        | { kind: "redirect"; url: string }
        | { kind: "multibanco"; entity: string; reference: string; amount: number; expiresAt: string | null }
        | { kind: "mbway"; amount: number }
        | { kind: "error"; message: string };
    }
  | { ok: false; error: string; violations?: Violation[] };

/** Per-address throttle against scripted bookings that would block rooms. */
const recent = new Map<string, number[]>();
const WINDOW = 15 * 60 * 1000;
const MAX = 6;

async function throttled(): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (list.length >= MAX) return true;
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return false;
}

export async function submitBooking(payload: QuoteInput & {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  offerId: string;
  paymentMethod: string;
  mbwayPhone?: string;
  acceptTerms: boolean;
  /** Honeypot: real users never fill it. */
  website?: string;
  locale: string;
}): Promise<BookingResult> {
  if (payload.website) return { ok: false, error: "server" };
  const email = String(payload.email ?? "").trim().slice(0, 160);
  const firstName = String(payload.firstName ?? "").trim().slice(0, 80);
  const lastName = String(payload.lastName ?? "").trim().slice(0, 80);
  if (!firstName || !lastName) return { ok: false, error: "missing_name" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "invalid_email" };
  if (!payload.acceptTerms) return { ok: false, error: "terms" };
  if (await throttled()) return { ok: false, error: "rate_limited" };

  const stay = sanitize(payload);
  if (!stay.roomId) return { ok: false, error: "missing_room" };
  const locale = isLocale(payload.locale) ? payload.locale : "pt";

  try {
    const result = await placeBooking(stay, {
      firstName,
      lastName,
      email,
      phone: String(payload.phone ?? "").trim().slice(0, 40),
      country: String(payload.country ?? "").trim().slice(0, 80),
      notes: String(payload.notes ?? "").trim().slice(0, 2000),
      locale,
    }, { source: "site" });

    if (!result.ok) return { ok: false, error: "unavailable", violations: result.violations };

    let payment: Extract<BookingResult, { ok: true }>["payment"] = null;
    if (result.quote.dueNow > 0) {
      const method = (["card", "mbway", "multibanco"] as const).find((m) => m === payload.paymentMethod);
      const rules = await readBookingRules();
      try {
        if (!method) throw new Error("Escolha um meio de pagamento.");
        const started = await startBookingPayment({
          bookingId: result.id,
          method,
          phone: payload.mbwayPhone,
          holdHours: method === "card" ? Math.min(rules.paymentHoldHours, 23) : rules.paymentHoldHours,
        });
        payment =
          started.kind === "redirect"
            ? { kind: "redirect", url: started.url }
            : started.kind === "multibanco"
              ? {
                  kind: "multibanco",
                  entity: started.entity,
                  reference: started.reference,
                  amount: started.amount,
                  expiresAt: started.expiresAt ? started.expiresAt.toISOString() : null,
                }
              : { kind: "mbway", amount: started.amount };
      } catch (err) {
        payment = { kind: "error", message: (err as Error).message };
      }
    }

    const manageUrl = guestUrl({ locale, guestToken: result.guestToken });
    const emailSent = await notifyBookingPlaced(
      result.id,
      payment?.kind === "multibanco" ? payment : payment?.kind === "redirect" ? { url: manageUrl } : undefined,
    );

    revalidatePath("/admin");
    return {
      ok: true,
      reference: result.reference,
      total: result.quote.total,
      touristTax: result.quote.touristTax,
      manageUrl,
      status: result.status,
      emailSent,
      payment,
    };
  } catch (err) {
    console.error("[booking] failed:", (err as Error).message);
    return { ok: false, error: "server" };
  }
}
