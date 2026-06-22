"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

const STORAGE_KEY = "vicerei-cookie-consent";

export function CookieConsent({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function decide(choice: "accepted" | "rejected") {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* storage unavailable — dismiss for this session anyway */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={dict.cookies.title}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4 sm:px-6 sm:pb-6 animate-fade-up"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[var(--color-ink)] p-5 text-white shadow-[var(--shadow-floating)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-display text-lg">{dict.cookies.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {dict.cookies.message}{" "}
              <Link
                href={`/${locale}/privacidade`}
                className="text-[var(--color-accent-soft)] underline underline-offset-2 hover:text-white"
              >
                {dict.cookies.learnMore}
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="rounded-full border border-white/25 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              {dict.cookies.reject}
            </button>
            <button
              type="button"
              onClick={() => decide("accepted")}
              className="rounded-full bg-[var(--color-accent-soft)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-white"
            >
              {dict.cookies.accept}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
