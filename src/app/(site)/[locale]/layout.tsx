import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { JsonLd } from "@/components/JsonLd";
import { Analytics } from "@/components/Analytics";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getHotel, getRooms, getAnalytics } from "@/lib/repo/content";
import { SITE_URL, OG_IMAGE } from "@/lib/site";

/**
 * Root layout for the public site. It owns <html>, so `lang` can follow the
 * locale segment — the backoffice has its own root layout under (admin).
 */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#14110f",
  colorScheme: "light",
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Maps each locale to its canonical URL, plus x-default for Portuguese. */
function alternateLanguages(path = "") {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${SITE_URL}/${l}${path}`;
  languages["x-default"] = `${SITE_URL}/pt${path}`;
  return languages;
}

const OG_LOCALE: Record<Locale, string> = {
  pt: "pt_PT",
  en: "en_GB",
  es: "es_ES",
  fr: "fr_FR",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const analytics = await getAnalytics();

  return {
    metadataBase: new URL(SITE_URL),
    ...(analytics.searchConsole
      ? { verification: { google: analytics.searchConsole } }
      : {}),
    title: { default: dict.meta.title, template: "%s · Hotel Vice-Rei" },
    description: dict.meta.description,
    applicationName: "Hotel Vice-Rei",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: alternateLanguages(),
    },
    openGraph: {
      type: "website",
      siteName: "Hotel Vice-Rei",
      title: dict.meta.title,
      description: dict.meta.description,
      url: `${SITE_URL}/${locale}`,
      locale: OG_LOCALE[locale],
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: dict.meta.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: [OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
}

export default async function SiteLayout({ children, params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const [hotel, rooms, analytics] = await Promise.all([
    getHotel(),
    getRooms(),
    getAnalytics(),
  ]);

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#conteudo"
          className="sr-only rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
        >
          {dict.a11y.skipToContent}
        </a>
        <JsonLd hotel={hotel} rooms={rooms} locale={locale} />
        <Header locale={locale} dict={dict} />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} dict={dict} hotel={hotel} />
        <CookieConsent locale={locale} dict={dict} />
        <Analytics ga4={analytics.ga4} gtm={analytics.gtm} />
      </body>
    </html>
  );
}
