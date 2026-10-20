import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs";

/** Breadcrumbs with the localised labels and the current page URL filled in. */
export function PageBreadcrumbs({
  locale,
  dict,
  crumbs,
  path,
}: {
  locale: Locale;
  dict: Dictionary;
  crumbs: Crumb[];
  /** Path after the locale, e.g. "/quartos". */
  path: string;
}) {
  return (
    <Breadcrumbs
      locale={locale}
      homeLabel={dict.nav.home}
      label={dict.a11y.breadcrumb}
      crumbs={crumbs}
      currentPath={`/${locale}${path}`}
    />
  );
}
