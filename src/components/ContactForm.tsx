"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";

export function ContactForm({ dict }: { dict: Dictionary }) {
  const [sent, setSent] = useState(false);

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
        setSent(true);
      }}
      className="mt-8 grid gap-5"
    >
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className={label} htmlFor="cf-name">
            {dict.contact.name}
          </label>
          <input id="cf-name" name="name" required className={field} />
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
        <textarea
          id="cf-message"
          name="message"
          rows={6}
          required
          className={field}
        />
      </div>
      <div className="flex items-center justify-end">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] transition-colors"
        >
          {dict.contact.send}
          <Icon name="arrow-right" width={14} height={14} />
        </button>
      </div>
    </form>
  );
}
