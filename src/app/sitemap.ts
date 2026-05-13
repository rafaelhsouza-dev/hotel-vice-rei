import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { rooms } from "@/data/hotel";

const BASE = "https://www.hotelvicerei.com";

const sections = [
  "",
  "/apresentacao",
  "/quartos",
  "/servicos",
  "/promocoes",
  "/galeria",
  "/contactos",
  "/reservar",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const items: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const path of sections) {
      items.push({
        url: `${BASE}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: path === "" ? 1 : 0.7,
      });
    }
    for (const r of rooms) {
      items.push({
        url: `${BASE}/${locale}/quartos/${r.slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }
  return items;
}
