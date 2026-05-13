"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";
import { LocaleSwitcher } from "./LocaleSwitcher";

const navItems = [
  { href: "", labelKey: "home" as const },
  { href: "/apresentacao", labelKey: "about" as const },
  { href: "/quartos", labelKey: "rooms" as const },
  { href: "/servicos", labelKey: "services" as const },
  { href: "/promocoes", labelKey: "offers" as const },
  { href: "/galeria", labelKey: "gallery" as const },
  { href: "/contactos", labelKey: "contact" as const },
];

export function Header({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const light = !scrolled; // light = white text over hero

  return (
    <header
      data-light={light ? "true" : "false"}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.06)]"
          : "bg-gradient-to-b from-black/40 via-black/15 to-transparent"
      }`}
    >
      <div className="container-x flex h-20 items-center justify-between gap-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-3 group"
          aria-label="Hotel Vice-Rei"
        >
          <span
            className={`relative grid h-11 w-11 place-items-center rounded-full font-display text-xl transition-colors duration-500 ${
              light
                ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)] shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
                : "bg-[var(--color-ink)] text-[var(--color-accent-soft)] shadow-[0_0_0_1px_var(--color-line)]"
            }`}
          >
            <span className="leading-none">V</span>
            <span
              aria-hidden
              className={`pointer-events-none absolute -inset-1 rounded-full border transition-opacity duration-500 ${
                light ? "border-white/30" : "border-[var(--color-accent)]/30"
              } group-hover:opacity-100 opacity-60`}
            />
          </span>
          <span className="flex flex-col leading-tight">
            <span
              className={`font-display text-base sm:text-lg tracking-tight transition-colors duration-500 ${
                light ? "text-white" : "text-[var(--color-ink)]"
              }`}
            >
              Hotel Vice-Rei
            </span>
            <span
              className={`hidden sm:block text-[10px] uppercase tracking-[0.3em] transition-colors duration-500 ${
                light ? "text-white/70" : "text-[var(--color-ink-muted)]"
              }`}
            >
              Porto · Boutique
            </span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-sm">
          {navItems.map((item) => {
            const href = `/${locale}${item.href}`;
            const active =
              item.href === ""
                ? pathname === `/${locale}` || pathname === `/${locale}/`
                : pathname.startsWith(href);
            const base = light ? "text-white/80" : "text-[var(--color-ink-soft)]";
            const hover = light ? "hover:text-white" : "hover:text-[var(--color-ink)]";
            const activeCls = light
              ? "text-white"
              : "text-[var(--color-accent-deep)]";
            return (
              <Link
                key={item.labelKey}
                href={href}
                className={`relative py-2 transition-colors duration-300 ${
                  active ? activeCls : `${base} ${hover}`
                }`}
              >
                {dict.nav[item.labelKey]}
                <span
                  className={`absolute left-0 right-0 -bottom-px h-px transition-transform origin-left duration-300 ${
                    light ? "bg-white" : "bg-[var(--color-accent)]"
                  } ${active ? "scale-x-100" : "scale-x-0"}`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher current={locale} light={light} />
          <Link
            href={`/${locale}/reservar`}
            className={`hidden sm:inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-500 hover:gap-3 ${
              light
                ? "bg-white text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]"
                : "bg-[var(--color-ink)] text-white hover:bg-[var(--color-accent-deep)]"
            }`}
          >
            {dict.nav.book}
            <Icon name="arrow-right" width={14} height={14} />
          </Link>
          <button
            type="button"
            className={`lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-500 ${
              light
                ? "border border-white/30 text-white hover:bg-white/10"
                : "hairline bg-white/70 text-[var(--color-ink)]"
            }`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[var(--color-line)] bg-white">
          <nav className="container-x flex flex-col py-3">
            {navItems.map((item) => (
              <Link
                key={item.labelKey}
                href={`/${locale}${item.href}`}
                className="py-3 text-base text-[var(--color-ink-soft)] border-b border-[var(--color-line-soft)] last:border-0"
              >
                {dict.nav[item.labelKey]}
              </Link>
            ))}
            <Link
              href={`/${locale}/reservar`}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm font-medium text-white"
            >
              {dict.nav.book}
              <Icon name="arrow-right" width={14} height={14} />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
