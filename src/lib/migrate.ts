import { query, transaction, isDbConfigured } from "./db";
import { SCHEMA_SQL } from "./schema";
import { hashPassword } from "./auth/password";
import {
  hotel,
  rooms as seedRooms,
  services as seedServices,
  offers as seedOffers,
  testimonials as seedTestimonials,
  galleryImages as seedGallery,
} from "@/data/hotel";
import { posts as seedPosts } from "@/data/blog";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

/**
 * Creates the schema and populates it from the seed data the site shipped with.
 * Every step is idempotent: tables are only filled when empty, so restarts and
 * redeploys never clobber content edited through the admin.
 */

function trioFrom(pick: (dict: ReturnType<typeof getDictionary>) => string) {
  return Object.fromEntries(
    locales.map((l) => [l, pick(getDictionary(l as Locale))]),
  ) as Record<Locale, string>;
}

async function isEmpty(table: string): Promise<boolean> {
  const rows = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${table}`,
  );
  return rows[0]?.n === "0";
}

async function seedSettings() {
  if (!(await isEmpty("settings"))) return;
  await query(
    `INSERT INTO settings
       (id, name, total_rooms, brand_tagline, street, postal_code, city, country,
        phones, email, social, coords, rating, legal, payment_methods, languages)
     VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO NOTHING`,
    [
      hotel.name,
      hotel.totalRooms,
      JSON.stringify(hotel.brandTagline),
      hotel.address.street,
      hotel.address.postalCode,
      hotel.address.city,
      JSON.stringify(hotel.address.country),
      JSON.stringify(hotel.phones),
      hotel.email,
      JSON.stringify(hotel.social),
      JSON.stringify(hotel.coords),
      JSON.stringify(hotel.rating),
      JSON.stringify(hotel.legal),
      JSON.stringify(hotel.paymentMethods),
      JSON.stringify(hotel.languages),
    ],
  );
}

async function seedRoomsTable() {
  if (!(await isEmpty("rooms"))) return;
  await transaction(async (client) => {
    for (const [i, r] of seedRooms.entries()) {
      await client.query(
        `INSERT INTO rooms
           (id, slug, image, gallery, capacity, size, bed, bathroom, price_from,
            name, short_description, long_description, amenities, romantic,
            panorama360, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.slug,
          r.image,
          JSON.stringify(r.gallery),
          r.capacity,
          r.size,
          JSON.stringify(r.bed),
          JSON.stringify(r.bathroom),
          r.priceFrom,
          JSON.stringify(r.name),
          JSON.stringify(r.shortDescription),
          JSON.stringify(r.longDescription),
          JSON.stringify(r.amenities),
          r.romantic ?? false,
          r.panorama360 ?? null,
          i,
        ],
      );
    }
  });
}

async function seedServicesTable() {
  if (!(await isEmpty("services"))) return;
  await transaction(async (client) => {
    for (const [i, s] of seedServices.entries()) {
      await client.query(
        `INSERT INTO services (id, icon, title, description, position)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.icon, JSON.stringify(s.title), JSON.stringify(s.description), i],
      );
    }
  });
}

async function seedOffersTable() {
  if (!(await isEmpty("offers"))) return;
  await transaction(async (client) => {
    for (const [i, o] of seedOffers.entries()) {
      await client.query(
        `INSERT INTO offers
           (id, slug, image, badge, title, description, price_from, price_label,
            includes, conditions, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          o.id,
          o.slug,
          o.image,
          JSON.stringify(o.badge),
          JSON.stringify(o.title),
          JSON.stringify(o.description),
          o.priceFrom,
          JSON.stringify(o.priceLabel),
          JSON.stringify(o.includes),
          JSON.stringify(o.conditions),
          i,
        ],
      );
    }
  });
}

async function seedTestimonialsTable() {
  if (!(await isEmpty("testimonials"))) return;
  await transaction(async (client) => {
    for (const [i, t] of seedTestimonials.entries()) {
      await client.query(
        `INSERT INTO testimonials (id, author, origin, quote, rating, position)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [t.id, t.author, JSON.stringify(t.origin), JSON.stringify(t.quote), t.rating, i],
      );
    }
  });
}

async function seedPostsTable() {
  if (!(await isEmpty("posts"))) return;
  await transaction(async (client) => {
    for (const p of seedPosts) {
      await client.query(
        `INSERT INTO posts
           (slug, image, date, reading_minutes, category, title, excerpt, body)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (slug) DO NOTHING`,
        [
          p.slug,
          p.image,
          p.date,
          p.readingMinutes,
          JSON.stringify(p.category),
          JSON.stringify(p.title),
          JSON.stringify(p.excerpt),
          JSON.stringify(p.body),
        ],
      );
    }
  });
}

async function seedGalleryTable() {
  if (!(await isEmpty("gallery_images"))) return;
  await transaction(async (client) => {
    for (const [i, src] of seedGallery.entries()) {
      await client.query(
        `INSERT INTO gallery_images (src, alt, position) VALUES ($1,$2,$3)`,
        [src, "Hotel Vice-Rei · Porto", i],
      );
    }
  });
}

async function seedExtrasTable() {
  if (!(await isEmpty("extras"))) return;
  const defs = [
    { id: "breakfast", price: 8, perNight: true, l: "breakfast", d: "breakfastDesc" },
    { id: "parking", price: 12, perNight: true, l: "parking", d: "parkingDesc" },
    { id: "lateCheckout", price: 20, perNight: false, l: "lateCheckout", d: "lateCheckoutDesc" },
    { id: "upgrade", price: 25, perNight: false, l: "upgrade", d: "upgradeDesc" },
  ] as const;

  await transaction(async (client) => {
    for (const [i, e] of defs.entries()) {
      await client.query(
        `INSERT INTO extras (id, label, description, price, per_night, position)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [
          e.id,
          JSON.stringify(trioFrom((d) => d.extras[e.l])),
          JSON.stringify(trioFrom((d) => d.extras[e.d])),
          e.price,
          e.perNight,
          i,
        ],
      );
    }
  });
}

async function seedPromoCodes() {
  if (!(await isEmpty("promo_codes"))) return;
  await query(
    `INSERT INTO promo_codes (code, percent) VALUES ('VICEREI10',0.10),('PORTO15',0.15)
     ON CONFLICT (code) DO NOTHING`,
  );
}

/** Creates the first admin from ADMIN_* env vars when no user exists yet. */
async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("[migrate] ADMIN_EMAIL/ADMIN_PASSWORD unset — no admin seeded");
    return;
  }
  if (!(await isEmpty("admin_users"))) return;

  await query(
    `INSERT INTO admin_users (email, name, password_hash, role)
     VALUES ($1,$2,$3,'owner') ON CONFLICT (email) DO NOTHING`,
    [
      email.toLowerCase().trim(),
      process.env.ADMIN_NAME || "Administrador",
      await hashPassword(password),
    ],
  );
  console.log(`[migrate] seeded admin user ${email}`);
}

let migrated = false;

/**
 * Runs schema + seed once per process. Never throws: a database that is
 * unreachable (e.g. during `docker build`) must not fail the render.
 */
export async function ensureDatabase(): Promise<boolean> {
  if (migrated) return true;
  if (!isDbConfigured()) return false;

  try {
    await query(SCHEMA_SQL);
    await seedSettings();
    await seedRoomsTable();
    await seedServicesTable();
    await seedOffersTable();
    await seedTestimonialsTable();
    await seedPostsTable();
    await seedGalleryTable();
    await seedExtrasTable();
    await seedPromoCodes();
    await seedAdminUser();
    migrated = true;
    console.log("[migrate] database ready");
    return true;
  } catch (err) {
    console.error("[migrate] skipped:", (err as Error).message);
    return false;
  }
}
