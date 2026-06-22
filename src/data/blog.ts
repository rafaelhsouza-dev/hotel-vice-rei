import type { Locale } from "@/i18n/config";

type Trio<T> = Record<Locale, T>;

export type Post = {
  slug: string;
  image: string;
  date: string; // ISO
  readingMinutes: number;
  category: Trio<string>;
  title: Trio<string>;
  excerpt: Trio<string>;
  body: Trio<string[]>;
};

export const posts: Post[] = [
  {
    slug: "48-horas-no-porto",
    image: "/images/hero/hero-porto.jpg",
    date: "2026-06-10",
    readingMinutes: 6,
    category: {
      pt: "Roteiros",
      en: "Itineraries",
      es: "Rutas",
      fr: "Itinéraires",
    },
    title: {
      pt: "48 horas no Porto: o roteiro essencial",
      en: "48 hours in Porto: the essential itinerary",
      es: "48 horas en Oporto: la ruta esencial",
      fr: "48 heures à Porto : l'itinéraire essentiel",
    },
    excerpt: {
      pt: "Da Ribeira a Serralves, um plano de dois dias para descobrir o melhor da cidade a pé e a partir do Hotel Vice-Rei.",
      en: "From Ribeira to Serralves, a two-day plan to discover the best of the city on foot from Hotel Vice-Rei.",
      es: "De la Ribeira a Serralves, un plan de dos días para descubrir lo mejor de la ciudad a pie desde el Hotel Vice-Rei.",
      fr: "De la Ribeira à Serralves, un programme de deux jours pour découvrir le meilleur de la ville à pied depuis l'Hotel Vice-Rei.",
    },
    body: {
      pt: [
        "Comece o primeiro dia pela Avenida da Boavista, junto à Casa da Música — um dos ícones arquitetónicos da cidade, a poucos minutos a pé do hotel. Siga depois para a Fundação de Serralves, com os seus jardins e o museu de arte contemporânea.",
        "À tarde, desça até à Baixa: a Livraria Lello, a Torre dos Clérigos e a Estação de São Bento com os seus azulejos. Termine o dia na Ribeira, ao pôr do sol, com vista para o Douro e as pontes.",
        "No segundo dia, atravesse a Ponte D. Luís I até Vila Nova de Gaia para visitar as caves de Vinho do Porto. Volte de barco com um cruzeiro das seis pontes — uma das melhores formas de ver a cidade.",
        "De regresso ao hotel, a nossa recepção 24h ajuda-o a reservar restaurantes, tours e transporte para aproveitar cada minuto.",
      ],
      en: [
        "Start day one on Avenida da Boavista, by Casa da Música — one of the city's architectural icons, a few minutes' walk from the hotel. Then head to the Serralves Foundation, with its gardens and contemporary art museum.",
        "In the afternoon, walk down to the city centre: Lello bookshop, the Clérigos Tower and São Bento station with its tilework. End the day in Ribeira at sunset, overlooking the Douro and its bridges.",
        "On day two, cross the D. Luís I Bridge to Vila Nova de Gaia to visit the Port wine cellars. Come back by boat on a six-bridges cruise — one of the best ways to see the city.",
        "Back at the hotel, our 24h reception helps you book restaurants, tours and transport so you can enjoy every minute.",
      ],
      es: [
        "Empieza el primer día por la Avenida da Boavista, junto a la Casa da Música — uno de los iconos arquitectónicos de la ciudad, a pocos minutos a pie del hotel. Continúa hacia la Fundación de Serralves, con sus jardines y su museo de arte contemporáneo.",
        "Por la tarde, baja al centro: la Librería Lello, la Torre de los Clérigos y la estación de São Bento con sus azulejos. Termina el día en la Ribeira, al atardecer, con vistas al Duero y sus puentes.",
        "El segundo día, cruza el Puente D. Luís I hasta Vila Nova de Gaia para visitar las bodegas de vino de Oporto. Vuelve en barco con un crucero de los seis puentes — una de las mejores formas de ver la ciudad.",
        "De vuelta al hotel, nuestra recepción 24h te ayuda a reservar restaurantes, tours y transporte para aprovechar cada minuto.",
      ],
      fr: [
        "Commencez la première journée par l'Avenida da Boavista, près de la Casa da Música — l'un des symboles architecturaux de la ville, à quelques minutes à pied de l'hôtel. Poursuivez vers la Fondation de Serralves, avec ses jardins et son musée d'art contemporain.",
        "L'après-midi, descendez vers le centre : la librairie Lello, la tour des Clérigos et la gare de São Bento avec ses azulejos. Terminez la journée à la Ribeira au coucher du soleil, face au Douro et à ses ponts.",
        "Le deuxième jour, traversez le pont D. Luís I jusqu'à Vila Nova de Gaia pour visiter les caves de vin de Porto. Revenez en bateau avec une croisière des six ponts — l'une des meilleures façons de voir la ville.",
        "De retour à l'hôtel, notre réception 24h vous aide à réserver restaurants, excursions et transport pour profiter de chaque minute.",
      ],
    },
  },
  {
    slug: "melhor-epoca-visitar-porto",
    image: "/images/hero/featured-detail.jpg",
    date: "2026-05-22",
    readingMinutes: 4,
    category: {
      pt: "Dicas",
      en: "Tips",
      es: "Consejos",
      fr: "Conseils",
    },
    title: {
      pt: "Qual a melhor época para visitar o Porto?",
      en: "When is the best time to visit Porto?",
      es: "¿Cuál es la mejor época para visitar Oporto?",
      fr: "Quelle est la meilleure période pour visiter Porto ?",
    },
    excerpt: {
      pt: "Clima, eventos e preços ao longo do ano para escolher o momento certo da sua viagem.",
      en: "Weather, events and prices through the year to pick the right time for your trip.",
      es: "Clima, eventos y precios a lo largo del año para elegir el momento ideal de tu viaje.",
      fr: "Climat, événements et prix au fil de l'année pour choisir le bon moment pour votre voyage.",
    },
    body: {
      pt: [
        "A primavera (abril a junho) e o início do outono (setembro e outubro) são as melhores alturas: dias amenos, menos multidões e preços mais equilibrados.",
        "O verão é animado e quente, ideal para a praia da Foz, mas é a época mais concorrida. Junho traz o São João, a maior festa da cidade, na noite de 23 para 24.",
        "O inverno é tranquilo e mais económico, perfeito para quem quer museus, gastronomia e caves de vinho sem filas. Reserve cedo e aproveite as nossas tarifas de inverno.",
      ],
      en: [
        "Spring (April to June) and early autumn (September and October) are the best times: mild days, fewer crowds and more balanced prices.",
        "Summer is lively and warm, perfect for Foz beach, but it is the busiest season. June brings São João, the city's biggest festival, on the night of the 23rd to 24th.",
        "Winter is quiet and more affordable, ideal if you want museums, food and wine cellars without queues. Book early and enjoy our winter rates.",
      ],
      es: [
        "La primavera (de abril a junio) y el inicio del otoño (septiembre y octubre) son las mejores épocas: días templados, menos gente y precios más equilibrados.",
        "El verano es animado y caluroso, ideal para la playa de Foz, pero es la temporada más concurrida. Junio trae el São João, la mayor fiesta de la ciudad, en la noche del 23 al 24.",
        "El invierno es tranquilo y más económico, perfecto para museos, gastronomía y bodegas sin colas. Reserva con antelación y aprovecha nuestras tarifas de invierno.",
      ],
      fr: [
        "Le printemps (avril à juin) et le début de l'automne (septembre et octobre) sont les meilleures périodes : journées douces, moins de monde et des prix plus équilibrés.",
        "L'été est animé et chaud, idéal pour la plage de Foz, mais c'est la saison la plus fréquentée. Juin accueille la São João, la plus grande fête de la ville, dans la nuit du 23 au 24.",
        "L'hiver est calme et plus économique, parfait pour les musées, la gastronomie et les caves sans file d'attente. Réservez tôt et profitez de nos tarifs d'hiver.",
      ],
    },
  },
  {
    slug: "pequeno-almoco-no-porto",
    image: "/images/hero/featured-breakfast.jpg",
    date: "2026-04-30",
    readingMinutes: 3,
    category: {
      pt: "Hotel",
      en: "Hotel",
      es: "Hotel",
      fr: "Hôtel",
    },
    title: {
      pt: "O pequeno-almoço que dá energia ao seu dia",
      en: "The breakfast that fuels your day",
      es: "El desayuno que da energía a tu día",
      fr: "Le petit-déjeuner qui donne de l'énergie à votre journée",
    },
    excerpt: {
      pt: "Produtos frescos, clássicos portugueses e a opção de ser servido no quarto. Conheça o nosso pequeno-almoço.",
      en: "Fresh produce, Portuguese classics and the option of in-room service. Discover our breakfast.",
      es: "Productos frescos, clásicos portugueses y la opción de servicio en la habitación. Descubre nuestro desayuno.",
      fr: "Produits frais, classiques portugais et l'option du service en chambre. Découvrez notre petit-déjeuner.",
    },
    body: {
      pt: [
        "Incluído na maioria das tarifas, o nosso pequeno-almoço continental combina pão fresco, fruta da época, iogurtes, queijos e charcutaria com clássicos como o pastel de nata e a torrada com manteiga.",
        "Para quem prefere começar o dia com calma, há a opção de pequeno-almoço servido no quarto — ideal para o pacote Romântico ou simplesmente para um despertar mais tranquilo.",
        "Café acabado de fazer, sumos naturais e atendimento em vários idiomas completam a experiência. Tudo para sair com energia e descobrir o Porto.",
      ],
      en: [
        "Included in most rates, our continental breakfast pairs fresh bread, seasonal fruit, yoghurts, cheeses and cold cuts with classics like the pastel de nata and buttered toast.",
        "If you prefer a slow start, breakfast can be served in your room — perfect for the Romantic package or simply a gentler wake-up.",
        "Freshly brewed coffee, natural juices and multilingual service complete the experience. Everything to set off energised and explore Porto.",
      ],
      es: [
        "Incluido en la mayoría de las tarifas, nuestro desayuno continental combina pan fresco, fruta de temporada, yogures, quesos y embutidos con clásicos como el pastel de nata y la tostada con mantequilla.",
        "Para quien prefiere empezar con calma, hay opción de desayuno servido en la habitación — ideal para el paquete Romántico o simplemente para un despertar más tranquilo.",
        "Café recién hecho, zumos naturales y atención en varios idiomas completan la experiencia. Todo para salir con energía y descubrir Oporto.",
      ],
      fr: [
        "Inclus dans la plupart des tarifs, notre petit-déjeuner continental associe pain frais, fruits de saison, yaourts, fromages et charcuterie à des classiques comme le pastel de nata et la tartine beurrée.",
        "Pour ceux qui préfèrent commencer en douceur, le petit-déjeuner peut être servi en chambre — idéal pour le forfait Romantique ou tout simplement pour un réveil plus tranquille.",
        "Café fraîchement préparé, jus naturels et service en plusieurs langues complètent l'expérience. De quoi partir plein d'énergie à la découverte de Porto.",
      ],
    },
  },
];

export function getPost(slug: string) {
  return posts.find((p) => p.slug === slug);
}
