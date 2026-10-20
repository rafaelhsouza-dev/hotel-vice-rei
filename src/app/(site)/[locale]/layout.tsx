import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import Script from "next/script";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { JsonLd } from "@/components/JsonLd";
import { Analytics } from "@/components/Analytics";
import { StaleBuildRecovery } from "@/components/StaleBuildRecovery";
import { CONSENT_DEFAULT_SCRIPT } from "@/components/site/consent";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getHotel, getAnalytics, getSeo } from "@/lib/repo/content";
import { getFacts } from "@/lib/facts";
import { SITE_URL } from "@/lib/site";
import { BCP47, OG_LOCALE } from "@/lib/seo";

/**
 * Root layout for the public site. It owns <html>, so `lang` can follow the
 * locale segment — the backoffice has its own root layout under (admin).
 *
 * Canonical, hreflang, og:url and the Twitter card are page-specific and live
 * in each page's generateMetadata (src/lib/seo.ts), so no page inherits the
 * home page's canonical. The share image comes from ./opengraph-image.tsx.
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const [analytics, seo] = await Promise.all([getAnalytics(), getSeo()]);

  // Ownership tokens for the other search engines and platforms, only when set.
  const other: Record<string, string> = {};
  if (seo.bing) other["msvalidate.01"] = seo.bing;
  if (seo.yandex) other["yandex-verification"] = seo.yandex;
  if (seo.facebookDomain) other["facebook-domain-verification"] = seo.facebookDomain;
  if (seo.pinterest) other["p:domain_verify"] = seo.pinterest;

  return {
    metadataBase: new URL(SITE_URL),
    ...(analytics.searchConsole
      ? { verification: { google: analytics.searchConsole } }
      : {}),
    ...(Object.keys(other).length ? { other } : {}),
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
    openGraph: {
      type: "website",
      siteName: "Hotel Vice-Rei",
      title: dict.meta.title,
      description: dict.meta.description,
      locale: OG_LOCALE[locale],
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
  const [hotel, facts, analytics, seo] = await Promise.all([
    getHotel(),
    getFacts(),
    getAnalytics(),
    getSeo(),
  ]);

  return (
    <html
      lang={BCP47[locale]}
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Consent Mode v2 defaults: must run before any Google tag. */}
        <Script id="consent-default" strategy="beforeInteractive">
          {CONSENT_DEFAULT_SCRIPT}
        </Script>
        <a
          href="#conteudo"
          className="sr-only rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
        >
          {dict.a11y.skipToContent}
        </a>
        <JsonLd facts={facts} locale={locale} />
        <Header locale={locale} dict={dict} />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} dict={dict} hotel={hotel} />
        <CookieConsent locale={locale} dict={dict} />
        <Analytics
          ga4={analytics.ga4}
          gtm={analytics.gtm}
          clarity={seo.clarity}
          hotjar={seo.hotjar}
          metaPixel={seo.metaPixel}
          googleAdsId={seo.googleAdsId}
          googleAdsLabel={seo.googleAdsLabel}
        />
        <StaleBuildRecovery />
      </body>
    </html>
  );
}
