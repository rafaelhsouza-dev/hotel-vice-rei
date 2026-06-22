import type { Locale } from "@/i18n/config";

type Trio<T> = Record<Locale, T>;

export type Room = {
  id: string;
  slug: string;
  image: string;
  gallery: string[];
  capacity: number;
  size: number;
  bed: Trio<string>;
  bathroom: Trio<string>;
  priceFrom: number;
  name: Trio<string>;
  shortDescription: Trio<string>;
  longDescription: Trio<string[]>;
  amenities: Trio<string[]>;
  romantic?: boolean;
  /** Equirectangular 360º photo for the room's immersive viewer.
   *  When omitted, the viewer falls back to the demo panorama. */
  panorama360?: string;
};

export type Service = {
  id: string;
  icon: ServiceIcon;
  title: Trio<string>;
  description: Trio<string>;
};

export type Offer = {
  id: string;
  slug: string;
  image: string;
  badge: Trio<string>;
  title: Trio<string>;
  description: Trio<string>;
  priceFrom: number;
  priceLabel: Trio<string>;
  includes: Trio<string[]>;
  conditions: Trio<string[]>;
};

export type Testimonial = {
  id: string;
  author: string;
  origin: Trio<string>;
  quote: Trio<string>;
  rating: number;
};

export type ServiceIcon =
  | "wifi"
  | "breakfast"
  | "parking"
  | "concierge"
  | "ac"
  | "tv"
  | "reception24"
  | "laundry"
  | "tours"
  | "bar"
  | "safe"
  | "elevator"
  | "phone"
  | "globe"
  | "users"
  | "calendar"
  | "shield"
  | "bed";

export const hotel = {
  name: "Hotel Vice-Rei",
  totalRooms: 55,
  brandTagline: {
    pt: "Elegância, conforto, ambiente acolhedor e qualidade",
    en: "Elegance, comfort, warm atmosphere and quality",
    es: "Elegancia, confort, ambiente acogedor y calidad",
    fr: "Élégance, confort, ambiance chaleureuse et qualité",
  } satisfies Trio<string>,
  address: {
    street: "Rua Júlio Dinis, 779",
    postalCode: "4050-326",
    city: "Porto",
    country: {
      pt: "Portugal",
      en: "Portugal",
      es: "Portugal",
      fr: "Portugal",
    } satisfies Trio<string>,
  },
  phones: ["+351 225 430 120", "+351 225 430 128"],
  email: "geral@hotelvicerei.com",
  social: {
    facebook: "https://www.facebook.com/HotelViceRei",
    instagram: "https://www.instagram.com/hotelvicerei",
  },
  coords: { lat: 41.158, lng: -8.628 },
  legal: {
    complaintsBook: "https://www.livroreclamacoes.pt/Inicio/",
    cleanSafe: "https://portugalcleanandsafe.pt/pt",
    copyrightYear: 2016,
  },
  paymentMethods: ["Visa", "Mastercard", "American Express", "Diners"],
  languages: {
    pt: ["Português", "Inglês", "Espanhol", "Francês", "Italiano"],
    en: ["Portuguese", "English", "Spanish", "French", "Italian"],
    es: ["Portugués", "Inglés", "Español", "Francés", "Italiano"],
    fr: ["Portugais", "Anglais", "Espagnol", "Français", "Italien"],
  } satisfies Trio<string[]>,
};

export const rooms: Room[] = [
  {
    id: "single",
    slug: "single",
    image: "/images/rooms/room-single.jpg",
    gallery: [
      "/images/rooms/room-single.jpg",
      "/images/rooms/room-detail.jpg",
    ],
    capacity: 1,
    size: 14,
    bed: {
      pt: "Cama single ou de casal",
      en: "Single or double bed",
      es: "Cama individual o de matrimonio",
      fr: "Lit simple ou double",
    },
    bathroom: {
      pt: "Casa de banho privada com duche",
      en: "Private bathroom with shower",
      es: "Baño privado con ducha",
      fr: "Salle de bain privative avec douche",
    },
    priceFrom: 42.95,
    name: {
      pt: "Single",
      en: "Single",
      es: "Individual",
      fr: "Simple",
    },
    shortDescription: {
      pt: "Quarto compacto e funcional com cama single ou de casal, ideal para viagens a solo.",
      en: "Compact, functional room with single or double bed — ideal for solo travellers.",
      es: "Habitación compacta y funcional con cama individual o de matrimonio, ideal para viajes en solitario.",
      fr: "Chambre compacte et fonctionnelle avec lit simple ou double, idéale pour les voyages en solo.",
    },
    longDescription: {
      pt: [
        "Quarto pensado para o viajante a solo, com cama single ou de casal à escolha e casa de banho privada com duche. Pequeno-almoço incluído na tarifa.",
        "Inclui ar condicionado, TV por cabo, Wi-Fi gratuito e telefone com acesso directo ao exterior. Atendimento personalizado em vários idiomas.",
      ],
      en: [
        "A room designed for the solo traveller, with single or double bed available and a private bathroom with shower. Breakfast included in the rate.",
        "Includes air conditioning, cable TV, free Wi-Fi and direct-dial telephone. Personal service in multiple languages.",
      ],
      es: [
        "Habitación pensada para el viajero en solitario, con cama individual o de matrimonio a elegir y baño privado con ducha. Desayuno incluido en la tarifa.",
        "Incluye aire acondicionado, TV por cable, Wi-Fi gratuito y teléfono con línea directa. Atención personalizada en varios idiomas.",
      ],
      fr: [
        "Chambre pensée pour le voyageur en solo, avec lit simple ou double au choix et salle de bain privative avec douche. Petit-déjeuner inclus dans le tarif.",
        "Comprend la climatisation, la TV par câble, le Wi-Fi gratuit et un téléphone avec ligne directe vers l'extérieur. Service personnalisé en plusieurs langues.",
      ],
    },
    amenities: {
      pt: [
        "Pequeno-almoço incluído",
        "Ar condicionado",
        "TV por cabo",
        "Wi-Fi gratuito",
        "Telefone com acesso directo",
        "Casa de banho privada com duche",
      ],
      en: [
        "Breakfast included",
        "Air conditioning",
        "Cable TV",
        "Free Wi-Fi",
        "Direct-dial telephone",
        "Private bathroom with shower",
      ],
      es: [
        "Desayuno incluido",
        "Aire acondicionado",
        "TV por cable",
        "Wi-Fi gratuito",
        "Teléfono con línea directa",
        "Baño privado con ducha",
      ],
      fr: [
        "Petit-déjeuner inclus",
        "Climatisation",
        "TV par câble",
        "Wi-Fi gratuit",
        "Téléphone avec ligne directe",
        "Salle de bain privative avec douche",
      ],
    },
  },
  {
    id: "single-superior",
    slug: "single-superior",
    image: "/images/rooms/room-superior.jpg",
    gallery: [
      "/images/rooms/room-superior.jpg",
      "/images/rooms/room-detail.jpg",
    ],
    capacity: 1,
    size: 16,
    bed: {
      pt: "Cama de casal",
      en: "Double bed",
      es: "Cama de matrimonio",
      fr: "Lit double",
    },
    bathroom: {
      pt: "Casa de banho privada com banheira",
      en: "Private bathroom with bathtub",
      es: "Baño privado con bañera",
      fr: "Salle de bain privative avec baignoire",
    },
    priceFrom: 45.95,
    name: {
      pt: "Single Superior",
      en: "Superior Single",
      es: "Individual Superior",
      fr: "Simple Supérieure",
    },
    shortDescription: {
      pt: "Versão superior do single com cama de casal e casa de banho com banheira.",
      en: "Superior version of the single with double bed and bathroom with tub.",
      es: "Versión superior de la individual, con cama de matrimonio y baño con bañera.",
      fr: "Version supérieure de la simple, avec lit double et salle de bain avec baignoire.",
    },
    longDescription: {
      pt: [
        "Quarto single superior com cama de casal e casa de banho privada equipada com banheira. Ideal para quem quer mais espaço e comodidades adicionais numa estadia individual.",
        "Pequeno-almoço incluído, ar condicionado, TV por cabo, Wi-Fi gratuito. Possibilidade de pequeno-almoço servido no quarto.",
      ],
      en: [
        "Superior single room with a double bed and a private bathroom with bathtub. Ideal if you want more space and added comfort on a solo stay.",
        "Breakfast included, air conditioning, cable TV, free Wi-Fi. Breakfast can also be served in the room on request.",
      ],
      es: [
        "Habitación individual superior con cama de matrimonio y baño privado con bañera. Ideal para quien quiere más espacio y comodidades en una estancia individual.",
        "Desayuno incluido, aire acondicionado, TV por cable, Wi-Fi gratuito. Posibilidad de desayuno servido en la habitación.",
      ],
      fr: [
        "Chambre simple supérieure avec lit double et salle de bain privative équipée d'une baignoire. Idéale pour ceux qui souhaitent plus d'espace et de commodités lors d'un séjour individuel.",
        "Petit-déjeuner inclus, climatisation, TV par câble, Wi-Fi gratuit. Possibilité de petit-déjeuner servi en chambre.",
      ],
    },
    amenities: {
      pt: [
        "Pequeno-almoço incluído (no quarto opcional)",
        "Ar condicionado",
        "TV por cabo",
        "Wi-Fi gratuito",
        "Telefone com acesso directo",
        "Casa de banho privada com banheira",
      ],
      en: [
        "Breakfast included (in-room optional)",
        "Air conditioning",
        "Cable TV",
        "Free Wi-Fi",
        "Direct-dial telephone",
        "Private bathroom with bathtub",
      ],
      es: [
        "Desayuno incluido (en habitación opcional)",
        "Aire acondicionado",
        "TV por cable",
        "Wi-Fi gratuito",
        "Teléfono con línea directa",
        "Baño privado con bañera",
      ],
      fr: [
        "Petit-déjeuner inclus (en chambre en option)",
        "Climatisation",
        "TV par câble",
        "Wi-Fi gratuit",
        "Téléphone avec ligne directe",
        "Salle de bain privative avec baignoire",
      ],
    },
  },
  {
    id: "twin-double",
    slug: "twin-duplo",
    image: "/images/rooms/room-twin.jpg",
    gallery: [
      "/images/rooms/room-twin.jpg",
      "/images/rooms/room-double.jpg",
    ],
    capacity: 2,
    size: 20,
    bed: {
      pt: "2 camas single juntas ou separadas",
      en: "2 single beds together or apart",
      es: "2 camas individuales juntas o separadas",
      fr: "2 lits simples joints ou séparés",
    },
    bathroom: {
      pt: "Casa de banho privada com duche",
      en: "Private bathroom with shower",
      es: "Baño privado con ducha",
      fr: "Salle de bain privative avec douche",
    },
    priceFrom: 50.2,
    name: {
      pt: "Twin / Duplo",
      en: "Twin / Double",
      es: "Twin / Doble",
      fr: "Twin / Double",
    },
    shortDescription: {
      pt: "Duas camas single que podem ser juntas ou separadas, à escolha do hóspede.",
      en: "Two single beds that can be placed together or apart, your choice.",
      es: "Dos camas individuales que pueden ir juntas o separadas, a elección del huésped.",
      fr: "Deux lits simples pouvant être joints ou séparés, au choix du client.",
    },
    longDescription: {
      pt: [
        "Quarto twin/duplo com duas camas single que podem ser juntas (para casal) ou separadas (para amigos ou colegas de viagem). Casa de banho privada com duche.",
        "Pequeno-almoço incluído na tarifa, ar condicionado individual, TV por cabo, Wi-Fi gratuito, telefone com acesso directo ao exterior.",
      ],
      en: [
        "Twin/double room with two single beds that can be placed together (for couples) or apart (for friends or work colleagues). Private bathroom with shower.",
        "Breakfast included, individual air conditioning, cable TV, free Wi-Fi and direct-dial telephone.",
      ],
      es: [
        "Habitación twin/doble con dos camas individuales que pueden colocarse juntas (para parejas) o separadas (para amigos o compañeros). Baño privado con ducha.",
        "Desayuno incluido, aire acondicionado individual, TV por cable, Wi-Fi gratuito y teléfono con línea directa.",
      ],
      fr: [
        "Chambre twin/double avec deux lits simples pouvant être joints (pour les couples) ou séparés (pour des amis ou des collègues de voyage). Salle de bain privative avec douche.",
        "Petit-déjeuner inclus, climatisation individuelle, TV par câble, Wi-Fi gratuit et téléphone avec ligne directe vers l'extérieur.",
      ],
    },
    amenities: {
      pt: [
        "Pequeno-almoço incluído",
        "Ar condicionado",
        "TV por cabo",
        "Wi-Fi gratuito",
        "Telefone com acesso directo",
        "Camas configuráveis",
        "Casa de banho privada com duche",
      ],
      en: [
        "Breakfast included",
        "Air conditioning",
        "Cable TV",
        "Free Wi-Fi",
        "Direct-dial telephone",
        "Configurable beds",
        "Private bathroom with shower",
      ],
      es: [
        "Desayuno incluido",
        "Aire acondicionado",
        "TV por cable",
        "Wi-Fi gratuito",
        "Teléfono con línea directa",
        "Camas configurables",
        "Baño privado con ducha",
      ],
      fr: [
        "Petit-déjeuner inclus",
        "Climatisation",
        "TV par câble",
        "Wi-Fi gratuit",
        "Téléphone avec ligne directe",
        "Lits configurables",
        "Salle de bain privative avec douche",
      ],
    },
  },
  {
    id: "twin-double-superior",
    slug: "twin-duplo-superior",
    image: "/images/rooms/room-double.jpg",
    gallery: [
      "/images/rooms/room-double.jpg",
      "/images/rooms/room-twin.jpg",
      "/images/rooms/room-detail.jpg",
    ],
    capacity: 2,
    size: 22,
    bed: {
      pt: "2 camas single juntas ou separadas",
      en: "2 single beds together or apart",
      es: "2 camas individuales juntas o separadas",
      fr: "2 lits simples joints ou séparés",
    },
    bathroom: {
      pt: "Casa de banho privada com banheira",
      en: "Private bathroom with bathtub",
      es: "Baño privado con bañera",
      fr: "Salle de bain privative avec baignoire",
    },
    priceFrom: 55.9,
    name: {
      pt: "Twin / Duplo Superior",
      en: "Superior Twin / Double",
      es: "Twin / Doble Superior",
      fr: "Twin / Double Supérieure",
    },
    shortDescription: {
      pt: "A versão superior do twin/duplo, com casa de banho com banheira.",
      en: "Superior twin/double room with bathtub bathroom.",
      es: "Versión superior del twin/doble, con baño y bañera.",
      fr: "La version supérieure de la twin/double, avec salle de bain à baignoire.",
    },
    longDescription: {
      pt: [
        "Twin/duplo superior, com mais área que a categoria standard e casa de banho privada com banheira. Camas configuráveis em casal ou separadas.",
        "Inclui pequeno-almoço (com opção no quarto), ar condicionado, TV por cabo, Wi-Fi gratuito e telefone com acesso directo ao exterior.",
      ],
      en: [
        "Superior twin/double, with more space than the standard category and a private bathroom with bathtub. Beds configurable as a couple or separately.",
        "Includes breakfast (in-room option available), air conditioning, cable TV, free Wi-Fi and direct-dial telephone.",
      ],
      es: [
        "Twin/doble superior, con más superficie que la categoría estándar y baño privado con bañera. Camas configurables.",
        "Incluye desayuno (opcionalmente servido en la habitación), aire acondicionado, TV por cable, Wi-Fi gratuito y teléfono con línea directa.",
      ],
      fr: [
        "Twin/double supérieure, plus spacieuse que la catégorie standard et dotée d'une salle de bain privative avec baignoire. Lits configurables en couple ou séparés.",
        "Comprend le petit-déjeuner (option en chambre disponible), la climatisation, la TV par câble, le Wi-Fi gratuit et un téléphone avec ligne directe vers l'extérieur.",
      ],
    },
    amenities: {
      pt: [
        "Pequeno-almoço incluído (no quarto opcional)",
        "Ar condicionado",
        "TV por cabo",
        "Wi-Fi gratuito",
        "Telefone com acesso directo",
        "Camas configuráveis",
        "Casa de banho privada com banheira",
      ],
      en: [
        "Breakfast included (in-room optional)",
        "Air conditioning",
        "Cable TV",
        "Free Wi-Fi",
        "Direct-dial telephone",
        "Configurable beds",
        "Private bathroom with bathtub",
      ],
      es: [
        "Desayuno incluido (en habitación opcional)",
        "Aire acondicionado",
        "TV por cable",
        "Wi-Fi gratuito",
        "Teléfono con línea directa",
        "Camas configurables",
        "Baño privado con bañera",
      ],
      fr: [
        "Petit-déjeuner inclus (en chambre en option)",
        "Climatisation",
        "TV par câble",
        "Wi-Fi gratuit",
        "Téléphone avec ligne directe",
        "Lits configurables",
        "Salle de bain privative avec baignoire",
      ],
    },
  },
  {
    id: "triple",
    slug: "triplo",
    image: "/images/rooms/room-triple.jpg",
    gallery: [
      "/images/rooms/room-triple.jpg",
      "/images/rooms/room-superior.jpg",
      "/images/rooms/hotel-interior.jpg",
    ],
    capacity: 3,
    size: 26,
    bed: {
      pt: "2 camas single + 1 cama extra",
      en: "2 single beds + 1 extra bed",
      es: "2 camas individuales + 1 cama extra",
      fr: "2 lits simples + 1 lit d'appoint",
    },
    bathroom: {
      pt: "Casa de banho privada com banheira",
      en: "Private bathroom with bathtub",
      es: "Baño privado con bañera",
      fr: "Salle de bain privative avec baignoire",
    },
    priceFrom: 62.2,
    name: {
      pt: "Triplo",
      en: "Triple",
      es: "Triple",
      fr: "Triple",
    },
    shortDescription: {
      pt: "Quarto amplo com duas camas single e cama extra, perfeito para famílias ou amigos.",
      en: "Spacious room with two single beds and an extra bed — perfect for families or friends.",
      es: "Habitación amplia con dos camas individuales y cama extra, ideal para familias o amigos.",
      fr: "Chambre spacieuse avec deux lits simples et un lit d'appoint, parfaite pour les familles ou les amis.",
    },
    longDescription: {
      pt: [
        "Quarto triplo amplo com duas camas single e uma cama extra, casa de banho privada com banheira. Pensado para famílias ou grupos de amigos que viajam juntos.",
        "Pequeno-almoço incluído, ar condicionado, TV por cabo, Wi-Fi gratuito e telefone com acesso directo ao exterior.",
      ],
      en: [
        "Spacious triple room with two single beds and an extra bed, private bathroom with bathtub. Designed for families or groups of friends travelling together.",
        "Breakfast included, air conditioning, cable TV, free Wi-Fi and direct-dial telephone.",
      ],
      es: [
        "Habitación triple amplia con dos camas individuales y una cama extra, baño privado con bañera. Pensada para familias o grupos de amigos.",
        "Desayuno incluido, aire acondicionado, TV por cable, Wi-Fi gratuito y teléfono con línea directa.",
      ],
      fr: [
        "Chambre triple spacieuse avec deux lits simples et un lit d'appoint, salle de bain privative avec baignoire. Pensée pour les familles ou les groupes d'amis voyageant ensemble.",
        "Petit-déjeuner inclus, climatisation, TV par câble, Wi-Fi gratuit et téléphone avec ligne directe vers l'extérieur.",
      ],
    },
    amenities: {
      pt: [
        "Pequeno-almoço incluído",
        "Ar condicionado",
        "TV por cabo",
        "Wi-Fi gratuito",
        "Telefone com acesso directo",
        "3 camas (2 single + extra)",
        "Casa de banho privada com banheira",
      ],
      en: [
        "Breakfast included",
        "Air conditioning",
        "Cable TV",
        "Free Wi-Fi",
        "Direct-dial telephone",
        "3 beds (2 single + extra)",
        "Private bathroom with bathtub",
      ],
      es: [
        "Desayuno incluido",
        "Aire acondicionado",
        "TV por cable",
        "Wi-Fi gratuito",
        "Teléfono con línea directa",
        "3 camas (2 individuales + extra)",
        "Baño privado con bañera",
      ],
      fr: [
        "Petit-déjeuner inclus",
        "Climatisation",
        "TV par câble",
        "Wi-Fi gratuit",
        "Téléphone avec ligne directe",
        "3 lits (2 simples + appoint)",
        "Salle de bain privative avec baignoire",
      ],
    },
  },
  {
    id: "romantic",
    slug: "romantico",
    image: "/images/rooms/room-romantic.jpg",
    gallery: [
      "/images/rooms/room-romantic.jpg",
      "/images/rooms/room-double.jpg",
      "/images/rooms/room-superior.jpg",
    ],
    capacity: 2,
    size: 22,
    bed: {
      pt: "Cama de casal",
      en: "Double bed",
      es: "Cama de matrimonio",
      fr: "Lit double",
    },
    bathroom: {
      pt: "Casa de banho privada com duche",
      en: "Private bathroom with shower",
      es: "Baño privado con ducha",
      fr: "Salle de bain privative avec douche",
    },
    priceFrom: 60,
    romantic: true,
    name: {
      pt: "Romântico",
      en: "Romantic",
      es: "Romántica",
      fr: "Romantique",
    },
    shortDescription: {
      pt: "Estadia especial com vinho espumante, pequeno-almoço no quarto e late check-out.",
      en: "A special stay with sparkling wine, in-room breakfast and late check-out.",
      es: "Estancia especial con vino espumoso, desayuno en habitación y late check-out.",
      fr: "Séjour spécial avec vin mousseux, petit-déjeuner en chambre et départ tardif.",
    },
    longDescription: {
      pt: [
        "Pacote romântico em quarto com cama de casal e casa de banho privada com duche. Pensado para celebrações, ofertas e fugas a dois.",
        "Inclui bebida de boas-vindas à chegada, pequeno-almoço servido no quarto, uma garrafa de vinho espumante e check-out até às 14h.",
      ],
      en: [
        "Romantic package in a room with double bed and private shower bathroom. Designed for celebrations, gifts and a two-person getaway.",
        "Includes welcome drink on arrival, breakfast served in the room, one bottle of sparkling wine and check-out until 2pm.",
      ],
      es: [
        "Paquete romántico en habitación con cama de matrimonio y baño privado con ducha. Pensado para celebraciones, regalos y escapadas en pareja.",
        "Incluye bebida de bienvenida a la llegada, desayuno servido en la habitación, una botella de vino espumoso y salida hasta las 14h.",
      ],
      fr: [
        "Forfait romantique en chambre avec lit double et salle de bain privative avec douche. Pensé pour les célébrations, les cadeaux et les escapades à deux.",
        "Comprend une boisson de bienvenue à l'arrivée, un petit-déjeuner servi en chambre, une bouteille de vin mousseux et un départ jusqu'à 14h.",
      ],
    },
    amenities: {
      pt: [
        "Bebida de boas-vindas",
        "Pequeno-almoço servido no quarto",
        "1 garrafa de vinho espumante",
        "Check-out até às 14h",
        "Cama de casal",
        "Casa de banho privada com duche",
        "Ar condicionado",
        "TV por cabo",
        "Wi-Fi gratuito",
      ],
      en: [
        "Welcome drink",
        "Breakfast served in the room",
        "1 bottle of sparkling wine",
        "Check-out until 2pm",
        "Double bed",
        "Private bathroom with shower",
        "Air conditioning",
        "Cable TV",
        "Free Wi-Fi",
      ],
      es: [
        "Bebida de bienvenida",
        "Desayuno servido en la habitación",
        "1 botella de vino espumoso",
        "Salida hasta las 14h",
        "Cama de matrimonio",
        "Baño privado con ducha",
        "Aire acondicionado",
        "TV por cable",
        "Wi-Fi gratuito",
      ],
      fr: [
        "Boisson de bienvenue",
        "Petit-déjeuner servi en chambre",
        "1 bouteille de vin mousseux",
        "Départ jusqu'à 14h",
        "Lit double",
        "Salle de bain privative avec douche",
        "Climatisation",
        "TV par câble",
        "Wi-Fi gratuit",
      ],
    },
  },
];

export const services: Service[] = [
  {
    id: "rooms-count",
    icon: "bed",
    title: {
      pt: "55 Quartos",
      en: "55 Rooms",
      es: "55 Habitaciones",
      fr: "55 Chambres",
    },
    description: {
      pt: "Os quartos dividem-se em individuais, duplos, twin e triplos.",
      en: "Rooms come as single, double, twin and triple.",
      es: "Las habitaciones se dividen en individuales, dobles, twin y triples.",
      fr: "Les chambres se déclinent en simples, doubles, twin et triples.",
    },
  },
  {
    id: "wifi",
    icon: "wifi",
    title: {
      pt: "Wi-Fi grátis",
      en: "Free Wi-Fi",
      es: "Wi-Fi gratuito",
      fr: "Wi-Fi gratuit",
    },
    description: {
      pt: "O hotel dispõe de uma sala comum com Wi-Fi grátis e TV por cabo.",
      en: "The hotel has a common room with free Wi-Fi and cable TV.",
      es: "El hotel dispone de sala común con Wi-Fi gratuito y TV por cable.",
      fr: "L'hôtel dispose d'une salle commune avec Wi-Fi gratuit et TV par câble.",
    },
  },
  {
    id: "payment",
    icon: "shield",
    title: {
      pt: "Pagamento",
      en: "Payment",
      es: "Pago",
      fr: "Paiement",
    },
    description: {
      pt: "Pagamento com cartões de crédito Visa, American Express, Mastercard, Diners, etc.",
      en: "Payment with credit cards: Visa, American Express, Mastercard, Diners and more.",
      es: "Pago con tarjetas de crédito Visa, American Express, Mastercard, Diners, etc.",
      fr: "Paiement par cartes de crédit Visa, American Express, Mastercard, Diners, etc.",
    },
  },
  {
    id: "breakfast",
    icon: "breakfast",
    title: {
      pt: "Pequeno-almoço",
      en: "Breakfast",
      es: "Desayuno",
      fr: "Petit-déjeuner",
    },
    description: {
      pt: "Pequeno-almoço continental com possibilidade de ser servido no quarto.",
      en: "Continental breakfast, with in-room service available on request.",
      es: "Desayuno continental, con posibilidad de servirse en la habitación.",
      fr: "Petit-déjeuner continental, avec possibilité d'être servi en chambre.",
    },
  },
  {
    id: "languages",
    icon: "globe",
    title: {
      pt: "Vários idiomas",
      en: "Multilingual",
      es: "Varios idiomas",
      fr: "Plusieurs langues",
    },
    description: {
      pt: "Atendimento em diferentes idiomas: Inglês, Espanhol, Francês e Italiano.",
      en: "Service in several languages: English, Spanish, French and Italian.",
      es: "Atención en distintos idiomas: inglés, español, francés e italiano.",
      fr: "Service en différentes langues : anglais, espagnol, français et italien.",
    },
  },
  {
    id: "reception",
    icon: "reception24",
    title: {
      pt: "Recepção 24h",
      en: "24h reception",
      es: "Recepción 24h",
      fr: "Réception 24h",
    },
    description: {
      pt: "Recepção em funcionamento permanente e serviço de despertar.",
      en: "Reception open around the clock, with wake-up service.",
      es: "Recepción abierta las 24 horas y servicio de despertar.",
      fr: "Réception ouverte en permanence et service de réveil.",
    },
  },
  {
    id: "communications",
    icon: "phone",
    title: {
      pt: "Comunicações",
      en: "Communications",
      es: "Comunicaciones",
      fr: "Communications",
    },
    description: {
      pt: "Telefone com acesso directo ao exterior, fax e fotocopiadora.",
      en: "Direct-dial telephone, fax and photocopier available.",
      es: "Teléfono con línea directa al exterior, fax y fotocopiadora.",
      fr: "Téléphone avec ligne directe vers l'extérieur, fax et photocopieuse.",
    },
  },
  {
    id: "luggage",
    icon: "users",
    title: {
      pt: "Bagagem",
      en: "Luggage",
      es: "Equipaje",
      fr: "Bagages",
    },
    description: {
      pt: "Os hóspedes têm à disposição uma sala para guardar a bagagem.",
      en: "Guests have a dedicated luggage storage room.",
      es: "Los huéspedes disponen de una sala para guardar el equipaje.",
      fr: "Les clients disposent d'une salle pour ranger leurs bagages.",
    },
  },
  {
    id: "other",
    icon: "safe",
    title: {
      pt: "Outros serviços",
      en: "Other services",
      es: "Otros servicios",
      fr: "Autres services",
    },
    description: {
      pt: "Cofre na recepção, lavandaria, engomadoria e garagem coberta.",
      en: "Safe at reception, laundry, ironing and covered garage.",
      es: "Caja fuerte en recepción, lavandería, planchado y garaje cubierto.",
      fr: "Coffre-fort à la réception, blanchisserie, repassage et garage couvert.",
    },
  },
  {
    id: "tourism",
    icon: "tours",
    title: {
      pt: "Turismo",
      en: "Tourism",
      es: "Turismo",
      fr: "Tourisme",
    },
    description: {
      pt: "Fornecemos o mapa da cidade do Porto e outras informações turísticas.",
      en: "We provide a Porto city map and other tourist information.",
      es: "Proporcionamos el mapa de la ciudad de Oporto e información turística.",
      fr: "Nous fournissons le plan de la ville de Porto et d'autres informations touristiques.",
    },
  },
  {
    id: "transport",
    icon: "calendar",
    title: {
      pt: "Transportes",
      en: "Transport",
      es: "Transporte",
      fr: "Transports",
    },
    description: {
      pt: "Serviço de aluguer de automóveis, bicicletas e motociclos.",
      en: "Car, bicycle and motorcycle rental service.",
      es: "Servicio de alquiler de automóviles, bicicletas y motocicletas.",
      fr: "Service de location de voitures, vélos et motos.",
    },
  },
  {
    id: "bookings",
    icon: "concierge",
    title: {
      pt: "Reservas",
      en: "Bookings",
      es: "Reservas",
      fr: "Réservations",
    },
    description: {
      pt: "Reserva de serviços de restaurantes, city-tours e rent-a-car.",
      en: "Restaurant reservations, city tours and rent-a-car arrangements.",
      es: "Reserva de restaurantes, city-tours y rent-a-car.",
      fr: "Réservation de restaurants, city-tours et location de voitures.",
    },
  },
];

export const offers: Offer[] = [
  {
    id: "discount",
    slug: "desconto-ate-30",
    image: "/images/hero/featured-suite.jpg",
    badge: {
      pt: "Desconto até 30%",
      en: "Up to 30% off",
      es: "Hasta 30% dto.",
      fr: "Jusqu'à 30% de réduction",
    },
    title: {
      pt: "Desconto = Dias de estadia",
      en: "Discount equals length of stay",
      es: "Descuento = Días de estancia",
      fr: "Réduction = Jours de séjour",
    },
    description: {
      pt: "Estadia em quarto single, duplo, twin ou triplo com desconto igual ao número de dias da sua estadia, até um máximo de 30%.",
      en: "Stay in a single, double, twin or triple room with a discount equal to the number of nights of your stay, up to a maximum of 30%.",
      es: "Estancia en habitación individual, doble, twin o triple con descuento igual al número de días de su estancia, hasta un máximo del 30%.",
      fr: "Séjour en chambre simple, double, twin ou triple avec une réduction égale au nombre de jours de votre séjour, jusqu'à un maximum de 30%.",
    },
    priceFrom: 30,
    priceLabel: {
      pt: "até 30% de desconto",
      en: "up to 30% off",
      es: "hasta 30% de descuento",
      fr: "jusqu'à 30% de réduction",
    },
    includes: {
      pt: [
        "Desconto progressivo conforme dias de estadia",
        "Pequeno-almoço incluído",
        "Aplicável a single, duplo, twin e triplo",
      ],
      en: [
        "Progressive discount based on length of stay",
        "Breakfast included",
        "Available for single, double, twin and triple",
      ],
      es: [
        "Descuento progresivo según los días de estancia",
        "Desayuno incluido",
        "Aplicable a individual, doble, twin y triple",
      ],
      fr: [
        "Réduction progressive selon les jours de séjour",
        "Petit-déjeuner inclus",
        "Applicable aux simples, doubles, twin et triples",
      ],
    },
    conditions: {
      pt: [
        "Não inclui extras",
        "Desconto aplicado apenas ao alojamento",
        "Período máximo de 30 dias",
        "Válida conforme disponibilidade",
        "Não acumulável com outras promoções",
      ],
      en: [
        "Extras not included",
        "Discount applies only to accommodation",
        "Maximum 30-day period",
        "Subject to availability",
        "Not combinable with other offers",
      ],
      es: [
        "No incluye extras",
        "Descuento aplicado solo al alojamiento",
        "Período máximo de 30 días",
        "Sujeto a disponibilidad",
        "No acumulable con otras promociones",
      ],
      fr: [
        "N'inclut pas les extras",
        "Réduction appliquée uniquement à l'hébergement",
        "Période maximale de 30 jours",
        "Valable selon disponibilité",
        "Non cumulable avec d'autres promotions",
      ],
    },
  },
  {
    id: "cruise",
    slug: "cruzeiro-seis-pontes",
    image: "/images/hero/hero-porto.jpg",
    badge: {
      pt: "Experiência",
      en: "Experience",
      es: "Experiencia",
      fr: "Expérience",
    },
    title: {
      pt: "Cruzeiro das 6 Pontes + estadia",
      en: "Six Bridges Cruise + stay",
      es: "Crucero de los 6 Puentes + estancia",
      fr: "Croisière des 6 Ponts + séjour",
    },
    description: {
      pt: "Inclui 1 noite de alojamento em quarto duplo ou twin para 2 pessoas e cruzeiro das 6 pontes para 2 pessoas com 1 Porto de honra.",
      en: "Includes 1 night in a double or twin room for 2 people and the Six Bridges Cruise for 2 with one welcome Port wine.",
      es: "Incluye 1 noche en habitación doble o twin para 2 personas y crucero de los 6 puentes para 2 personas con 1 Oporto de bienvenida.",
      fr: "Comprend 1 nuit d'hébergement en chambre double ou twin pour 2 personnes et la croisière des 6 ponts pour 2 personnes avec 1 Porto d'honneur.",
    },
    priceFrom: 60.95,
    priceLabel: {
      pt: "para 2 pessoas",
      en: "for 2 people",
      es: "para 2 personas",
      fr: "pour 2 personnes",
    },
    includes: {
      pt: [
        "1 noite em quarto duplo ou twin",
        "Pequeno-almoço incluído",
        "Cruzeiro das 6 Pontes para 2 pessoas",
        "1 Porto de honra a bordo",
      ],
      en: [
        "1 night in double or twin room",
        "Breakfast included",
        "Six Bridges Cruise for 2",
        "1 welcome Port wine on board",
      ],
      es: [
        "1 noche en habitación doble o twin",
        "Desayuno incluido",
        "Crucero de los 6 Puentes para 2 personas",
        "1 Oporto de bienvenida a bordo",
      ],
      fr: [
        "1 nuit en chambre double ou twin",
        "Petit-déjeuner inclus",
        "Croisière des 6 Ponts pour 2 personnes",
        "1 Porto d'honneur à bord",
      ],
    },
    conditions: {
      pt: [
        "Não inclui extras",
        "Check-out às 12h",
        "Válida conforme disponibilidade",
        "Não acumulável com outras promoções",
      ],
      en: [
        "Extras not included",
        "Check-out at noon",
        "Subject to availability",
        "Not combinable with other offers",
      ],
      es: [
        "No incluye extras",
        "Salida a las 12h",
        "Sujeto a disponibilidad",
        "No acumulable con otras promociones",
      ],
      fr: [
        "N'inclut pas les extras",
        "Départ à 12h",
        "Valable selon disponibilité",
        "Non cumulable avec d'autres promotions",
      ],
    },
  },
  {
    id: "weekend",
    slug: "fim-de-semana",
    image: "/images/hero/featured-lobby.jpg",
    badge: {
      pt: "Fim-de-semana",
      en: "Weekend",
      es: "Fin de semana",
      fr: "Week-end",
    },
    title: {
      pt: "Fim de Semana · 3 noites",
      en: "Weekend · 3 nights",
      es: "Fin de semana · 3 noches",
      fr: "Week-end · 3 nuits",
    },
    description: {
      pt: "Estadia de sexta, sábado e domingo com pequeno-almoço incluído em quarto single, duplo ou twin.",
      en: "Friday, Saturday and Sunday stay with breakfast included in single, double or twin room.",
      es: "Estancia de viernes, sábado y domingo con desayuno incluido en habitación individual, doble o twin.",
      fr: "Séjour du vendredi, samedi et dimanche avec petit-déjeuner inclus en chambre simple, double ou twin.",
    },
    priceFrom: 114,
    priceLabel: {
      pt: "1 pessoa · 139€ para 2",
      en: "1 person · €139 for 2",
      es: "1 persona · 139€ para 2",
      fr: "1 personne · 139€ pour 2",
    },
    includes: {
      pt: [
        "3 noites (sexta, sábado, domingo)",
        "Pequeno-almoço incluído",
        "Quarto single, duplo ou twin",
        "Welcome drink à chegada",
      ],
      en: [
        "3 nights (Friday, Saturday, Sunday)",
        "Breakfast included",
        "Single, double or twin room",
        "Welcome drink on arrival",
      ],
      es: [
        "3 noches (viernes, sábado, domingo)",
        "Desayuno incluido",
        "Habitación individual, doble o twin",
        "Welcome drink a la llegada",
      ],
      fr: [
        "3 nuits (vendredi, samedi, dimanche)",
        "Petit-déjeuner inclus",
        "Chambre simple, double ou twin",
        "Boisson de bienvenue à l'arrivée",
      ],
    },
    conditions: {
      pt: [
        "Não inclui extras",
        "Válida conforme disponibilidade",
        "Não acumulável com outras promoções",
      ],
      en: [
        "Extras not included",
        "Subject to availability",
        "Not combinable with other offers",
      ],
      es: [
        "No incluye extras",
        "Sujeto a disponibilidad",
        "No acumulable con otras promociones",
      ],
      fr: [
        "N'inclut pas les extras",
        "Valable selon disponibilité",
        "Non cumulable avec d'autres promotions",
      ],
    },
  },
];

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    author: "Maria & João",
    origin: { pt: "Lisboa, PT", en: "Lisbon, PT", es: "Lisboa, PT", fr: "Lisbonne, PT" },
    rating: 5,
    quote: {
      pt: "Equipa simpática e atenciosa, quartos confortáveis e localização perfeita junto à Casa da Música. Voltaremos!",
      en: "Friendly, attentive team, comfortable rooms and a perfect location next to Casa da Música. We'll be back!",
      es: "Equipo amable y atento, habitaciones cómodas y ubicación perfecta junto a la Casa da Música. ¡Volveremos!",
      fr: "Équipe sympathique et attentionnée, chambres confortables et emplacement parfait à côté de la Casa da Música. Nous reviendrons !",
    },
  },
  {
    id: "t2",
    author: "Sophie Laurent",
    origin: { pt: "Paris, FR", en: "Paris, FR", es: "París, FR", fr: "Paris, FR" },
    rating: 5,
    quote: {
      pt: "Um clássico do Porto: tranquilo, com pequeno-almoço excelente e funcionários que falam várias línguas.",
      en: "A Porto classic: quiet, with excellent breakfast and staff who speak several languages.",
      es: "Un clásico de Oporto: tranquilo, con un desayuno excelente y personal que habla varios idiomas.",
      fr: "Un classique de Porto : calme, avec un excellent petit-déjeuner et un personnel qui parle plusieurs langues.",
    },
  },
  {
    id: "t3",
    author: "Marco Bianchi",
    origin: { pt: "Milão, IT", en: "Milan, IT", es: "Milán, IT", fr: "Milan, IT" },
    rating: 4,
    quote: {
      pt: "Excelente relação qualidade/preço para uma estadia a trabalho. Garagem coberta foi uma ajuda enorme.",
      en: "Great value for a business trip. The covered garage was a huge help.",
      es: "Excelente relación calidad/precio para un viaje de negocios. El garaje cubierto fue una gran ayuda.",
      fr: "Excellent rapport qualité/prix pour un séjour professionnel. Le garage couvert a été d'une grande aide.",
    },
  },
];

export const galleryImages = [
  "/images/hero/hero-main.jpg",
  "/images/hero/hero-room.jpg",
  "/images/hero/featured-lobby.jpg",
  "/images/hero/featured-suite.jpg",
  "/images/hero/featured-detail.jpg",
  "/images/hero/featured-bathroom.jpg",
  "/images/hero/featured-breakfast.jpg",
  "/images/hero/hero-porto.jpg",
  "/images/rooms/room-single.jpg",
  "/images/rooms/room-double.jpg",
  "/images/rooms/room-twin.jpg",
  "/images/rooms/room-superior.jpg",
  "/images/rooms/room-triple.jpg",
  "/images/rooms/room-romantic.jpg",
  "/images/rooms/hotel-interior.jpg",
  "/images/rooms/hotel-lobby.jpg",
];
