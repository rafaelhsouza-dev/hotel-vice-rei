import { ImageResponse } from "next/og";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { hotel } from "@/data/hotel";
import { SITE_URL } from "@/lib/site";

/**
 * Branded 1200×630 share card per locale — used by every page that has no
 * photo of its own (rooms, posts and offers use their photograph instead).
 * Text only, with the default font, so it renders without network or files.
 */

export const alt = "Hotel Vice-Rei · Porto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const LINE: Record<Locale, string> = {
  pt: "Hotel de 2 estrelas · Rua Júlio Dinis, Porto",
  en: "2-star hotel · Rua Júlio Dinis, Porto",
  es: "Hotel de 2 estrellas · Rua Júlio Dinis, Oporto",
  fr: "Hôtel 2 étoiles · Rua Júlio Dinis, Porto",
};

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "pt";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #14110f 0%, #2a211b 60%, #3b2a1f 100%)",
          color: "#faf7f2",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 2, background: "#d9b88a" }} />
          <div style={{ fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#d9b88a" }}>
            Porto · Portugal
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>
            {hotel.name}
          </div>
          <div style={{ marginTop: 28, fontSize: 40, lineHeight: 1.25, color: "rgba(250,247,242,0.85)", maxWidth: 980 }}>
            {hotel.brandTagline[locale]}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "rgba(250,247,242,0.7)" }}>
          <div>{LINE[locale]}</div>
          <div>{new URL(SITE_URL).host.replace(/^www\./, "")}</div>
        </div>
      </div>
    ),
    size,
  );
}
