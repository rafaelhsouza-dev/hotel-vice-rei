import { createHash, timingSafeEqual } from "node:crypto";
import { PaymentError } from "../types";

/** Every provider call gives up after this; a hung gateway must not hang a booking. */
export const TIMEOUT_MS = 15_000;

/**
 * Euros → integer cents.
 *
 * `Math.round(amount * 100)` alone is not enough: binary floats turn 1.005
 * into 100.49999… cents and 0.1 + 0.2 into 30.000000000000004. Rounding the
 * product to 12 significant digits first removes that noise (amounts never
 * get anywhere near 12 digits), so the final round sees the decimal value a
 * person would write down.
 */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PaymentError("Montante de pagamento inválido.", "invalid_amount");
  }
  return Math.round(Number((amount * 100).toPrecision(12)));
}

/** Euros → "10.99": two decimals, "." separator, as ifthenpay requires. */
export function toEuroString(amount: number): string {
  const cents = toCents(amount);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Parses a provider amount ("33.61", 33.61, "33,61") into euros, or null. */
export function parseEuros(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Constant-time string comparison. Hashing both sides first makes the
 * buffers equal length, so the length of the secret does not leak either.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/** Reads a credential, trimmed; empty strings count as missing. */
export function credential(credentials: Record<string, string>, key: string): string {
  return (credentials[key] ?? "").trim();
}

/** Drops anything that looks like an API key from a provider message before we show it. */
export function scrubSecrets(message: string): string {
  return message.replace(/\b(sk|rk|pk|whsec)_[A-Za-z0-9_*]+/g, "[chave]");
}
