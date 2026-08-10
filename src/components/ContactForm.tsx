"use client";

import { useState, useTransition } from "react";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { sendContactMessage } from "@/app/actions/public";
import { Icon } from "./Icon";

export function ContactForm({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="mt-8 rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-success)] text-white">
            <Icon name="check" />
          </span>
          <div>
            <p className="font-display text-xl">{dict.contact.successTitle}</p>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {dict.contact.successBody}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-accent-deep)] focus:ring-2 focus:ring-[var(--color-accent)]/15";
  const label =
    "text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] mb-1.5 block";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(false);
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await sendContactMessage({
            name: String(data.get("name") ?? ""),
            email: String(data.get("email") ?? ""),
            subject: String(data.get("subject") ?? ""),
            message: String(data.get("message") ?? ""),
            website: String(data.get("website") ?? ""),
            locale,
          });
          if (result.ok) setSent(true);
          else setError(true);
        });
      }}
      className="mt-8 grid gap-5"
    >
      {/* Honeypot: hidden from users, irresistible to bots. */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor="cf-website">Website</label>
        <input id="cf-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className={label} htmlFor="cf-name">
            {dict.contact.name}
          </label>
          <input id="cf-name" name="name" required autoComplete="name" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="cf-email">
            {dict.contact.email}
          </label>
          <input
            id="cf-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={field}
          />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="cf-subject">
          {dict.contact.subject}
        </label>
        <input id="cf-subject" name="subject" className={field} />
      </div>
      <div>
        <label className={label} htmlFor="cf-message">
          {dict.contact.message}
        </label>
        <textarea id="cf-message" name="message" rows={6} required className={field} />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {dict.contact.error}
        </p>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:opacity-60"
        >
          {isPending ? dict.booking_page.sending : dict.contact.send}
          <Icon name="arrow-right" width={14} height={14} />
        </button>
      </div>
    </form>
  );
}
