import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Backoffice: behind auth, a crawl only hits the login redirect.
          "/admin",
          // Route handlers (forms, webhooks, iCal) are not pages.
          "/api/",
          // A guest's own booking page (/pt/reserva/<token>) — private, also
          // sent with X-Robots-Tag: noindex. /reservar stays crawlable.
          "/*/reserva/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
