import { hotel, rooms } from "@/data/hotel";

/** Schema.org Hotel structured data for SEO (rich results). */
export function JsonLd() {
  const minPrice = Math.min(...rooms.map((r) => r.priceFrom));
  const data = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: hotel.name,
    url: "https://www.hotelvicerei.com",
    email: hotel.email,
    telephone: hotel.phones[0],
    address: {
      "@type": "PostalAddress",
      streetAddress: hotel.address.street,
      postalCode: hotel.address.postalCode,
      addressLocality: hotel.address.city,
      addressCountry: "PT",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: hotel.coords.lat,
      longitude: hotel.coords.lng,
    },
    image: "https://www.hotelvicerei.com/images/hero/hero-main.jpg",
    priceRange: `€${minPrice}+`,
    starRating: { "@type": "Rating", ratingValue: "3" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: hotel.rating.score,
      reviewCount: hotel.rating.count,
    },
    sameAs: [
      hotel.social.facebook,
      hotel.social.instagram,
      hotel.social.tripadvisor,
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
