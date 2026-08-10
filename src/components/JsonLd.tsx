import type { HotelSettings } from "@/lib/repo/content";
import type { Room } from "@/data/hotel";
import type { Locale } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";

/**
 * Schema.org graph for the hotel.
 *
 * Emitted as a single `@graph` so the Hotel, its address/geo, the room
 * catalogue and the organisation all resolve to one another by @id — search
 * engines and answer engines read the whole entity in one pass.
 */
export function JsonLd({
  hotel,
  rooms,
  locale,
}: {
  hotel: HotelSettings;
  rooms: Room[];
  locale: Locale;
}) {
  const hotelId = `${SITE_URL}/#hotel`;
  const minPrice = rooms.length
    ? Math.min(...rooms.map((r) => r.priceFrom))
    : undefined;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Hotel", "LodgingBusiness", "LocalBusiness"],
        "@id": hotelId,
        name: hotel.name,
        url: `${SITE_URL}/${locale}`,
        description: hotel.brandTagline[locale],
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
        hasMap: `https://www.openstreetmap.org/?mlat=${hotel.coords.lat}&mlon=${hotel.coords.lng}`,
        image: `${SITE_URL}/images/hero/home.webp`,
        logo: `${SITE_URL}/logo-hotel-vice-rei.png`,
        priceRange: minPrice ? `€${minPrice}–€150` : undefined,
        currenciesAccepted: "EUR",
        paymentAccepted: hotel.paymentMethods.join(", "),
        // Official classification: 2 stars (Booking.com and Tripadvisor).
        starRating: { "@type": "Rating", ratingValue: "2" },
        numberOfRooms: hotel.totalRooms,
        availableLanguage: hotel.languages.en,
        checkinTime: "15:00",
        checkoutTime: "12:00",
        petsAllowed: false,
        // No aggregateRating until the real Google reviews are connected:
        // publishing placeholder scores as structured data would be a false
        // claim to search engines, and is the kind of thing that earns a
        // manual action. The figures still show in the page for the demo.
        amenityFeature: [
          "Free Wi-Fi",
          "24h reception",
          "Breakfast included",
          "Air conditioning",
          "Covered garage",
          "Luggage storage",
        ].map((name) => ({
          "@type": "LocationFeatureSpecification",
          name,
          value: true,
        })),
        sameAs: [
          hotel.social.facebook,
          hotel.social.instagram,
          hotel.social.tripadvisor,
        ].filter(Boolean),
        makesOffer: rooms.map((room) => ({
          "@type": "Offer",
          name: room.name[locale],
          url: `${SITE_URL}/${locale}/quartos/${room.slug}`,
          price: room.priceFrom,
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          itemOffered: {
            "@type": "HotelRoom",
            name: room.name[locale],
            description: room.shortDescription[locale],
            occupancy: {
              "@type": "QuantitativeValue",
              maxValue: room.capacity,
              unitText: "person",
            },
            floorSize: {
              "@type": "QuantitativeValue",
              value: room.size,
              unitCode: "MTK",
            },
          },
        })),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: hotel.name,
        inLanguage: locale,
        publisher: { "@id": hotelId },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Values come from our own database, and JSON.stringify escapes them.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
