import { getPois } from "@/lib/repo/content";
import { getFacts, llmsCore, llmsSummary } from "@/lib/facts";
import { getDictionary } from "@/i18n";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

/**
 * /llms.txt — a plain-text brief for answer engines and LLM crawlers.
 *
 * Built from one facts source (src/lib/facts.ts: admin settings, booking
 * rules and public scores), so it cannot drift from the site. Unverified
 * claims (parking, breakfast inclusion, distances, 24h reception) are left out.
 * The long version with room descriptions, FAQ and an English section is
 * /llms-full.txt.
 */
export async function GET() {
  const [facts, pois] = await Promise.all([getFacts(), getPois()]);
  const dict = getDictionary("pt");
  const cancellationSummary = dict.cancellation.sections
    .slice(0, 2)
    .map((s) => s.body)
    .join(" ");

  const lines = [
    `# ${facts.hotel.name}`,
    "",
    `> ${llmsSummary(facts, "pt")}`,
    "",
    ...llmsCore(facts, "pt", {
      siteUrl: SITE_URL,
      cancellationSummary,
      pois: pois.map((p) => ({ name: p.name.pt, walkMinutes: p.walkMinutes, url: p.url })),
    }),
    "",
    `Versão completa (descrições dos quartos, perguntas frequentes, políticas e secção em inglês): ${SITE_URL}/llms-full.txt`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
