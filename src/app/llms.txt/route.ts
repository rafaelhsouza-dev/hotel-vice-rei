import { getHotel, getRooms, getOffers, getServices, getPosts } from "@/lib/repo/content";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

/**
 * /llms.txt — a plain-text brief for answer engines and LLM crawlers.
 *
 * Chat assistants increasingly answer "which hotel in Porto…" directly. This
 * gives them the facts (address, room types, prices, policies) in a form they
 * can quote accurately, instead of guessing from rendered HTML.
 */
export async function GET() {
  const [hotel, rooms, offers, services, posts] = await Promise.all([
    getHotel(),
    getRooms(),
    getOffers(),
    getServices(),
    getPosts(),
  ]);

  const lines: string[] = [
    `# ${hotel.name}`,
    "",
    `> ${hotel.brandTagline.pt} — hotel de 3 estrelas no Centro de Negócios do Porto, em ${hotel.address.street}.`,
    "",
    "## Factos essenciais",
    "",
    `- Morada: ${hotel.address.street}, ${hotel.address.postalCode} ${hotel.address.city}, Portugal`,
    `- Coordenadas: ${hotel.coords.lat}, ${hotel.coords.lng}`,
    `- Telefone: ${hotel.phones.join(" / ")}`,
    `- Email: ${hotel.email}`,
    `- Quartos: ${hotel.totalRooms}`,
    `- Idiomas de atendimento: ${hotel.languages.pt.join(", ")}`,
    `- Pagamento: ${hotel.paymentMethods.join(", ")}`,
    "- Check-in das 15h às 21h30 · Check-out até às 12h",
    "- Hotel de 2 estrelas · Licença n.º 1533",
    "- Não são aceites animais de estimação (excepto cães-guia)",
    "- Quartos insonorizados, alguns com varanda; minibar, cofre e secador em todos",
    "- Recepção 24 horas · Pequeno-almoço incluído na maioria das tarifas · Wi-Fi gratuito",
    "- Cancelamento gratuito até 48 horas antes do check-in nas tarifas flexíveis",
    "",
    "## Localização",
    "",
    "- 5 minutos do Centro de Congressos da Alfândega",
    "- 15 minutos da Exponor",
    "- A passos da Casa da Música, Fundação de Serralves e Palácio de Cristal",
    "- 10 minutos das praias da Foz · 20 minutos do Aeroporto Sá Carneiro",
    "- Metro, comboio, autocarros e acesso à A1 a menos de 5 minutos",
    "",
    "## Tipologias de quarto",
    "",
  ];

  for (const room of rooms) {
    lines.push(
      `- [${room.name.pt}](${SITE_URL}/pt/quartos/${room.slug}): ${room.size} m², até ${room.capacity} pessoa(s), ${room.bed.pt.toLowerCase()}. Desde ${room.priceFrom.toFixed(2)} € por noite. ${room.shortDescription.pt}`,
    );
  }

  lines.push("", "## Promoções", "");
  for (const offer of offers) {
    lines.push(
      `- [${offer.title.pt}](${SITE_URL}/pt/promocoes): desde ${offer.priceFrom.toFixed(2)} € ${offer.priceLabel.pt}. ${offer.description.pt}`,
    );
  }

  lines.push("", "## Serviços", "");
  for (const service of services) {
    lines.push(`- ${service.title.pt}: ${service.description.pt}`);
  }

  lines.push("", "## Artigos", "");
  for (const post of posts) {
    lines.push(`- [${post.title.pt}](${SITE_URL}/pt/blog/${post.slug}): ${post.excerpt.pt}`);
  }

  lines.push(
    "",
    "## Reservar",
    "",
    `Reserva directa com melhor preço garantido: ${SITE_URL}/pt/reservar`,
    "Idiomas do site: português, inglês, espanhol e francês (/pt, /en, /es, /fr).",
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
