"use server";

import { revalidatePath } from "next/cache";
import { createMessage, addSubscriber } from "@/lib/repo/ops";
import { isLocale } from "@/i18n/config";

/** Public form endpoints: contact and newsletter. */

export type FormResult = { ok: boolean };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Very small in-process throttle. It is not a substitute for a real WAF, but it
 * blunts a naive loop hammering the form from one client.
 */
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 6;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

export async function sendContactMessage(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
  /** Honeypot — real users never fill this. */
  website?: string;
}): Promise<FormResult> {
  if (payload.website) return { ok: true }; // silently drop bots

  const email = payload.email.trim().toLowerCase();
  const message = payload.message.trim();
  if (!EMAIL_RE.test(email) || message.length < 2) return { ok: false };
  if (rateLimited(`contact:${email}`)) return { ok: false };

  try {
    await createMessage({
      name: payload.name.trim().slice(0, 120),
      email: email.slice(0, 200),
      subject: payload.subject.trim().slice(0, 200),
      message: message.slice(0, 5000),
      locale: isLocale(payload.locale) ? payload.locale : "pt",
    });
    revalidatePath("/admin/mensagens");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    console.error("[contact] failed:", (err as Error).message);
    return { ok: false };
  }
}

export async function subscribeToNewsletter(payload: {
  email: string;
  locale: string;
  website?: string;
}): Promise<FormResult> {
  if (payload.website) return { ok: true };

  const email = payload.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false };
  if (rateLimited(`news:${email}`)) return { ok: false };

  try {
    await addSubscriber(email.slice(0, 200), isLocale(payload.locale) ? payload.locale : "pt");
    revalidatePath("/admin/newsletter");
    return { ok: true };
  } catch (err) {
    console.error("[newsletter] failed:", (err as Error).message);
    return { ok: false };
  }
}
