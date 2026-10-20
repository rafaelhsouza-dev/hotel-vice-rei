"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getBookingByToken, listCharges, buildFolio, saveGuests } from "@/lib/repo/bookings";
import { cancelBooking, feeIfCancelledToday } from "@/lib/booking/lifecycle";
import { hotelNow } from "@/lib/booking/pricing";
import { getPaymentSetup, startBookingPayment } from "@/lib/payments/service";
import type { PaymentMethod } from "@/lib/payments/types";
import { readBookingRules } from "@/lib/repo/rate-plans";
import { notifyCancelled, notifyCheckinDone } from "@/lib/email/notify";
import { guestsFromForm } from "@/lib/booking/guest-form";
import { requiresBulletin, isAlpha3 } from "@/lib/siba/countries";
import { audit } from "@/lib/repo/audit";
import { query } from "@/lib/db";
import { bool, str } from "@/lib/form";

/**
 * The guest's own actions, authorised by the unguessable token in their
 * booking link (192 bits). Nothing here trusts anything else the browser sends
 * about the booking.
 */

const hits = new Map<string, number[]>();
async function limited(key: string, max = 20): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const list = (hits.get(k) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  hits.set(k, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export type GuestPayResult =
  | { ok: true; kind: "redirect"; url: string }
  | { ok: true; kind: "multibanco"; entity: string; reference: string; amount: number }
  | { ok: true; kind: "mbway"; amount: number }
  | { ok: false; message: string };

export async function payBalance(token: string, method: string, phone: string): Promise<GuestPayResult> {
  if (await limited("pay", 10)) return { ok: false, message: "rate_limited" };
  const b = await getBookingByToken(token);
  if (!b || b.status === "cancelled" || b.status === "no_show" || b.status === "checked_out") return { ok: false, message: "unavailable" };
  const folio = buildFolio(b, await listCharges(b.id));
  // Online the guest pays what the plan asked for now; with nothing pending,
  // the remaining room balance (tourist tax stays for the desk).
  const due = Math.max(0, b.amountDueNow - b.paidTotal) || Math.max(0, folio.balance - b.touristTax);
  if (!(due > 0)) return { ok: false, message: "nothing_due" };
  const setup = await getPaymentSetup();
  const m = (["card", "mbway", "multibanco"] as const).find((x) => x === method);
  if (!m || !setup.methods[m]) return { ok: false, message: "method_unavailable" };
  const rules = await readBookingRules();
  try {
    const started = await startBookingPayment({
      bookingId: b.id,
      method: m as PaymentMethod,
      phone,
      amount: Math.round(due * 100) / 100,
      holdHours: m === "card" ? 23 : rules.paymentHoldHours,
      createdBy: "hóspede",
    });
    if (started.kind === "redirect") return { ok: true, kind: "redirect", url: started.url };
    if (started.kind === "multibanco") return { ok: true, kind: "multibanco", entity: started.entity, reference: started.reference, amount: started.amount };
    return { ok: true, kind: "mbway", amount: started.amount };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/**
 * Self-service cancellation, only when it is free and nothing was paid —
 * anything involving a fee or a refund goes through the desk, so no money
 * decision is ever taken without a person.
 */
export async function cancelByGuest(token: string, confirm: boolean): Promise<{ ok: boolean; message: string }> {
  if (await limited("cancel", 5)) return { ok: false, message: "rate_limited" };
  const b = await getBookingByToken(token);
  if (!b || !confirm) return { ok: false, message: "unavailable" };
  if (!(b.status === "pending" || b.status === "confirmed")) return { ok: false, message: "unavailable" };
  if (b.checkIn <= hotelNow().date) return { ok: false, message: "contact" };
  if (feeIfCancelledToday(b) > 0 || b.paidTotal > 0) return { ok: false, message: "contact" };
  await cancelBooking(b.id, { reason: "guest", fee: 0, by: "hóspede" });
  await audit(null, "booking.cancelled_by_guest", { entity: "booking", id: b.id, summary: b.reference });
  await notifyCancelled(b.id, "guest");
  revalidatePath(`/${b.locale}/reserva/${token}`);
  return { ok: true, message: "cancelled" };
}

export type CheckinState = {
  ok: boolean;
  message: string;
  fields?: string[];
  /** What was submitted, so React's post-action form reset keeps it on screen. */
  values?: Record<string, string>;
};

function echo(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && k !== "token" && !k.startsWith("$")) out[k] = v.slice(0, 200);
  return out;
}

export async function submitCheckin(_prev: CheckinState, form: FormData): Promise<CheckinState> {
  const token = str(form, "token", "", 80);
  if (await limited("checkin", 15)) return { ok: false, message: "rate_limited" };
  const b = await getBookingByToken(token);
  if (!b || !["pending", "confirmed", "checked_in"].includes(b.status)) return { ok: false, message: "closed" };
  if (!bool(form, "consent")) return { ok: false, message: "consent", fields: ["consent"], values: echo(form) };

  const guests = guestsFromForm(form);
  const missing: string[] = [];
  // Every adult must be listed: each foreign guest needs their own bulletin.
  for (let i = guests.length; i < Math.max(1, b.adults); i++) missing.push(`g${i}.firstName`, `g${i}.lastName`);
  guests.forEach((g, i) => {
    const p = `g${i}`;
    if (!g.firstName) missing.push(`${p}.firstName`);
    if (!g.lastName) missing.push(`${p}.lastName`);
    if (!isAlpha3(g.nationality)) missing.push(`${p}.nationality`);
    if (!g.birthDate || g.birthDate > hotelNow().date) missing.push(`${p}.birthDate`);
    // Foreign guests need the full SIBA set.
    if (requiresBulletin(g.nationality)) {
      if (!g.documentNumber) missing.push(`${p}.documentNumber`);
      if (!isAlpha3(g.documentCountry)) missing.push(`${p}.documentCountry`);
      if (!isAlpha3(g.residenceCountry)) missing.push(`${p}.residenceCountry`);
      if (!g.residenceCity) missing.push(`${p}.residenceCity`);
      if (!g.birthPlace) missing.push(`${p}.birthPlace`);
    }
  });
  if (missing.length) return { ok: false, message: "invalid", fields: missing, values: echo(form) };

  await saveGuests(b.id, guests, requiresBulletin);
  await query(`UPDATE bookings SET eta = $2, notes = CASE WHEN $3 = '' THEN notes ELSE trim(notes || E'\n' || $3) END, checkin_done_at = now(), updated_at = now() WHERE id = $1`, [
    b.id,
    str(form, "eta", "", 20),
    str(form, "requests", "", 1000),
  ]);
  await audit(null, "checkin.online", { entity: "booking", id: b.id, summary: `${guests.length} hóspede(s)` });
  await notifyCheckinDone(b.id);
  revalidatePath(`/${b.locale}/reserva/${token}`);
  return { ok: true, message: "done" };
}
