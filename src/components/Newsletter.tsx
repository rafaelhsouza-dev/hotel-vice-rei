"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { subscribeToNewsletter } from "@/app/actions/public";
import { Icon } from "./Icon";

export function Newsletter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="border-b border-white/10">
      <div className="container-x grid gap-6 py-12 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
            <span aria-hidden className="h-px w-6 bg-[var(--color-accent-soft)]" />
            {dict.newsletter.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-2xl tracking-tight text-white sm:text-3xl">
            {dict.newsletter.title}
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/70">
            {dict.newsletter.subtitle}
          </p>
        </div>

        {sent ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-accent-soft)]/40 bg-white/5 p-5 text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-success)]">
              <Icon name="check" />
            </span>
            <p className="text-sm">{dict.newsletter.success}</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(false);
              const data = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await subscribeToNewsletter({
                  email: String(data.get("email") ?? ""),
                  website: String(data.get("website") ?? ""),
                  locale,
                });
                if (result.ok) setSent(true);
                else setError(true);
              });
            }}
            className="lg:justify-self-end lg:w-full lg:max-w-md"
          >
            {/* Honeypot */}
            <div aria-hidden className="absolute h-0 w-0 overflow-hidden">
              <label htmlFor="nl-website">Website</label>
              <input id="nl-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="nl-email" className="sr-only">
                {dict.newsletter.placeholder}
              </label>
              <input
                id="nl-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={dict.newsletter.placeholder}
                className="w-full rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/60 focus:border-[var(--color-accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
              />
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--color-accent-soft)] px-6 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-white disabled:opacity-60"
              >
                {isPending ? dict.booking_page.sending : dict.newsletter.button}
                <Icon name="arrow-right" width={14} height={14} />
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {dict.newsletter.error}
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-white/70">
              {dict.newsletter.privacyNote}{" "}
              <Link
                href={`/${locale}/privacidade`}
                className="text-white/70 underline underline-offset-2 hover:text-white"
              >
                {dict.footer.privacy}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
