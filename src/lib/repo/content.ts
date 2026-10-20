import { unstable_cache } from "next/cache";
import { safeQuery } from "../db";
import {
  hotel as seedHotel,
  rooms as seedRooms,
  services as seedServices,
  offers as seedOffers,
  testimonials as seedTestimonials,
  galleryImages as seedGallery,
  type Room,
  type Service,
  type Offer,
  type Testimonial,
  type ServiceIcon,
} from "@/data/hotel";
import { posts as seedPosts, type Post } from "@/data/blog";
import type { Locale } from "@/i18n/config";

/**
 * Read side of the content model.
 *
 * Every getter falls back to the seed data when Postgres is unreachable, which
 * is what lets `next build` prerender inside Docker on a host that cannot see
 * the database. Results are cached and invalidated by tag from the admin.
 */

export type HotelSettings = typeof seedHotel;

export type AnalyticsSettings = {
  /** GA4 measurement ID, e.g. G-XXXXXXX. Empty disables analytics. */
  ga4: string;
  /** Google Tag Manager container, e.g. GTM-XXXXXXX. */
  gtm: string;
  /** Google Search Console HTML verification token. */
  searchConsole: string;
};
export type GalleryImage = { id: number; src: string; alt: string };

export const TAGS = {
  settings: "settings",
  rooms: "rooms",
  services: "services",
  offers: "offers",
  testimonials: "testimonials",
  posts: "posts",
  gallery: "gallery",
  extras: "extras",
  analytics: "analytics",
  seo: "seo",
  pois: "pois",
} as const;

const CACHE_SECONDS = 300;

type Trio<T> = Record<Locale, T>;
const num = (v: unknown) => Number(v ?? 0);

// --- rooms -----------------------------------------------------------------

type RoomRow = {
  id: string;
  slug: string;
  image: string;
  gallery: string[];
  capacity: number;
  size: number;
  bed: Trio<string>;
  bathroom: Trio<string>;
  price_from: string;
  name: Trio<string>;
  short_description: Trio<string>;
  long_description: Trio<string[]>;
  amenities: Trio<string[]>;
  romantic: boolean;
  panorama360: string | null;
};

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    slug: row.slug,
    image: row.image,
    gallery: row.gallery ?? [],
    capacity: row.capacity,
    size: row.size,
    bed: row.bed,
    bathroom: row.bathroom,
    priceFrom: num(row.price_from),
    name: row.name,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    amenities: row.amenities,
    romantic: row.romantic,
    ...(row.panorama360 ? { panorama360: row.panorama360 } : {}),
  };
}

export const getRooms = unstable_cache(
  async (): Promise<Room[]> => {
    const rows = await safeQuery<RoomRow>(
      `SELECT id, slug, image, gallery, capacity, size, bed, bathroom, price_from,
              name, short_description, long_description, amenities, romantic, panorama360
       FROM rooms WHERE published = true ORDER BY position, id`,
    );
    if (!rows || rows.length === 0) return seedRooms;
    return rows.map(toRoom);
  },
  ["rooms"],
  { tags: [TAGS.rooms], revalidate: CACHE_SECONDS },
);

export async function getRoomBySlug(slug: string): Promise<Room | undefined> {
  return (await getRooms()).find((r) => r.slug === slug);
}

// --- services --------------------------------------------------------------

type ServiceRow = {
  id: string;
  icon: string;
  title: Trio<string>;
  description: Trio<string>;
};

export const getServices = unstable_cache(
  async (): Promise<Service[]> => {
    const rows = await safeQuery<ServiceRow>(
      `SELECT id, icon, title, description FROM services
       WHERE published = true ORDER BY position, id`,
    );
    if (!rows || rows.length === 0) return seedServices;
    return rows.map((r) => ({
      id: r.id,
      icon: r.icon as ServiceIcon,
      title: r.title,
      description: r.description,
    }));
  },
  ["services"],
  { tags: [TAGS.services], revalidate: CACHE_SECONDS },
);

// --- offers ----------------------------------------------------------------

type OfferRow = {
  id: string;
  slug: string;
  image: string;
  badge: Trio<string>;
  title: Trio<string>;
  description: Trio<string>;
  price_from: string;
  price_label: Trio<string>;
  includes: Trio<string[]>;
  conditions: Trio<string[]>;
};

export const getOffers = unstable_cache(
  async (): Promise<Offer[]> => {
    const rows = await safeQuery<OfferRow>(
      `SELECT id, slug, image, badge, title, description, price_from, price_label,
              includes, conditions
       FROM offers WHERE published = true ORDER BY position, id`,
    );
    if (!rows || rows.length === 0) return seedOffers;
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      image: r.image,
      badge: r.badge,
      title: r.title,
      description: r.description,
      priceFrom: num(r.price_from),
      priceLabel: r.price_label,
      includes: r.includes,
      conditions: r.conditions,
    }));
  },
  ["offers"],
  { tags: [TAGS.offers], revalidate: CACHE_SECONDS },
);

// --- testimonials ----------------------------------------------------------

type TestimonialRow = {
  id: string;
  author: string;
  origin: Trio<string>;
  quote: Trio<string>;
  rating: number;
};

export const getTestimonials = unstable_cache(
  async (): Promise<Testimonial[]> => {
    const rows = await safeQuery<TestimonialRow>(
      `SELECT id, author, origin, quote, rating FROM testimonials
       WHERE published = true ORDER BY position, id`,
    );
    if (!rows || rows.length === 0) return seedTestimonials;
    return rows.map((r) => ({
      id: r.id,
      author: r.author,
      origin: r.origin,
      quote: r.quote,
      rating: r.rating,
    }));
  },
  ["testimonials"],
  { tags: [TAGS.testimonials], revalidate: CACHE_SECONDS },
);

// --- posts -----------------------------------------------------------------

type PostRow = {
  slug: string;
  image: string;
  date: string | Date;
  reading_minutes: number;
  category: Trio<string>;
  title: Trio<string>;
  excerpt: Trio<string>;
  body: Trio<string[]>;
};

function isoDate(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

export const getPosts = unstable_cache(
  async (): Promise<Post[]> => {
    const rows = await safeQuery<PostRow>(
      `SELECT slug, image, date, reading_minutes, category, title, excerpt, body
       FROM posts WHERE published = true ORDER BY date DESC`,
    );
    if (!rows || rows.length === 0) return seedPosts;
    return rows.map((r) => ({
      slug: r.slug,
      image: r.image,
      date: isoDate(r.date),
      readingMinutes: r.reading_minutes,
      category: r.category,
      title: r.title,
      excerpt: r.excerpt,
      body: r.body,
    }));
  },
  ["posts"],
  { tags: [TAGS.posts], revalidate: CACHE_SECONDS },
);

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  return (await getPosts()).find((p) => p.slug === slug);
}

// --- gallery ---------------------------------------------------------------

export const getGallery = unstable_cache(
  async (): Promise<GalleryImage[]> => {
    const rows = await safeQuery<{ id: number; src: string; alt: string }>(
      `SELECT id, src, alt FROM gallery_images WHERE published = true
       ORDER BY position, id`,
    );
    if (!rows || rows.length === 0) {
      return seedGallery.map((src, i) => ({
        id: i,
        src,
        alt: "Hotel Vice-Rei · Porto",
      }));
    }
    return rows;
  },
  ["gallery"],
  { tags: [TAGS.gallery], revalidate: CACHE_SECONDS },
);

// --- settings --------------------------------------------------------------

type SettingsRow = {
  name: string;
  total_rooms: number;
  brand_tagline: Trio<string>;
  street: string;
  postal_code: string;
  city: string;
  country: Trio<string>;
  phones: string[];
  email: string;
  social: HotelSettings["social"];
  coords: HotelSettings["coords"];
  rating: HotelSettings["rating"];
  legal: HotelSettings["legal"];
  payment_methods: string[];
  languages: Trio<string[]>;
};

export const getHotel = unstable_cache(
  async (): Promise<HotelSettings> => {
    const rows = await safeQuery<SettingsRow>(
      `SELECT name, total_rooms, brand_tagline, street, postal_code, city, country,
              phones, email, social, coords, rating, legal, payment_methods, languages
       FROM settings WHERE id = 1`,
    );
    const row = rows?.[0];
    if (!row) return seedHotel;
    return {
      name: row.name,
      totalRooms: row.total_rooms,
      brandTagline: row.brand_tagline,
      address: {
        street: row.street,
        postalCode: row.postal_code,
        city: row.city,
        country: row.country,
      },
      phones: row.phones,
      email: row.email,
      social: row.social,
      coords: row.coords,
      rating: row.rating,
      legal: row.legal,
      paymentMethods: row.payment_methods,
      languages: row.languages,
    };
  },
  ["settings"],
  { tags: [TAGS.settings], revalidate: CACHE_SECONDS },
);

// --- booking extras & promo codes -----------------------------------------

export type BookingExtra = {
  id: string;
  label: Trio<string>;
  description: Trio<string>;
  price: number;
  perNight: boolean;
};

export const getAnalytics = unstable_cache(
  async (): Promise<AnalyticsSettings> => {
    const rows = await safeQuery<{ analytics: Partial<AnalyticsSettings> }>(
      `SELECT analytics FROM settings WHERE id = 1`,
    );
    const a = rows?.[0]?.analytics ?? {};
    return {
      ga4: (a.ga4 ?? "").trim(),
      gtm: (a.gtm ?? "").trim(),
      searchConsole: (a.searchConsole ?? "").trim(),
    };
  },
  ["analytics"],
  { tags: [TAGS.analytics], revalidate: CACHE_SECONDS },
);

export const getExtras = unstable_cache(
  async (): Promise<BookingExtra[]> => {
    const rows = await safeQuery<{
      id: string;
      label: Trio<string>;
      description: Trio<string>;
      price: string;
      per_night: boolean;
    }>(
      `SELECT id, label, description, price, per_night FROM extras
       WHERE active = true ORDER BY position, id`,
    );
    if (!rows) return [];
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      price: num(r.price),
      perNight: r.per_night,
    }));
  },
  ["extras"],
  { tags: [TAGS.extras], revalidate: CACHE_SECONDS },
);

// --- SEO, monitoring and public reputation ---------------------------------

export type SeoSettings = {
  bing: string;
  yandex: string;
  facebookDomain: string;
  pinterest: string;
  clarity: string;
  metaPixel: string;
  googleAdsId: string;
  googleAdsLabel: string;
  hotjar: string;
  googleBusinessUrl: string;
  googleHotelCenterId: string;
  bookingUrl: string;
  tripadvisorUrl: string;
  tripadvisorScore: string;
  tripadvisorCount: string;
  bookingScore: string;
  bookingCount: string;
  googleScore: string;
  googleCount: string;
};

const EMPTY_SEO: SeoSettings = {
  bing: "",
  yandex: "",
  facebookDomain: "",
  pinterest: "",
  clarity: "",
  metaPixel: "",
  googleAdsId: "",
  googleAdsLabel: "",
  hotjar: "",
  googleBusinessUrl: "",
  googleHotelCenterId: "",
  bookingUrl: "",
  tripadvisorUrl: "",
  // Verified 2026-08-10 on the public listings; the admin can update them.
  tripadvisorScore: "3.5",
  tripadvisorCount: "248",
  bookingScore: "8.0",
  bookingCount: "",
  googleScore: "",
  googleCount: "",
};

export const getSeo = unstable_cache(
  async (): Promise<SeoSettings> => {
    const rows = await safeQuery<{ seo: Partial<SeoSettings> }>(`SELECT seo FROM settings WHERE id = 1`);
    const stored = rows?.[0]?.seo ?? {};
    const out = { ...EMPTY_SEO };
    for (const k of Object.keys(out) as (keyof SeoSettings)[]) {
      const v = stored[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  },
  ["seo"],
  { tags: [TAGS.seo], revalidate: CACHE_SECONDS },
);

// --- points of interest -----------------------------------------------------

export type Poi = {
  id: string;
  category: "sight" | "museum" | "food" | "shopping" | "transport" | "nature" | "nightlife" | "other";
  name: Trio<string>;
  description: Trio<string>;
  lat: number;
  lng: number;
  walkMinutes: number | null;
  url: string;
};

export const getPois = unstable_cache(
  async (): Promise<Poi[]> => {
    const rows = await safeQuery<Record<string, unknown>>(
      `SELECT * FROM pois WHERE published = true ORDER BY position, created_at`,
    );
    return (rows ?? []).map((r) => ({
      id: String(r.id),
      category: r.category as Poi["category"],
      name: r.name as Trio<string>,
      description: r.description as Trio<string>,
      lat: Number(r.lat),
      lng: Number(r.lng),
      walkMinutes: r.walk_minutes == null ? null : Number(r.walk_minutes),
      url: String(r.url ?? ""),
    }));
  },
  ["pois"],
  { tags: [TAGS.pois], revalidate: CACHE_SECONDS },
);
