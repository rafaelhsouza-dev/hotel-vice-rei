import { query, queryOne } from "../db";
import type { Locale } from "@/i18n/config";

/**
 * Write side + unfiltered reads for the backoffice.
 *
 * Nothing here is cached: the admin must always see the current row, and these
 * run inside server actions that revalidate the public cache tags afterwards.
 */

type Trio<T> = Record<Locale, T>;
const num = (v: unknown) => Number(v ?? 0);

/** Tables whose rows can be published/reordered/deleted generically. */
export const CONTENT_TABLES = [
  "rooms",
  "services",
  "offers",
  "testimonials",
  "posts",
  "gallery_images",
  "extras",
] as const;
export type ContentTable = (typeof CONTENT_TABLES)[number];

function assertTable(table: string): asserts table is ContentTable {
  if (!(CONTENT_TABLES as readonly string[]).includes(table)) {
    throw new Error(`Unknown table: ${table}`);
  }
}

/** Primary key column per table — `posts` is keyed by slug, gallery by serial id. */
function pkOf(table: ContentTable): string {
  return table === "posts" ? "slug" : "id";
}

// --- generic content operations -------------------------------------------

export async function setPublished(
  table: string,
  id: string,
  published: boolean,
): Promise<void> {
  assertTable(table);
  const flag = table === "extras" ? "active" : "published";
  await query(
    `UPDATE ${table} SET ${flag} = $2 WHERE ${pkOf(table)} = $1`,
    [id, published],
  );
}

export async function deleteRow(table: string, id: string): Promise<void> {
  assertTable(table);
  await query(`DELETE FROM ${table} WHERE ${pkOf(table)} = $1`, [id]);
}

/** Persists an explicit ordering; index in the array becomes `position`. */
export async function reorder(table: string, ids: string[]): Promise<void> {
  assertTable(table);
  const pk = pkOf(table);
  for (const [i, id] of ids.entries()) {
    await query(`UPDATE ${table} SET position = $2 WHERE ${pk} = $1`, [id, i]);
  }
}

// --- rooms -----------------------------------------------------------------

export type AdminRoom = {
  id: string;
  slug: string;
  image: string;
  gallery: string[];
  capacity: number;
  size: number;
  bed: Trio<string>;
  bathroom: Trio<string>;
  priceFrom: number;
  name: Trio<string>;
  shortDescription: Trio<string>;
  longDescription: Trio<string[]>;
  amenities: Trio<string[]>;
  romantic: boolean;
  panorama360: string | null;
  position: number;
  published: boolean;
};

export async function listRooms(): Promise<AdminRoom[]> {
  const rows = await query<Record<string, never>>(
    `SELECT id, slug, image, gallery, capacity, size, bed, bathroom, price_from,
            name, short_description, long_description, amenities, romantic,
            panorama360, position, published
     FROM rooms ORDER BY position, id`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    slug: r.slug as string,
    image: r.image as string,
    gallery: (r.gallery as string[]) ?? [],
    capacity: r.capacity as number,
    size: r.size as number,
    bed: r.bed as Trio<string>,
    bathroom: r.bathroom as Trio<string>,
    priceFrom: num(r.price_from),
    name: r.name as Trio<string>,
    shortDescription: r.short_description as Trio<string>,
    longDescription: r.long_description as Trio<string[]>,
    amenities: r.amenities as Trio<string[]>,
    romantic: r.romantic as boolean,
    panorama360: (r.panorama360 as string) ?? null,
    position: r.position as number,
    published: r.published as boolean,
  }));
}

export async function getRoom(id: string): Promise<AdminRoom | null> {
  const all = await listRooms();
  return all.find((r) => r.id === id) ?? null;
}

export async function upsertRoom(room: AdminRoom): Promise<void> {
  await query(
    `INSERT INTO rooms
       (id, slug, image, gallery, capacity, size, bed, bathroom, price_from, name,
        short_description, long_description, amenities, romantic, panorama360,
        position, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
       slug=EXCLUDED.slug, image=EXCLUDED.image, gallery=EXCLUDED.gallery,
       capacity=EXCLUDED.capacity, size=EXCLUDED.size, bed=EXCLUDED.bed,
       bathroom=EXCLUDED.bathroom, price_from=EXCLUDED.price_from,
       name=EXCLUDED.name, short_description=EXCLUDED.short_description,
       long_description=EXCLUDED.long_description, amenities=EXCLUDED.amenities,
       romantic=EXCLUDED.romantic, panorama360=EXCLUDED.panorama360,
       position=EXCLUDED.position, published=EXCLUDED.published,
       updated_at=now()`,
    [
      room.id,
      room.slug,
      room.image,
      JSON.stringify(room.gallery),
      room.capacity,
      room.size,
      JSON.stringify(room.bed),
      JSON.stringify(room.bathroom),
      room.priceFrom,
      JSON.stringify(room.name),
      JSON.stringify(room.shortDescription),
      JSON.stringify(room.longDescription),
      JSON.stringify(room.amenities),
      room.romantic,
      room.panorama360,
      room.position,
      room.published,
    ],
  );
}

// --- services --------------------------------------------------------------

export type AdminService = {
  id: string;
  icon: string;
  title: Trio<string>;
  description: Trio<string>;
  position: number;
  published: boolean;
};

export async function listServices(): Promise<AdminService[]> {
  return query<AdminService & Record<string, never>>(
    `SELECT id, icon, title, description, position, published
     FROM services ORDER BY position, id`,
  ) as unknown as Promise<AdminService[]>;
}

export async function upsertService(s: AdminService): Promise<void> {
  await query(
    `INSERT INTO services (id, icon, title, description, position, published)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       icon=EXCLUDED.icon, title=EXCLUDED.title, description=EXCLUDED.description,
       position=EXCLUDED.position, published=EXCLUDED.published, updated_at=now()`,
    [s.id, s.icon, JSON.stringify(s.title), JSON.stringify(s.description), s.position, s.published],
  );
}

// --- offers ----------------------------------------------------------------

export type AdminOffer = {
  id: string;
  slug: string;
  image: string;
  badge: Trio<string>;
  title: Trio<string>;
  description: Trio<string>;
  priceFrom: number;
  priceLabel: Trio<string>;
  includes: Trio<string[]>;
  conditions: Trio<string[]>;
  position: number;
  published: boolean;
};

export async function listOffers(): Promise<AdminOffer[]> {
  const rows = await query(
    `SELECT id, slug, image, badge, title, description, price_from, price_label,
            includes, conditions, position, published
     FROM offers ORDER BY position, id`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    slug: r.slug as string,
    image: r.image as string,
    badge: r.badge as Trio<string>,
    title: r.title as Trio<string>,
    description: r.description as Trio<string>,
    priceFrom: num(r.price_from),
    priceLabel: r.price_label as Trio<string>,
    includes: r.includes as Trio<string[]>,
    conditions: r.conditions as Trio<string[]>,
    position: r.position as number,
    published: r.published as boolean,
  }));
}

export async function upsertOffer(o: AdminOffer): Promise<void> {
  await query(
    `INSERT INTO offers
       (id, slug, image, badge, title, description, price_from, price_label,
        includes, conditions, position, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       slug=EXCLUDED.slug, image=EXCLUDED.image, badge=EXCLUDED.badge,
       title=EXCLUDED.title, description=EXCLUDED.description,
       price_from=EXCLUDED.price_from, price_label=EXCLUDED.price_label,
       includes=EXCLUDED.includes, conditions=EXCLUDED.conditions,
       position=EXCLUDED.position, published=EXCLUDED.published, updated_at=now()`,
    [
      o.id, o.slug, o.image,
      JSON.stringify(o.badge), JSON.stringify(o.title), JSON.stringify(o.description),
      o.priceFrom, JSON.stringify(o.priceLabel),
      JSON.stringify(o.includes), JSON.stringify(o.conditions),
      o.position, o.published,
    ],
  );
}

// --- testimonials ----------------------------------------------------------

export type AdminTestimonial = {
  id: string;
  author: string;
  origin: Trio<string>;
  quote: Trio<string>;
  rating: number;
  position: number;
  published: boolean;
};

export async function listTestimonials(): Promise<AdminTestimonial[]> {
  return query(
    `SELECT id, author, origin, quote, rating, position, published
     FROM testimonials ORDER BY position, id`,
  ) as unknown as Promise<AdminTestimonial[]>;
}

export async function upsertTestimonial(t: AdminTestimonial): Promise<void> {
  await query(
    `INSERT INTO testimonials (id, author, origin, quote, rating, position, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET
       author=EXCLUDED.author, origin=EXCLUDED.origin, quote=EXCLUDED.quote,
       rating=EXCLUDED.rating, position=EXCLUDED.position,
       published=EXCLUDED.published, updated_at=now()`,
    [t.id, t.author, JSON.stringify(t.origin), JSON.stringify(t.quote), t.rating, t.position, t.published],
  );
}

// --- posts -----------------------------------------------------------------

export type AdminPost = {
  slug: string;
  image: string;
  date: string;
  readingMinutes: number;
  category: Trio<string>;
  title: Trio<string>;
  excerpt: Trio<string>;
  body: Trio<string[]>;
  published: boolean;
};

export async function listPosts(): Promise<AdminPost[]> {
  const rows = await query(
    `SELECT slug, image, date, reading_minutes, category, title, excerpt, body, published
     FROM posts ORDER BY date DESC`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    slug: r.slug as string,
    image: r.image as string,
    date:
      r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date).slice(0, 10),
    readingMinutes: r.reading_minutes as number,
    category: r.category as Trio<string>,
    title: r.title as Trio<string>,
    excerpt: r.excerpt as Trio<string>,
    body: r.body as Trio<string[]>,
    published: r.published as boolean,
  }));
}

export async function upsertPost(p: AdminPost, previousSlug?: string): Promise<void> {
  if (previousSlug && previousSlug !== p.slug) {
    await query(`DELETE FROM posts WHERE slug = $1`, [previousSlug]);
  }
  await query(
    `INSERT INTO posts
       (slug, image, date, reading_minutes, category, title, excerpt, body, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (slug) DO UPDATE SET
       image=EXCLUDED.image, date=EXCLUDED.date,
       reading_minutes=EXCLUDED.reading_minutes, category=EXCLUDED.category,
       title=EXCLUDED.title, excerpt=EXCLUDED.excerpt, body=EXCLUDED.body,
       published=EXCLUDED.published, updated_at=now()`,
    [
      p.slug, p.image, p.date, p.readingMinutes,
      JSON.stringify(p.category), JSON.stringify(p.title),
      JSON.stringify(p.excerpt), JSON.stringify(p.body), p.published,
    ],
  );
}

// --- gallery ---------------------------------------------------------------

export type AdminGalleryImage = {
  id: number;
  src: string;
  alt: string;
  position: number;
  published: boolean;
};

export async function listGallery(): Promise<AdminGalleryImage[]> {
  return query(
    `SELECT id, src, alt, position, published FROM gallery_images
     ORDER BY position, id`,
  ) as unknown as Promise<AdminGalleryImage[]>;
}

export async function addGalleryImage(src: string, alt: string): Promise<void> {
  await query(
    `INSERT INTO gallery_images (src, alt, position)
     VALUES ($1,$2,(SELECT coalesce(max(position),-1)+1 FROM gallery_images))`,
    [src, alt],
  );
}

// --- extras & promo codes --------------------------------------------------

export type AdminExtra = {
  id: string;
  label: Trio<string>;
  description: Trio<string>;
  price: number;
  perNight: boolean;
  position: number;
  active: boolean;
};

export async function listExtras(): Promise<AdminExtra[]> {
  const rows = await query(
    `SELECT id, label, description, price, per_night, position, active
     FROM extras ORDER BY position, id`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    label: r.label as Trio<string>,
    description: r.description as Trio<string>,
    price: num(r.price),
    perNight: r.per_night as boolean,
    position: r.position as number,
    active: r.active as boolean,
  }));
}

export async function upsertExtra(e: AdminExtra): Promise<void> {
  await query(
    `INSERT INTO extras (id, label, description, price, per_night, position, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET
       label=EXCLUDED.label, description=EXCLUDED.description, price=EXCLUDED.price,
       per_night=EXCLUDED.per_night, position=EXCLUDED.position,
       active=EXCLUDED.active, updated_at=now()`,
    [e.id, JSON.stringify(e.label), JSON.stringify(e.description), e.price, e.perNight, e.position, e.active],
  );
}

export type PromoCode = {
  code: string;
  percent: number;
  active: boolean;
  expiresAt: string | null;
  uses: number;
};

export async function listPromoCodes(): Promise<PromoCode[]> {
  const rows = await query(
    `SELECT code, percent, active, expires_at, uses FROM promo_codes ORDER BY code`,
  );
  return rows.map((r: Record<string, unknown>) => ({
    code: r.code as string,
    percent: num(r.percent),
    active: r.active as boolean,
    expiresAt:
      r.expires_at instanceof Date
        ? r.expires_at.toISOString().slice(0, 10)
        : (r.expires_at as string | null),
    uses: r.uses as number,
  }));
}

export async function upsertPromoCode(p: {
  code: string;
  percent: number;
  active: boolean;
  expiresAt: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO promo_codes (code, percent, active, expires_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (code) DO UPDATE SET
       percent=EXCLUDED.percent, active=EXCLUDED.active, expires_at=EXCLUDED.expires_at`,
    [p.code.toUpperCase().trim(), p.percent, p.active, p.expiresAt || null],
  );
}

export async function deletePromoCode(code: string): Promise<void> {
  await query(`DELETE FROM promo_codes WHERE code = $1`, [code]);
}

/** Looks up an active, unexpired promo code. Used by the booking flow. */
export async function findPromoCode(
  code: string,
): Promise<{ code: string; percent: number } | null> {
  const row = await queryOne<{ code: string; percent: string }>(
    `SELECT code, percent FROM promo_codes
     WHERE code = $1 AND active = true
       AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)`,
    [code.toUpperCase().trim()],
  );
  return row ? { code: row.code, percent: num(row.percent) } : null;
}

// --- settings --------------------------------------------------------------

export async function updateSettings(values: {
  name: string;
  totalRooms: number;
  brandTagline: Trio<string>;
  street: string;
  postalCode: string;
  city: string;
  email: string;
  phones: string[];
  social: Record<string, string>;
  coords: { lat: number; lng: number };
  rating: { score: number; count: number };
  paymentMethods: string[];
}): Promise<void> {
  await query(
    `UPDATE settings SET
       name=$1, total_rooms=$2, brand_tagline=$3, street=$4, postal_code=$5,
       city=$6, email=$7, phones=$8, social=$9, coords=$10, rating=$11,
       payment_methods=$12, updated_at=now()
     WHERE id = 1`,
    [
      values.name,
      values.totalRooms,
      JSON.stringify(values.brandTagline),
      values.street,
      values.postalCode,
      values.city,
      values.email,
      JSON.stringify(values.phones),
      JSON.stringify(values.social),
      JSON.stringify(values.coords),
      JSON.stringify(values.rating),
      JSON.stringify(values.paymentMethods),
    ],
  );
}
