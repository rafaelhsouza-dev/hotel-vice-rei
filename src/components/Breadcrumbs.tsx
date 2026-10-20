import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";
import { Icon } from "./Icon";

export type Crumb = { label: string; href?: string };

/**
 * Visible breadcrumb trail plus matching BreadcrumbList structured data, so
 * result snippets show the path instead of a bare URL.
 */
export function Breadcrumbs({
  crumbs,
  locale,
  homeLabel,
  label = "Breadcrumb",
  currentPath,
}: {
  crumbs: Crumb[];
  locale: Locale;
  homeLabel: string;
  /** Accessible name of the trail, in the page language. */
  label?: string;
  /** Path of the current page (e.g. "/pt/quartos"), so the last item has a URL too. */
  currentPath?: string;
}) {
  const all: Crumb[] = [{ label: homeLabel, href: `/${locale}` }, ...crumbs];

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
      ...(crumb.href
        ? { item: `${SITE_URL}${crumb.href}` }
        : i === all.length - 1 && currentPath
          ? { item: `${SITE_URL}${currentPath}` }
          : {}),
    })),
  };

  return (
    <nav aria-label={label} className="container-x pt-8">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
        {all.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && (
              <Icon name="chevron-right" width={11} height={11} aria-hidden />
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-[var(--color-accent-deep)]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-[var(--color-ink-soft)]">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
    </nav>
  );
}
