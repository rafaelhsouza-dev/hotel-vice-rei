"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  isLocale,
  localeFlags,
  localeNames,
  locales,
  type Locale,
} from "@/i18n/config";
import { Icon } from "./Icon";

/** Same page in another locale: swaps the first segment, keeps the rest. */
function pathFor(pathname: string, target: Locale) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && isLocale(segments[0])) segments[0] = target;
  else segments.unshift(target);
  return "/" + segments.join("/");
}

function rememberLocale(target: Locale) {
  document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Language menu as a disclosure of real links (crawlable, hreflang-tagged,
 * openable in a new tab) — not a listbox, which would promise arrow-key
 * selection semantics the menu does not have.
 */
export function LocaleSwitcher({
  current,
  light = false,
  label = "Language",
}: {
  current: Locale;
  light?: boolean;
  label?: string;
}) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId();

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-all duration-500 ${
          light
            ? "border border-white/30 text-white/90 hover:bg-white/10"
            : "hairline bg-white/70 text-[var(--color-ink-soft)] hover:bg-white"
        }`}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${localeNames[current]}`}
      >
        <span aria-hidden className="font-medium tracking-wider uppercase">
          {current}
        </span>
        <Icon name="chevron-down" width={12} height={12} />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-floating)]"
      >
        {locales.map((l) => (
          <li key={l}>
            <Link
              href={pathFor(pathname, l)}
              hrefLang={l}
              lang={l}
              aria-current={l === current ? "true" : undefined}
              onClick={() => {
                rememberLocale(l);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-[var(--color-line-soft)] ${
                l === current
                  ? "text-[var(--color-accent-deep)]"
                  : "text-[var(--color-ink-soft)]"
              }`}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{localeFlags[l]}</span>
                <span>{localeNames[l]}</span>
              </span>
              {l === current && <Icon name="check" width={14} height={14} aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
