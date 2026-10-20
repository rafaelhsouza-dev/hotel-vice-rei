import { getHotel, getRooms, getSeo, type HotelSettings, type SeoSettings } from "@/lib/repo/content";
import { getBookingRules } from "@/lib/repo/rate-plans";
import type { BookingRules } from "@/lib/booking/rules";
import type { Room } from "@/data/hotel";

/**
 * One source of verified facts for everything machine-readable: llms.txt,
 * llms-full.txt and the JSON-LD graph. Values come from the admin-backed
 * getters (which fall back to the seed); the constants below are facts that
 * have no admin field yet and were checked against the official listings.
 *
 * Deliberately absent: parking, breakfast inclusion and distances — none of
 * them is verified, so nothing machine-readable claims them.
 */

export const STATIC_FACTS = {
  /** Official classification (Booking.com and Tripadvisor, verified 2026-08). */
  stars: 2,
  /** Name the property is registered under. */
  registeredName: "Albergaria Residência Vice-Rei",
  petsAllowed: false,
  cots: false,
  extraBeds: false,
  smokingAllowed: false,
} as const;

export type Rating = {
  id: "tripadvisor" | "booking" | "google";
  name: string;
  score: number;
  scale: 5 | 10;
  count: number | null;
  url: string;
};

const toNumber = (v: string): number | null => {
  const n = Number(String(v).replace(",", ".").trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/** Public scores that are actually set; an empty score hides the source. */
export function ratingsFrom(seo: SeoSettings, hotel: HotelSettings): Rating[] {
  const out: Rating[] = [];
  const push = (
    id: Rating["id"],
    name: string,
    score: string,
    count: string,
    scale: Rating["scale"],
    url: string,
  ) => {
    const s = toNumber(score);
    if (s == null || s > scale) return;
    const c = toNumber(count);
    out.push({ id, name, score: s, scale, count: c == null ? null : Math.round(c), url });
  };
  push("tripadvisor", "Tripadvisor", seo.tripadvisorScore, seo.tripadvisorCount, 5, seo.tripadvisorUrl || hotel.social.tripadvisor || "");
  push("booking", "Booking.com", seo.bookingScore, seo.bookingCount, 10, seo.bookingUrl);
  push("google", "Google", seo.googleScore, seo.googleCount, 5, seo.googleBusinessUrl);
  return out;
}

/** Social profiles and listings, for schema.org `sameAs`. */
export function sameAsFrom(seo: SeoSettings, hotel: HotelSettings): string[] {
  const urls = [
    hotel.social.facebook,
    hotel.social.instagram,
    hotel.social.tripadvisor,
    seo.tripadvisorUrl,
    seo.bookingUrl,
    seo.googleBusinessUrl,
  ].filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));
  return Array.from(new Set(urls));
}

/** "€43–€120" from the published room prices, or "€€" when there are none. */
export function priceRangeFrom(rooms: Room[]): string {
  const prices = rooms.map((r) => r.priceFrom).filter((p) => p > 0);
  if (!prices.length) return "€€";
  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));
  return min === max ? `€${min}` : `€${min}–€${max}`;
}

/** "15:00" → "15:00:00" (schema.org Time). */
export const schemaTime = (hhmm: string) => (/^\d{2}:\d{2}$/.test(hhmm) ? `${hhmm}:00` : hhmm);

/** "21:30" → "21h30", "12:00" → "12h" (Portuguese convention). */
export const ptTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return m && m !== "00" ? `${Number(h)}h${m}` : `${Number(h)}h`;
};

export type Facts = {
  hotel: HotelSettings;
  rooms: Room[];
  rules: BookingRules;
  seo: SeoSettings;
  ratings: Rating[];
  sameAs: string[];
  priceRange: string;
} & typeof STATIC_FACTS;

export async function getFacts(): Promise<Facts> {
  const [hotel, rooms, rules, seo] = await Promise.all([
    getHotel(),
    getRooms(),
    getBookingRules(),
    getSeo(),
  ]);
  return {
    ...STATIC_FACTS,
    hotel,
    rooms,
    rules,
    seo,
    ratings: ratingsFrom(seo, hotel),
    sameAs: sameAsFrom(seo, hotel),
    priceRange: priceRangeFrom(rooms),
  };
}

// --- llms.txt / llms-full.txt ----------------------------------------------

export type LlmsLang = "pt" | "en";

const decimalPt = (n: number) => n.toFixed(2).replace(".", ",");

const LL = {
  pt: {
    summary: (f: Facts) =>
      `Hotel de ${f.stars} estrelas no Porto (registado como ${f.registeredName}), com ${f.hotel.totalRooms} quartos na ${f.hotel.address.street}, ${f.hotel.address.postalCode} ${f.hotel.address.city}.`,
    facts: "Factos",
    name: "Nome",
    registered: "Nome registado",
    stars: "Classificação",
    starsValue: (n: number) => `${n} estrelas`,
    licence: "Licença",
    address: "Morada",
    coords: "Coordenadas",
    phone: "Telefone",
    email: "Email",
    rooms: "Número de quartos",
    languages: "Idiomas de atendimento",
    website: "Site oficial e reserva directa",
    policies: "Políticas",
    checkIn: (r: BookingRules) =>
      `Check-in: das ${ptTime(r.checkInFrom)} às ${ptTime(r.checkInUntil)}. Chegadas depois das ${ptTime(r.checkInUntil)} apenas com aviso prévio ao hotel.`,
    checkOut: (r: BookingRules) =>
      `Check-out: até às ${ptTime(r.checkOutUntil)}. Check-in antecipado e check-out tardio a pedido, sujeitos a disponibilidade.`,
    cancellation: "Cancelamento",
    pets: "Animais de estimação: não são aceites (excepto cães de assistência).",
    cots: "Berços e camas extra: não disponíveis.",
    children: (r: BookingRules) =>
      `Crianças: bem-vindas; contam para a capacidade máxima do quarto (no formulário de reserva, crianças dos 0 aos ${r.childMaxAge} anos).`,
    smoking: "Fumar: não é permitido nos quartos nem nas zonas interiores.",
    tax: (r: BookingRules) =>
      r.touristTax.enabled
        ? `Taxa municipal turística do Porto: ${decimalPt(r.touristTax.amount)} € por hóspede e por noite, até ${r.touristTax.maxNights} noites por estadia; isentos menores de ${r.touristTax.exemptUnderAge} anos. Paga no hotel.`
        : "Taxa municipal turística do Porto: aplicável nos termos definidos pelo município; paga no hotel.",
    howTo: "Como chegar",
    map: "Mapa",
    near: "Perto da Casa da Música, no Centro de Negócios do Porto.",
    metro: "Mapa da rede do Metro do Porto",
    nearby: "Pontos de interesse próximos",
    walk: (n: number) => `${n} min a pé`,
    roomsTitle: "Quartos",
    room: (size: number, cap: number, bed: string, price: number) =>
      `${size} m², até ${cap} pessoa(s), ${bed.toLowerCase()}. Desde ${decimalPt(price)} € por noite (preço de referência; varia com as datas).`,
    reviews: "Avaliações públicas",
    reviewsCount: (n: number) => `${n} avaliações`,
    contacts: "Contactos",
    pages: "Páginas",
    otherLangs: "O site existe em português (/pt), inglês (/en), espanhol (/es) e francês (/fr).",
    pageNames: {
      "": "Início",
      "/quartos": "Quartos",
      "/reservar": "Reservar (motor de reservas oficial)",
      "/promocoes": "Promoções",
      "/servicos": "Serviços",
      "/apresentacao": "Apresentação",
      "/galeria": "Galeria",
      "/contactos": "Contactos e mapa",
      "/blog": "Blog",
      "/cancelamento": "Política de cancelamento",
      "/privacidade": "Política de privacidade",
    } as Record<string, string>,
  },
  en: {
    summary: (f: Facts) =>
      `A ${f.stars}-star hotel in Porto, Portugal (registered as ${f.registeredName}), with ${f.hotel.totalRooms} rooms at ${f.hotel.address.street}, ${f.hotel.address.postalCode} ${f.hotel.address.city}.`,
    facts: "Facts",
    name: "Name",
    registered: "Registered name",
    stars: "Classification",
    starsValue: (n: number) => `${n} stars`,
    licence: "Licence",
    address: "Address",
    coords: "Coordinates",
    phone: "Phone",
    email: "Email",
    rooms: "Number of rooms",
    languages: "Languages spoken",
    website: "Official website and direct booking",
    policies: "Policies",
    checkIn: (r: BookingRules) =>
      `Check-in: from ${r.checkInFrom} to ${r.checkInUntil}. Arrivals after ${r.checkInUntil} only with prior notice to the hotel.`,
    checkOut: (r: BookingRules) =>
      `Check-out: by ${r.checkOutUntil}. Early check-in and late check-out on request, subject to availability.`,
    cancellation: "Cancellation",
    pets: "Pets: not allowed (assistance dogs excepted).",
    cots: "Cots and extra beds: not available.",
    children: (r: BookingRules) =>
      `Children: welcome; they count towards the maximum occupancy of the room (the booking form takes children aged 0 to ${r.childMaxAge}).`,
    smoking: "Smoking: not allowed in rooms or indoor areas.",
    tax: (r: BookingRules) =>
      r.touristTax.enabled
        ? `Porto municipal tourist tax: EUR ${r.touristTax.amount.toFixed(2)} per guest per night, up to ${r.touristTax.maxNights} nights per stay; guests under ${r.touristTax.exemptUnderAge} are exempt. Paid at the hotel.`
        : "Porto municipal tourist tax: charged under the rules of the city council; paid at the hotel.",
    howTo: "Getting there",
    map: "Map",
    near: "Close to Casa da Música, in the business district of Porto.",
    metro: "Porto Metro network map",
    nearby: "Places of interest nearby",
    walk: (n: number) => `${n} min walk`,
    roomsTitle: "Rooms",
    room: (size: number, cap: number, bed: string, price: number) =>
      `${size} m², up to ${cap} guest(s), ${bed.toLowerCase()}. From EUR ${price.toFixed(2)} per night (reference price; varies by date).`,
    reviews: "Public ratings",
    reviewsCount: (n: number) => `${n} reviews`,
    contacts: "Contact",
    pages: "Pages",
    otherLangs: "The site is available in Portuguese (/pt), English (/en), Spanish (/es) and French (/fr).",
    pageNames: {
      "": "Home",
      "/quartos": "Rooms",
      "/reservar": "Book (official booking engine)",
      "/promocoes": "Offers",
      "/servicos": "Services",
      "/apresentacao": "About",
      "/galeria": "Gallery",
      "/contactos": "Contact and map",
      "/blog": "Blog",
      "/cancelamento": "Cancellation policy",
      "/privacidade": "Privacy policy",
    } as Record<string, string>,
  },
};

export type LlmsExtras = {
  siteUrl: string;
  /** Short cancellation summary in this language (from the dictionary). */
  cancellationSummary: string;
  pois?: { name: string; walkMinutes: number | null; url: string }[];
};

export function llmsSummary(f: Facts, lang: LlmsLang): string {
  return LL[lang].summary(f);
}

/** Markdown lines for one language: facts, policies, access, rooms, reviews, contacts, pages. */
export function llmsCore(f: Facts, lang: LlmsLang, x: LlmsExtras): string[] {
  const t = LL[lang];
  const { hotel, rules } = f;
  const base = `${x.siteUrl}/${lang}`;
  const L: string[] = [];
  const address = `${hotel.address.street}, ${hotel.address.postalCode} ${hotel.address.city}, Portugal`;

  L.push(`## ${t.facts}`, "");
  L.push(`- ${t.name}: ${hotel.name}`);
  L.push(`- ${t.registered}: ${f.registeredName}`);
  L.push(`- ${t.stars}: ${t.starsValue(f.stars)}`);
  if (hotel.legal?.rnet) L.push(`- ${t.licence}: ${hotel.legal.rnet.replace(/^Licença\s*/i, "")}`);
  L.push(`- ${t.address}: ${address}`);
  L.push(`- ${t.coords}: ${hotel.coords.lat}, ${hotel.coords.lng}`);
  L.push(`- ${t.rooms}: ${hotel.totalRooms}`);
  L.push(`- ${t.languages}: ${hotel.languages[lang].join(", ")}`);
  L.push(`- ${t.website}: ${base}/reservar`);

  L.push("", `## ${t.policies}`, "");
  L.push(`- ${t.checkIn(rules)}`);
  L.push(`- ${t.checkOut(rules)}`);
  L.push(`- ${t.cancellation}: ${x.cancellationSummary} (${base}/cancelamento)`);
  L.push(`- ${t.pets}`);
  L.push(`- ${t.cots}`);
  L.push(`- ${t.children(rules)}`);
  L.push(`- ${t.smoking}`);
  L.push(`- ${t.tax(rules)}`);

  L.push("", `## ${t.howTo}`, "");
  L.push(`- ${t.address}: ${address}`);
  L.push(`- ${t.near}`);
  L.push(
    `- ${t.map}: https://www.openstreetmap.org/?mlat=${hotel.coords.lat}&mlon=${hotel.coords.lng}#map=17/${hotel.coords.lat}/${hotel.coords.lng}`,
  );
  L.push(`- ${t.metro}: https://www.metrodoporto.pt/uploads/document/file/47/MetroPorto.pdf`);
  if (x.pois?.length) {
    L.push(`- ${t.nearby}:`);
    for (const p of x.pois) {
      const walk = p.walkMinutes != null ? ` (${t.walk(p.walkMinutes)})` : "";
      L.push(`  - ${p.url ? `[${p.name}](${p.url})` : p.name}${walk}`);
    }
  }

  L.push("", `## ${t.roomsTitle}`, "");
  for (const room of f.rooms) {
    L.push(
      `- [${room.name[lang]}](${base}/quartos/${room.slug}): ${t.room(room.size, room.capacity, room.bed[lang], room.priceFrom)}`,
    );
  }

  if (f.ratings.length) {
    L.push("", `## ${t.reviews}`, "");
    for (const r of f.ratings) {
      const score = lang === "pt" ? r.score.toFixed(1).replace(".", ",") : r.score.toFixed(1);
      const count = r.count != null ? ` (${t.reviewsCount(r.count)})` : "";
      L.push(`- ${r.url ? `[${r.name}](${r.url})` : r.name}: ${score}/${r.scale}${count}`);
    }
  }

  L.push("", `## ${t.contacts}`, "");
  for (const p of hotel.phones) L.push(`- ${t.phone}: ${p}`);
  L.push(`- ${t.email}: ${hotel.email}`);
  L.push(`- ${t.address}: ${address}`);

  L.push("", `## ${t.pages}`, "");
  for (const [path, label] of Object.entries(t.pageNames)) L.push(`- [${label}](${base}${path})`);
  L.push("", t.otherLangs);
  return L;
}
