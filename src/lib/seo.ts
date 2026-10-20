import type { Metadata, ResolvingMetadata } from "next";
import { locales, type Locale } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";

/**
 * Per-page metadata for the public site.
 *
 * Every page builds its canonical, hreflang set, Open Graph and Twitter card
 * here, so no page inherits the home page's canonical from the layout. The
 * x-default always points at the Portuguese version — the same rule the
 * sitemap uses.
 */

export const OG_LOCALE: Record<Locale, string> = {
  pt: "pt_PT",
  en: "en_GB",
  es: "es_ES",
  fr: "fr_FR",
};

/** BCP 47 tags for <html lang>, dates and number formatting. */
export const BCP47: Record<Locale, string> = {
  pt: "pt-PT",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
};

/** Absolute URL for a locale + path ("" is the locale home). */
export function localeUrl(locale: Locale, path = ""): string {
  return `${SITE_URL}/${locale}${path}`;
}

/** hreflang map for one path: every locale plus x-default (Portuguese). */
export function hreflang(path = ""): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = localeUrl(l, path);
  languages["x-default"] = localeUrl("pt", path);
  return languages;
}

type OgImages = NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;

function absolute(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export type PageMetaInput = {
  locale: Locale;
  /** Path after the locale, starting with "/" — "" for the home page. */
  path: string;
  title: string;
  description: string;
  /** A photo for the share card. Omit to use the branded generated card. */
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
  /** Images resolved by the parent segment (the generated OG card). */
  fallbackImages?: OgImages;
  /** Use the title as-is, without the " · Hotel Vice-Rei" template. */
  absoluteTitle?: boolean;
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
};

export function pageMeta(input: PageMetaInput): Metadata {
  const {
    locale,
    path,
    title,
    description,
    image,
    imageAlt,
    type = "website",
    fallbackImages,
    absoluteTitle,
    noindex,
    publishedTime,
    modifiedTime,
  } = input;
  const url = localeUrl(locale, path);

  // Photos have arbitrary proportions, so no width/height is claimed for them;
  // the generated card carries its own 1200×630 from the file convention.
  const images: OgImages | undefined = image
    ? [{ url: absolute(image), alt: imageAlt ?? title }]
    : fallbackImages;

  const twitterImages = image
    ? [absolute(image)]
    : Array.isArray(fallbackImages)
      ? fallbackImages.map((i) =>
          typeof i === "string" || i instanceof URL ? String(i) : String(i.url),
        )
      : undefined;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: hreflang(path) },
    openGraph: {
      type,
      url,
      siteName: "Hotel Vice-Rei",
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      ...(images ? { images } : {}),
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(twitterImages ? { images: twitterImages } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** The OG images the parent resolved — the generated card at [locale]. */
export async function parentImages(parent: ResolvingMetadata): Promise<OgImages | undefined> {
  const images = (await parent).openGraph?.images;
  return images && images.length ? (images as OgImages) : undefined;
}

/** Safe payload for an inline JSON-LD <script> (escapes "<"). */
export function jsonLdScript(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
