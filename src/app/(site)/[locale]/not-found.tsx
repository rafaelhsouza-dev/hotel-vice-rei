import type { Metadata } from "next";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { NotFoundContent, type NotFoundStrings } from "@/components/site/NotFoundContent";

/**
 * Rendered inside the locale segment, but not-found receives no params, so the
 * client part picks the language from the URL. Next.js already adds
 * `noindex` to 404 responses; it is stated here too so it never depends on that.
 */
export const metadata: Metadata = {
  title: { absolute: "404 · Hotel Vice-Rei" },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  const strings = Object.fromEntries(
    locales.map((l) => {
      const n = getDictionary(l).notFound;
      return [l, { code: n.code, title: n.title, body: n.body, back: n.back }];
    }),
  ) as NotFoundStrings;
  return <NotFoundContent strings={strings} />;
}
