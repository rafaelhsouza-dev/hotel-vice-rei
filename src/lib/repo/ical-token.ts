import { timingSafeEqual } from "node:crypto";
import { query, queryOne } from "../db";
import { randomToken } from "../crypto";

/**
 * The shared secret embedded in our published calendar URLs.
 *
 * A channel polling an iCal feed sends no headers and runs no OAuth dance, so
 * the only place authorisation can live is the URL. Rotating the token
 * invalidates every subscription at once, which is the intended emergency
 * lever if a URL leaks.
 */

export async function getIcalToken(): Promise<string> {
  const row = await queryOne<{ ical_token: string }>(
    `SELECT ical_token FROM settings WHERE id = 1`,
  );
  if (row?.ical_token) return row.ical_token;
  return rotateIcalToken();
}

export async function rotateIcalToken(): Promise<string> {
  const token = randomToken();
  await query(`UPDATE settings SET ical_token = $1 WHERE id = 1`, [token]);
  return token;
}

/** Constant-time comparison so the token cannot be guessed byte by byte. */
export async function verifyIcalToken(candidate: string | null): Promise<boolean> {
  if (!candidate) return false;
  const expected = await getIcalToken();
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
