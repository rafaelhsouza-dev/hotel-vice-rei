import { getOffers, getPois } from "@/lib/repo/content";
import { getFacts, llmsCore, llmsSummary, type LlmsLang } from "@/lib/facts";
import { getDictionary } from "@/i18n";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

/**
 * /llms-full.txt — the long form of /llms.txt: every fact and policy, full
 * room descriptions, published offers, the FAQ and the cancellation terms,
 * in Portuguese and then in English. Same single facts source.
 */
export async function GET() {
  const [facts, pois, offers] = await Promise.all([getFacts(), getPois(), getOffers()]);

  const section = (lang: LlmsLang): string[] => {
    const dict = getDictionary(lang);
    const L: string[] = [];
    const cancellationSummary = dict.cancellation.sections
      .slice(0, 2)
      .map((s) => s.body)
      .join(" ");

    L.push(
      ...llmsCore(facts, lang, {
        siteUrl: SITE_URL,
        cancellationSummary,
        pois: pois.map((p) => ({ name: p.name[lang] || p.name.pt, walkMinutes: p.walkMinutes, url: p.url })),
      }),
    );

    L.push("", lang === "pt" ? "## Descrição dos quartos" : "## Room descriptions", "");
    for (const room of facts.rooms) {
      L.push(`### ${room.name[lang]}`, "");
      L.push(`${SITE_URL}/${lang}/quartos/${room.slug}`, "");
      for (const p of room.longDescription[lang]) L.push(p, "");
      L.push(`- ${dict.rooms.bedLabel}: ${room.bed[lang]}`);
      L.push(`- ${dict.rooms.bathLabel}: ${room.bathroom[lang]}`);
      L.push(`- ${dict.rooms.amenitiesTitle}: ${room.amenities[lang].join(", ")}`, "");
    }

    if (offers.length) {
      L.push(lang === "pt" ? "## Promoções publicadas" : "## Published offers", "");
      for (const o of offers) {
        L.push(`### ${o.title[lang]}`, "");
        L.push(`${SITE_URL}/${lang}/promocoes#${o.slug}`, "");
        L.push(o.description[lang], "");
        if (o.includes[lang].length) L.push(`- ${dict.offers.includes}: ${o.includes[lang].join("; ")}`);
        if (o.conditions[lang].length) L.push(`- ${dict.offers.conditions}: ${o.conditions[lang].join("; ")}`);
        L.push("");
      }
    }

    L.push(`## ${dict.faq.eyebrow}`, "");
    for (const item of dict.faq.items) L.push(`### ${item.q}`, "", item.a, "");

    L.push(`## ${dict.cancellation.title}`, "");
    for (const s of dict.cancellation.sections) L.push(`### ${s.heading}`, "", s.body, "");
    return L;
  };

  const lines = [
    `# ${facts.hotel.name}`,
    "",
    `> ${llmsSummary(facts, "pt")}`,
    `> ${llmsSummary(facts, "en")}`,
    "",
    "# Português",
    "",
    ...section("pt"),
    "# English",
    "",
    ...section("en"),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
