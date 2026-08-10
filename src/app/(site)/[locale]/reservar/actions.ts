"use server";

import { revalidatePath } from "next/cache";
import { getRooms, getExtras } from "@/lib/repo/content";
import { findPromoCode } from "@/lib/repo/admin";
import { createBooking } from "@/lib/repo/ops";
import { isLocale } from "@/i18n/config";

/** Public booking endpoints. Prices are always recomputed server-side. */

export type QuoteInput = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  extras: string[];
  promoCode: string;
};

export type Quote = {
  nights: number;
  base: number;
  extrasTotal: number;
  discount: number;
  total: number;
  promo: { code: string; percent: number } | null;
};

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const ms = Date.parse(b) - Date.parse(a);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 86_400_000);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Single source of truth for pricing. The client mirrors this for instant
 * feedback, but only this result is ever persisted.
 */
async function priceIt(input: QuoteInput): Promise<Quote> {
  const [rooms, extraDefs] = await Promise.all([getRooms(), getExtras()]);

  const room = rooms.find((r) => r.id === input.roomId);
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const base = room && nights > 0 ? round2(room.priceFrom * nights) : 0;

  const extrasTotal = round2(
    extraDefs
      .filter((e) => input.extras.includes(e.id))
      .reduce(
        (sum, e) => sum + (e.perNight ? e.price * Math.max(1, nights) : e.price),
        0,
      ),
  );

  const promo = input.promoCode ? await findPromoCode(input.promoCode) : null;
  const discount = promo ? round2((base + extrasTotal) * promo.percent) : 0;

  return {
    nights,
    base,
    extrasTotal,
    discount,
    total: Math.max(0, round2(base + extrasTotal - discount)),
    promo,
  };
}

export async function getQuote(input: QuoteInput): Promise<Quote> {
  return priceIt(input);
}

export type PromoResult = { ok: boolean; code?: string; percent?: number };

export async function checkPromo(code: string): Promise<PromoResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false };
  try {
    const promo = await findPromoCode(trimmed);
    return promo ? { ok: true, code: promo.code, percent: promo.percent } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export type BookingResult =
  | { ok: true; reference: string; total: number }
  | { ok: false; error: string };

export async function submitBooking(payload: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  roomId: string;
  offerId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  extras: string[];
  promoCode: string;
  paymentMethod: string;
  locale: string;
}): Promise<BookingResult> {
  const email = payload.email.trim();
  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();

  if (!firstName || !lastName) return { ok: false, error: "missing_name" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "invalid_email" };
  if (!payload.roomId) return { ok: false, error: "missing_room" };

  const quote = await priceIt({
    roomId: payload.roomId,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    extras: payload.extras,
    promoCode: payload.promoCode,
  });
  if (quote.nights <= 0) return { ok: false, error: "invalid_dates" };

  try {
    const reference = await createBooking({
      firstName,
      lastName,
      email,
      phone: payload.phone.trim().slice(0, 40),
      country: payload.country.trim().slice(0, 80),
      notes: payload.notes.trim().slice(0, 2000),
      roomId: payload.roomId,
      offerId: payload.offerId || null,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      nights: quote.nights,
      adults: Math.min(8, Math.max(1, payload.adults)),
      children: Math.min(6, Math.max(0, payload.children)),
      extras: payload.extras,
      promoCode: quote.promo?.code ?? null,
      base: quote.base,
      extrasTotal: quote.extrasTotal,
      discount: quote.discount,
      total: quote.total,
      paymentMethod: payload.paymentMethod,
      locale: isLocale(payload.locale) ? payload.locale : "pt",
    });

    revalidatePath("/admin");
    revalidatePath("/admin/reservas");
    return { ok: true, reference, total: quote.total };
  } catch (err) {
    console.error("[booking] failed:", (err as Error).message);
    return { ok: false, error: "server" };
  }
}
