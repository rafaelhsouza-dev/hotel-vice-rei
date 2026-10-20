"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

export type NotFoundStrings = Record<
  Locale,
  { code: string; title: string; body: string; back: string }
>;

/**
 * not-found.tsx receives no params, so the locale is read from the URL here.
 * Only the four short 404 strings are shipped to the client.
 */
export function NotFoundContent({ strings }: { strings: NotFoundStrings }) {
  const first = (usePathname() ?? "/").split("/").filter(Boolean)[0] ?? "";
  const locale: Locale = isLocale(first) ? first : defaultLocale;
  const t = strings[locale];

  useEffect(() => {
    document.title = `${t.title} · Hotel Vice-Rei`;
  }, [t.title]);

  return (
    <div className="container-x grid flex-1 place-items-center py-32">
      <div className="max-w-md text-center">
        <Image
          src="/logo-hotel-vice-rei.webp"
          alt="Hotel Vice-Rei"
          width={2016}
          height={512}
          sizes="240px"
          className="mx-auto mb-10 h-9 w-auto sm:h-11"
        />
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-ink-muted)]">
          {t.code}
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">{t.title}</h1>
        <p className="mt-4 text-[var(--color-ink-soft)]">{t.body}</p>
        <Link
          href={`/${locale}`}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)]"
        >
          {t.back}
        </Link>
      </div>
    </div>
  );
}
