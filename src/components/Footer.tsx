import Link from "next/link";
import { hotel } from "@/data/hotel";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";

export function Footer({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <footer className="mt-32 bg-[var(--color-ink)] text-white">
      <div className="container-x py-20 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-ink)] font-display text-xl">
              V
            </span>
            <div>
              <p className="font-display text-xl tracking-tight">
                Hotel Vice-Rei
              </p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                Porto · Boutique
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/70">
            {hotel.brandTagline[locale]}.
          </p>
          <p className="mt-6 text-xs text-white/50">
            {dict.services.languagesTitle}:{" "}
            <span className="text-white/80">
              {hotel.languages[locale].join(" · ")}
            </span>
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a
              href={hotel.social.facebook}
              aria-label="Facebook"
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-colors"
            >
              <Icon name="facebook" width={14} height={14} />
            </a>
            <a
              href={hotel.social.instagram}
              aria-label="Instagram"
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-colors"
            >
              <Icon name="instagram" width={14} height={14} />
            </a>
          </div>
        </div>

        <div className="lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">
            {dict.footer.quickLinks}
          </p>
          <ul className="mt-5 space-y-3">
            {[
              { href: "", k: "home" as const },
              { href: "/apresentacao", k: "about" as const },
              { href: "/quartos", k: "rooms" as const },
              { href: "/servicos", k: "services" as const },
              { href: "/promocoes", k: "offers" as const },
              { href: "/galeria", k: "gallery" as const },
              { href: "/contactos", k: "contact" as const },
            ].map((it) => (
              <li key={it.k}>
                <Link
                  href={`/${locale}${it.href}`}
                  className="text-sm text-white/80 hover:text-white transition-colors"
                >
                  {dict.nav[it.k]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">
            {dict.footer.contactUs}
          </p>
          <ul className="mt-5 space-y-3 text-sm text-white/80">
            <li className="flex items-start gap-3">
              <Icon
                name="map"
                width={16}
                height={16}
                className="mt-0.5 text-white/60"
              />
              <span>
                {hotel.address.street}
                <br />
                {hotel.address.postalCode} {hotel.address.city}
              </span>
            </li>
            {hotel.phones.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <Icon name="phone" width={16} height={16} className="text-white/60" />
                <a
                  href={`tel:${p.replace(/\s+/g, "")}`}
                  className="hover:text-white"
                >
                  {p}
                </a>
              </li>
            ))}
            <li className="flex items-center gap-3">
              <Icon name="mail" width={16} height={16} className="text-white/60" />
              <a href={`mailto:${hotel.email}`} className="hover:text-white">
                {hotel.email}
              </a>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">
            {dict.footer.legal}
          </p>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <a
                href={hotel.legal.complaintsBook}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
              >
                <Icon name="shield" width={14} height={14} className="text-[var(--color-accent-soft)]" />
                {dict.footer.complaintsBook}
                <Icon
                  name="arrow-right"
                  width={12}
                  height={12}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </a>
            </li>
            <li>
              <a
                href={hotel.legal.cleanSafe}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
              >
                <Icon name="check" width={14} height={14} className="text-[var(--color-accent-soft)]" />
                {dict.footer.cleanSafe}
                <Icon
                  name="arrow-right"
                  width={12}
                  height={12}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </a>
            </li>
            <li>
              <Link
                href={`/${locale}/reservar`}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)] transition-colors"
              >
                {dict.cta.bookDirect}
                <Icon name="arrow-right" width={14} height={14} />
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x py-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-white/50">
          <p>
            © {hotel.legal.copyrightYear}–{new Date().getFullYear()}{" "}
            {hotel.name}. {dict.footer.rights}
          </p>
          <p className="flex items-center gap-3">
            <a
              href={hotel.legal.complaintsBook}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white/80"
            >
              {dict.footer.complaintsBook}
            </a>
            <span aria-hidden>·</span>
            <a
              href={hotel.legal.cleanSafe}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white/80"
            >
              {dict.footer.cleanSafe}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
