import type { Locale } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";
import { schemaTime, type Facts } from "@/lib/facts";
import { BCP47, jsonLdScript } from "@/lib/seo";

/**
 * Schema.org graph for the hotel, emitted on every page.
 *
 * One `@graph` so the Hotel, its address/geo and the website resolve to one
 * another by @id. Every value comes from src/lib/facts.ts; nothing here is
 * claimed unless it is verified (no parking, no breakfast inclusion, no 24h
 * reception, no aggregateRating — third-party scores are linked via sameAs
 * instead, and self-served review markup is not eligible for rich results).
 */

export const HOTEL_ID = `${SITE_URL}/#hotel`;

const DESCRIPTION: Record<Locale, (f: Facts) => string> = {
  pt: (f) =>
    `${f.hotel.name}: hotel de ${f.stars} estrelas com ${f.hotel.totalRooms} quartos na ${f.hotel.address.street}, ${f.hotel.address.postalCode} ${f.hotel.address.city}, Portugal.`,
  en: (f) =>
    `${f.hotel.name}: a ${f.stars}-star hotel with ${f.hotel.totalRooms} rooms at ${f.hotel.address.street}, ${f.hotel.address.postalCode} ${f.hotel.address.city}, Portugal.`,
  es: (f) =>
    `${f.hotel.name}: hotel de ${f.stars} estrellas con ${f.hotel.totalRooms} habitaciones en la ${f.hotel.address.street}, ${f.hotel.address.postalCode} ${f.hotel.address.city}, Portugal.`,
  fr: (f) =>
    `${f.hotel.name} : hôtel ${f.stars} étoiles de ${f.hotel.totalRooms} chambres, ${f.hotel.address.street}, ${f.hotel.address.postalCode} ${f.hotel.address.city}, Portugal.`,
};

const abs = (src: string) => (/^https?:\/\//.test(src) ? src : `${SITE_URL}${src}`);

export function JsonLd({ facts, locale }: { facts: Facts; locale: Locale }) {
  const { hotel, rooms, rules } = facts;

  const images = Array.from(
    new Set([
      "/images/hero/home.webp",
      "/images/hero/home-2.webp",
      ...rooms.map((r) => r.image),
    ]),
  ).map(abs);

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Hotel",
        "@id": HOTEL_ID,
        name: hotel.name,
        alternateName: facts.registeredName,
        url: `${SITE_URL}/${locale}`,
        description: DESCRIPTION[locale](facts),
        email: hotel.email,
        telephone: hotel.phones[0],
        address: {
          "@type": "PostalAddress",
          streetAddress: hotel.address.street,
          postalCode: hotel.address.postalCode,
          addressLocality: hotel.address.city,
          addressRegion: "Porto",
          addressCountry: "PT",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: hotel.coords.lat,
          longitude: hotel.coords.lng,
        },
        hasMap: `https://www.openstreetmap.org/?mlat=${hotel.coords.lat}&mlon=${hotel.coords.lng}#map=17/${hotel.coords.lat}/${hotel.coords.lng}`,
        image: images,
        logo: `${SITE_URL}/logo-hotel-vice-rei.png`,
        priceRange: facts.priceRange,
        currenciesAccepted: "EUR",
        starRating: { "@type": "Rating", ratingValue: String(facts.stars) },
        numberOfRooms: hotel.totalRooms,
        availableLanguage: hotel.languages.en,
        checkinTime: schemaTime(rules.checkInFrom),
        checkoutTime: schemaTime(rules.checkOutUntil),
        petsAllowed: facts.petsAllowed,
        smokingAllowed: facts.smokingAllowed,
        // Only what the room data states for every room.
        amenityFeature: ["Free Wi-Fi", "Air conditioning", "Private bathroom"].map((name) => ({
          "@type": "LocationFeatureSpecification",
          name,
          value: true,
        })),
        sameAs: facts.sameAs,
        makesOffer: rooms.map((room) => ({
          "@type": "Offer",
          name: room.name[locale],
          url: `${SITE_URL}/${locale}/quartos/${room.slug}`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            minPrice: room.priceFrom,
            priceCurrency: "EUR",
            unitText: "night",
          },
          itemOffered: {
            "@type": "HotelRoom",
            "@id": `${SITE_URL}/${locale}/quartos/${room.slug}#room`,
            name: room.name[locale],
            occupancy: { "@type": "QuantitativeValue", maxValue: room.capacity, unitText: "person" },
          },
        })),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: hotel.name,
        inLanguage: BCP47[locale],
        publisher: { "@id": HOTEL_ID },
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(data)} />;
}
