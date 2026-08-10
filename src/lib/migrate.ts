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

// --- operations -----------------------------------------------------------

/**
 * Builds the physical unit list from the room categories: floors 1–5, ten
 * units each, cycling through the published categories so every unit has a
 * plausible type. Gives the hotel a working floor plan on day one.
 */
async function seedUnits() {
  if (!(await isEmpty("units"))) return;

  const categories = seedRooms.map((r) => r.id);
  const perFloor = 10;
  const floors = Math.max(1, Math.ceil(hotel.totalRooms / perFloor));

  await transaction(async (client) => {
    let made = 0;
    for (let floor = 1; floor <= floors && made < hotel.totalRooms; floor++) {
      for (let n = 1; n <= perFloor && made < hotel.totalRooms; n++) {
        const code = `${floor}${String(n).padStart(2, "0")}`;
        await client.query(
          `INSERT INTO units (code, floor, room_id) VALUES ($1,$2,$3)
           ON CONFLICT (code) DO NOTHING`,
          [code, floor, categories[made % categories.length]],
        );
        made++;
      }
    }
  });
}

async function seedStaff() {
  if (!(await isEmpty("staff"))) return;
  const people = [
    ["Ana Carvalho", "Chefe de recepção", "reception", "morning"],
    ["Bruno Matos", "Rececionista", "reception", "night"],
    ["Cátia Nunes", "Governanta", "housekeeping", "morning"],
    ["Diogo Pires", "Empregado de andares", "housekeeping", "afternoon"],
    ["Elsa Moreira", "Empregada de andares", "housekeeping", "morning"],
    ["FilipeRocha", "Técnico de manutenção", "maintenance", "flexible"],
    ["Gabriela Sousa", "Chefe de cozinha", "kitchen", "morning"],
    ["Hugo Antunes", "Diretor de operações", "management", "flexible"],
  ] as const;

  await transaction(async (client) => {
    for (const [name, role, department, shift] of people) {
      await client.query(
        `INSERT INTO staff (name, role, department, shift, email)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          name,
          role,
          department,
          shift,
          `${name.split(" ")[0].toLowerCase()}@hotelvicerei.com`,
        ],
      );
    }
  });
}

async function seedSuppliers() {
  if (!(await isEmpty("suppliers"))) return;
  const list = [
    ["Distribuidora Douro", "Encomendas", "encomendas@douro.example", "+351 220 000 001"],
    ["Lavandaria Invicta", "Serviço têxtil", "geral@invicta.example", "+351 220 000 002"],
    ["Higiene Norte", "Comercial", "vendas@higienenorte.example", "+351 220 000 003"],
  ];
  await transaction(async (client) => {
    for (const [name, contact, email, phone] of list) {
      await client.query(
        `INSERT INTO suppliers (name, contact, email, phone) VALUES ($1,$2,$3,$4)
         ON CONFLICT (name) DO NOTHING`,
        [name, contact, email, phone],
      );
    }
  });
}

async function seedInventory() {
  if (!(await isEmpty("inventory_items"))) return;
  const items: [string, string, string, number, number, number][] = [
    ["Toalhas de banho", "linen", "un", 240, 120, 6.5],
    ["Lençóis de casal", "linen", "un", 160, 80, 12.0],
    ["Gel de banho 30 ml", "amenities", "un", 900, 300, 0.45],
    ["Champô 30 ml", "amenities", "un", 850, 300, 0.45],
    ["Papel higiénico", "cleaning", "rolo", 600, 200, 0.32],
    ["Detergente multiusos", "cleaning", "L", 45, 20, 2.8],
    ["Café em grão", "beverage", "kg", 28, 15, 14.5],
    ["Leite meio-gordo", "food", "L", 60, 40, 0.85],
    ["Manteiga individual", "food", "un", 400, 200, 0.18],
    ["Lâmpadas LED E27", "maintenance", "un", 35, 20, 3.2],
  ];

  await transaction(async (client) => {
    const { rows } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM suppliers`,
    );
    const supplierFor = (category: string) => {
      const name =
        category === "linen" ? "Lavandaria Invicta"
        : category === "cleaning" || category === "amenities" ? "Higiene Norte"
        : "Distribuidora Douro";
      return rows.find((s) => s.name === name)?.id ?? null;
    };

    for (const [name, category, unit, quantity, min, cost] of items) {
      await client.query(
        `INSERT INTO inventory_items (name, category, unit, quantity, min_quantity, cost, supplier_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [name, category, unit, quantity, min, cost, supplierFor(category)],
      );
    }
  });
}

async function seedMeals() {
  if (!(await isEmpty("meals"))) return;
  const items: [string, string, string, number, string[], boolean][] = [
    ["breakfast", "Pequeno-almoço continental", "Pão fresco, fruta da época, iogurtes, queijos e charcutaria.", 12, ["glúten", "lactose"], false],
    ["breakfast", "Pastel de nata", "Clássico português, servido morno.", 1.6, ["glúten", "lactose", "ovo"], true],
    ["breakfast", "Sumo de laranja natural", "Espremido na hora.", 3.2, [], true],
    ["lunch", "Sopa do dia", "Preparada diariamente com legumes frescos.", 4.5, [], true],
    ["lunch", "Bacalhau à Braga", "Com cebola, batata e azeite virgem extra.", 17.5, ["peixe"], false],
    ["dinner", "Francesinha do Vice-Rei", "A versão da casa, com molho de cerveja preta.", 15.9, ["glúten", "lactose"], false],
    ["dinner", "Risoto de cogumelos", "Arroz carnaroli, cogumelos silvestres e parmesão.", 14.5, ["lactose"], true],
    ["room_service", "Tábua de queijos e enchidos", "Seleção regional para dois.", 18, ["lactose"], false],
    ["room_service", "Clube sandwich", "Frango, bacon, ovo e batata frita.", 11.5, ["glúten", "ovo"], false],
    ["bar", "Vinho do Porto Tawny", "Copo de 60 ml.", 4.8, ["sulfitos"], true],
  ];

  await transaction(async (client) => {
    for (const [i, [service, name, description, price, allergens, vegetarian]] of items.entries()) {
      await client.query(
        `INSERT INTO meals (service, name, description, price, allergens, vegetarian, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          service,
          JSON.stringify(trioFromValue(name)),
          JSON.stringify(trioFromValue(description)),
          price,
          JSON.stringify(allergens),
          vegetarian,
          i,
        ],
      );
    }
  });
}

/** Seeds the same text in every locale — the kitchen translates later. */
function trioFromValue(value: string) {
  return Object.fromEntries(locales.map((l) => [l, value])) as Record<Locale, string>;
}

/**
 * Points existing rows at the 2026 photography.
 *
 * Only rewrites values that still match a known stock path, so anything already
 * changed through the backoffice is left alone. Idempotent: after the first run
 * there are no old paths left to match.
 */
async function migrateImagePaths() {
  const singles: [string, string][] = [
    ["/images/hero/banner-home.jpg", "/images/hero/home.webp"],
    ["/images/hero/hero-main.jpg", "/images/hero/gallery.webp"],
    ["/images/hero/hero-room.jpg", "/images/rooms/twin-superior.webp"],
    ["/images/hero/hero-porto.jpg", "/images/porto/view-city.webp"],
    ["/images/hero/featured-lobby.jpg", "/images/hotel/lounge.webp"],
    ["/images/hero/featured-suite.jpg", "/images/rooms/twin-superior-2.webp"],
    ["/images/hero/featured-detail.jpg", "/images/porto/view-balcony.webp"],
    ["/images/hero/featured-bathroom.jpg", "/images/rooms/bathroom-marble.webp"],
    ["/images/hero/featured-breakfast.jpg", "/images/hotel/breakfast-plate.webp"],
    ["/images/rooms/room-single.jpg", "/images/rooms/single.webp"],
    ["/images/rooms/room-superior.jpg", "/images/rooms/single-superior.webp"],
    ["/images/rooms/room-twin.jpg", "/images/rooms/twin.webp"],
    ["/images/rooms/room-double.jpg", "/images/rooms/twin-superior.webp"],
    ["/images/rooms/room-triple.jpg", "/images/rooms/triple.webp"],
    ["/images/rooms/room-romantic.jpg", "/images/rooms/romantic.webp"],
    ["/images/rooms/room-detail.jpg", "/images/rooms/bathroom-classic.webp"],
    ["/images/rooms/room-suite-portrait.jpg", "/images/rooms/triple-2.webp"],
    ["/images/rooms/hotel-interior.jpg", "/images/hotel/hall.webp"],
    ["/images/rooms/hotel-lobby.jpg", "/images/hotel/lobby.webp"],
  ];

  for (const [from, to] of singles) {
    await query(`UPDATE rooms SET image = $2 WHERE image = $1`, [from, to]);
    await query(`UPDATE offers SET image = $2 WHERE image = $1`, [from, to]);
    await query(`UPDATE posts SET image = $2 WHERE image = $1`, [from, to]);
    await query(`UPDATE gallery_images SET src = $2 WHERE src = $1`, [from, to]);
    await query(`UPDATE media SET path = $2 WHERE path = $1`, [from, to]);
  }

  // Room galleries are arrays; replace wholesale when they still look untouched.
  for (const room of seedRooms) {
    await query(
      `UPDATE rooms SET gallery = $2, updated_at = now()
       WHERE id = $1 AND gallery::text LIKE '%room-%.jpg%'`,
      [room.id, JSON.stringify(room.gallery)],
    );
  }

}

/**
 * Replaces the stock gallery with the curated 2026 selection.
 *
 * Runs before the path rewrites above so it can still recognise stock entries
 * by their .jpg extension. Rows added through the backoffice are .webp uploads
 * and survive untouched; if none of the entries are stock, this does nothing.
 */
async function migrateGallery() {
  const stock = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM gallery_images WHERE src LIKE '%.jpg'`,
  );
  if (stock[0]?.n === "0") return;

  await transaction(async (client) => {
    await client.query(`DELETE FROM gallery_images WHERE src LIKE '%.jpg'`);
    const { rows } = await client.query<{ n: string }>(
      `SELECT coalesce(max(position), -1)::text AS n FROM gallery_images`,
    );
    let position = Number(rows[0]?.n ?? -1) + 1;
    for (const src of seedGallery) {
      await client.query(
        `INSERT INTO gallery_images (src, alt, position) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [src, "Hotel Vice-Rei · Porto", position++],
      );
    }
  });
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
    await seedUnits();
    await seedStaff();
    await seedSuppliers();
    await seedInventory();
    await seedMeals();
    await seedAdminUser();
    await migrateGallery();
    await migrateImagePaths();
    migrated = true;
    console.log("[migrate] database ready");
    return true;
  } catch (err) {
    console.error("[migrate] skipped:", (err as Error).message);
    return false;
  }
}
