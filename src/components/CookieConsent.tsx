"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import {
  OPEN_CONSENT_EVENT,
  readConsent,
  saveConsent,
  type Consent,
} from "./site/consent";

/**
 * Consent banner with separate "analytics" and "marketing" choices.
 *
 * Saving updates Google Consent Mode and fires a window event the analytics
 * loader listens to. The footer's "Cookie preferences" link reopens it.
 */
export function CookieConsent({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [visible, setVisible] = useState(false);
  const [custom, setCustom] = useState(false);
  const [choice, setChoice] = useState<Consent>({ analytics: false, marketing: false });
  const firstButton = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const stored = readConsent();
    if (!stored) setVisible(true);
    else setChoice(stored);

    function reopen() {
      setChoice(readConsent() ?? { analytics: false, marketing: false });
      setCustom(true);
      setVisible(true);
    }
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (visible && custom) firstButton.current?.focus();
  }, [visible, custom]);

  function decide(c: Consent) {
    saveConsent(c);
    setChoice(c);
    setVisible(false);
    setCustom(false);
  }

  if (!visible) return null;

  const toggleCls =
    "mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent-soft)] disabled:opacity-60";

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-3 sm:px-6 sm:pb-6 animate-fade-up"
    >
      <div className="mx-auto max-h-[85svh] max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[var(--color-ink)] p-5 text-white shadow-[var(--shadow-floating)] sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p id={titleId} className="font-display text-lg">
              {custom ? dict.cookies.preferences : dict.cookies.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {dict.cookies.message}{" "}
              <Link
                href={`/${locale}/privacidade`}
                aria-label={`${dict.cookies.learnMore} — ${dict.privacy.title}`}
                className="text-[var(--color-accent-soft)] underline underline-offset-2 hover:text-white"
              >
                {dict.cookies.learnMore}
              </Link>
            </p>
          </div>
          {!custom && (
            <div className="flex shrink-0 flex-wrap gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setCustom(true)}
                className="min-h-11 rounded-full px-4 py-2.5 text-sm font-medium text-white/90 underline-offset-2 hover:underline"
              >
                {dict.cookies.customize}
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics: false, marketing: false })}
                className="min-h-11 rounded-full border border-white/25 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                {dict.cookies.reject}
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics: true, marketing: true })}
                className="min-h-11 rounded-full bg-[var(--color-accent-soft)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-white"
              >
                {dict.cookies.accept}
              </button>
            </div>
          )}
        </div>

        {custom && (
          <div className="mt-5 space-y-3">
            <label className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm">
              <input type="checkbox" checked disabled className={toggleCls} />
              <span>
                <span className="font-medium">{dict.cookies.necessary}</span>{" "}
                <span className="text-xs text-white/60">({dict.cookies.alwaysOn})</span>
                <span className="mt-0.5 block text-white/70">{dict.cookies.necessaryDesc}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3 text-sm">
              <input
                type="checkbox"
                checked={choice.analytics}
                onChange={(e) => setChoice((c) => ({ ...c, analytics: e.target.checked }))}
                className={toggleCls}
              />
              <span>
                <span className="font-medium">{dict.cookies.analytics}</span>
                <span className="mt-0.5 block text-white/70">{dict.cookies.analyticsDesc}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3 text-sm">
              <input
                type="checkbox"
                checked={choice.marketing}
                onChange={(e) => setChoice((c) => ({ ...c, marketing: e.target.checked }))}
                className={toggleCls}
              />
              <span>
                <span className="font-medium">{dict.cookies.marketing}</span>
                <span className="mt-0.5 block text-white/70">{dict.cookies.marketingDesc}</span>
              </span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-1 sm:gap-3">
              <button
                ref={firstButton}
                type="button"
                onClick={() => decide({ analytics: false, marketing: false })}
                className="min-h-11 rounded-full border border-white/25 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                {dict.cookies.reject}
              </button>
              <button
                type="button"
                onClick={() => decide(choice)}
                className="min-h-11 rounded-full border border-white/25 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                {dict.cookies.save}
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics: true, marketing: true })}
                className="min-h-11 rounded-full bg-[var(--color-accent-soft)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-white"
              >
                {dict.cookies.accept}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
