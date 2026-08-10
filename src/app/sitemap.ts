import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { getRooms, getPosts } from "@/lib/repo/content";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

/** Sections that exist for every locale, with their relative priority. */
const SECTIONS: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, freq: "weekly" },
  { path: "/quartos", priority: 0.9, freq: "weekly" },
  { path: "/reservar", priority: 0.9, freq: "weekly" },
  { path: "/promocoes", priority: 0.8, freq: "weekly" },
  { path: "/servicos", priority: 0.7, freq: "monthly" },
  { path: "/apresentacao", priority: 0.7, freq: "monthly" },
  { path: "/galeria", priority: 0.6, freq: "monthly" },
  { path: "/blog", priority: 0.6, freq: "weekly" },
  { path: "/contactos", priority: 0.6, freq: "monthly" },
  { path: "/cancelamento", priority: 0.3, freq: "yearly" },
  { path: "/privacidade", priority: 0.2, freq: "yearly" },
  { path: "/acessibilidade", priority: 0.2, freq: "yearly" },
];

/** hreflang block so each URL declares its siblings in the other languages. */
function alternates(path: string) {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${SITE_URL}/${l}${path}`;
  languages["x-default"] = `${SITE_URL}/pt${path}`;
  return { languages };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [rooms, posts] = await Promise.all([getRooms(), getPosts()]);
  const now = new Date();
  const items: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const section of SECTIONS) {
      items.push({
        url: `${SITE_URL}/${locale}${section.path}`,
        lastModified: now,
        changeFrequency: section.freq,
        priority: section.priority,
        alternates: alternates(section.path),
      });
    }

    for (const room of rooms) {
      items.push({
        url: `${SITE_URL}/${locale}/quartos/${room.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: alternates(`/quartos/${room.slug}`),
      });
    }

    for (const post of posts) {
      items.push({
        url: `${SITE_URL}/${locale}/blog/${post.slug}`,
        lastModified: new Date(post.date),
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: alternates(`/blog/${post.slug}`),
      });
    }
  }

  return items;
}
