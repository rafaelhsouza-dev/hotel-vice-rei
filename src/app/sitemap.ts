import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { getRooms, getPosts } from "@/lib/repo/content";
import { safeQuery } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { hreflang } from "@/lib/seo";

export const revalidate = 3600;

/**
 * Every public page in every locale, each with its hreflang siblings.
 * The guest booking pages (/[locale]/reserva/…) are private and never listed.
 *
 * lastModified comes from the tables' updated_at. Without a database (the
 * Docker build) it falls back to a fixed date rather than "now", so the
 * sitemap does not claim every page changed on every build.
 */

const FALLBACK_LASTMOD = new Date("2026-10-20T00:00:00Z");

type Freq = MetadataRoute.Sitemap[number]["changeFrequency"];

/** Sections and the content tables whose edits change them. */
const SECTIONS: { path: string; priority: number; freq: Freq; tables: string[] }[] = [
  { path: "", priority: 1, freq: "weekly", tables: ["settings", "rooms", "offers", "services", "testimonials"] },
  { path: "/quartos", priority: 0.9, freq: "weekly", tables: ["rooms"] },
  { path: "/reservar", priority: 0.9, freq: "weekly", tables: ["rooms", "offers"] },
  { path: "/promocoes", priority: 0.8, freq: "weekly", tables: ["offers"] },
  { path: "/servicos", priority: 0.7, freq: "monthly", tables: ["services", "settings"] },
  { path: "/apresentacao", priority: 0.7, freq: "monthly", tables: ["settings"] },
  { path: "/galeria", priority: 0.6, freq: "monthly", tables: ["settings"] },
  { path: "/blog", priority: 0.6, freq: "weekly", tables: ["posts"] },
  { path: "/contactos", priority: 0.6, freq: "monthly", tables: ["settings"] },
  { path: "/cancelamento", priority: 0.3, freq: "yearly", tables: [] },
  { path: "/privacidade", priority: 0.2, freq: "yearly", tables: [] },
  { path: "/acessibilidade", priority: 0.2, freq: "yearly", tables: [] },
];

async function tableDates(): Promise<Record<string, Date>> {
  const rows = await safeQuery<{ t: string; at: Date | string | null }>(
    `SELECT 'settings' AS t, max(updated_at) AS at FROM settings
     UNION ALL SELECT 'rooms', max(updated_at) FROM rooms WHERE published = true
     UNION ALL SELECT 'offers', max(updated_at) FROM offers WHERE published = true
     UNION ALL SELECT 'services', max(updated_at) FROM services WHERE published = true
     UNION ALL SELECT 'testimonials', max(updated_at) FROM testimonials WHERE published = true
     UNION ALL SELECT 'posts', max(updated_at) FROM posts WHERE published = true`,
  );
  const out: Record<string, Date> = {};
  for (const r of rows ?? []) if (r.at) out[r.t] = new Date(r.at);
  return out;
}

async function rowDates(table: "rooms" | "posts"): Promise<Record<string, Date>> {
  const rows = await safeQuery<{ slug: string; updated_at: Date | string }>(
    `SELECT slug, updated_at FROM ${table} WHERE published = true`,
  );
  return Object.fromEntries((rows ?? []).map((r) => [r.slug, new Date(r.updated_at)]));
}

function latest(dates: (Date | undefined)[]): Date {
  const valid = dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  return valid.length ? new Date(Math.max(...valid.map((d) => d.getTime()))) : FALLBACK_LASTMOD;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [rooms, posts, tables, roomDates, postDates] = await Promise.all([
    getRooms(),
    getPosts(),
    tableDates(),
    rowDates("rooms"),
    rowDates("posts"),
  ]);
  const items: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const section of SECTIONS) {
      items.push({
        url: `${SITE_URL}/${locale}${section.path}`,
        lastModified: latest(section.tables.map((t) => tables[t])),
        changeFrequency: section.freq,
        priority: section.priority,
        alternates: { languages: hreflang(section.path) },
      });
    }

    for (const room of rooms) {
      const path = `/quartos/${room.slug}`;
      items.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: latest([roomDates[room.slug]]),
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: { languages: hreflang(path) },
      });
    }

    for (const post of posts) {
      const path = `/blog/${post.slug}`;
      items.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: latest([postDates[post.slug], new Date(post.date)]),
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: { languages: hreflang(path) },
      });
    }
  }

  return items;
}
