"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  isLocale,
  localeFlags,
  localeNames,
  locales,
  type Locale,
} from "@/i18n/config";
import { Icon } from "./Icon";

export function LocaleSwitcher({
  current,
  light = false,
}: {
  current: Locale;
  light?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function changeLocale(target: Locale) {
    const segments = pathname.split("/").filter(Boolean);
    const first = segments[0];
    if (first && isLocale(first)) {
      segments[0] = target;
    } else {
      segments.unshift(target);
    }
    const next = "/" + segments.join("/");
    document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(next);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-all duration-500 ${
          light
            ? "border border-white/30 text-white/90 hover:bg-white/10"
            : "hairline bg-white/70 text-[var(--color-ink-soft)] hover:bg-white"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-medium tracking-wider uppercase">{current}</span>
        <Icon name="chevron-down" width={12} height={12} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-floating)]"
        >
          {locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                onClick={() => changeLocale(l as Locale)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-line-soft)] ${
                  l === current
                    ? "text-[var(--color-accent-deep)]"
                    : "text-[var(--color-ink-soft)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{localeFlags[l as Locale]}</span>
                  <span>{localeNames[l as Locale]}</span>
                </span>
                {l === current && <Icon name="check" width={14} height={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
