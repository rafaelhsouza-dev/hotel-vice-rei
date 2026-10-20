import { getHotel, getRooms, getSeo, type HotelSettings, type SeoSettings } from "@/lib/repo/content";
import { getBookingRules } from "@/lib/repo/rate-plans";
import type { BookingRules } from "@/lib/booking/rules";
import type { Room } from "@/data/hotel";

/**
 * One source of verified facts for everything machine-readable: llms.txt,
 * llms-full.txt and the JSON-LD graph. Values come from the admin-backed
 * getters (which fall back to the seed); the constants below are facts that
 * have no admin field yet and were checked against the official listings.
 *
 * Deliberately absent: parking, breakfast inclusion and distances — none of
 * them is verified, so nothing machine-readable claims them.
 */

export const STATIC_FACTS = {
  /** Official classification (Booking.com and Tripadvisor, verified 2026-08). */
  stars: 2,
  /** Name the property is registered under. */
  registeredName: "Albergaria Residência Vice-Rei",
  petsAllowed: false,
  cots: false,
  extraBeds: false,
  smokingAllowed: false,
} as const;

export type Rating = {
  id: "tripadvisor" | "booking" | "google";
  name: string;
  score: number;
  scale: 5 | 10;
  count: number | null;
  url: string;
};

const toNumber = (v: string): number | null => {
  const n = Number(String(v).replace(",", ".").trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/** Public scores that are actually set; an empty score hides the source. */
export function ratingsFrom(seo: SeoSettings, hotel: HotelSettings): Rating[] {
  const out: Rating[] = [];
  const push = (
    id: Rating["id"],
    name: string,
    score: string,
    count: string,
    scale: Rating["scale"],
    url: string,
  ) => {
    const s = toNumber(score);
    if (s == null || s > scale) return;
    const c = toNumber(count);
    out.push({ id, name, score: s, scale, count: c == null ? null : Math.round(c), url });
  };
  push("tripadvisor", "Tripadvisor", seo.tripadvisorScore, seo.tripadvisorCount, 5, seo.tripadvisorUrl || hotel.social.tripadvisor || "");
  push("booking", "Booking.com", seo.bookingScore, seo.bookingCount, 10, seo.bookingUrl);
  push("google", "Google", seo.googleScore, seo.googleCount, 5, seo.googleBusinessUrl);
  return out;
}

/** Social profiles and listings, for schema.org `sameAs`. */
export function sameAsFrom(seo: SeoSettings, hotel: HotelSettings): string[] {
  const urls = [
    hotel.social.facebook,
    hotel.social.instagram,
    hotel.social.tripadvisor,
    seo.tripadvisorUrl,
    seo.bookingUrl,
    seo.googleBusinessUrl,
  ].filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));
  return Array.from(new Set(urls));
}

/** "€43–€120" from the published room prices, or "€€" when there are none. */
export function priceRangeFrom(rooms: Room[]): string {
  const prices = rooms.map((r) => r.priceFrom).filter((p) => p > 0);
  if (!prices.length) return "€€";
  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));
  return min === max ? `€${min}` : `€${min}–€${max}`;
}

/** "15:00" → "15:00:00" (schema.org Time). */
export const schemaTime = (hhmm: string) => (/^\d{2}:\d{2}$/.test(hhmm) ? `${hhmm}:00` : hhmm);

/** "21:30" → "21h30", "12:00" → "12h" (Portuguese convention). */
export const ptTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return m && m !== "00" ? `${Number(h)}h${m}` : `${Number(h)}h`;
};

export type Facts = {
  hotel: HotelSettings;
  rooms: Room[];
  rules: BookingRules;
  seo: SeoSettings;
  ratings: Rating[];
  sameAs: string[];
  priceRange: string;
} & typeof STATIC_FACTS;

export async function getFacts(): Promise<Facts> {
  const [hotel, rooms, rules, seo] = await Promise.all([
    getHotel(),
    getRooms(),
    getBookingRules(),
    getSeo(),
  ]);
  return {
    ...STATIC_FACTS,
    hotel,
    rooms,
    rules,
    seo,
    ratings: ratingsFrom(seo, hotel),
    sameAs: sameAsFrom(seo, hotel),
    priceRange: priceRangeFrom(rooms),
  };
}
