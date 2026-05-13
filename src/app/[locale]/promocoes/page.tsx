import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { offers } from "@/data/hotel";
import { PageHero } from "@/components/PageHero";
import { Icon } from "@/components/Icon";

type Props = { params: Promise<{ locale: string }> };

export default async function OffersPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <div>
      <PageHero
        eyebrow={dict.nav.offers}
        title={dict.offers.title}
        subtitle={dict.offers.subtitle}
        image="/images/hero/hero-porto.jpg"
      />

      <section className="container-x py-16 sm:py-20 lg:py-24 flex flex-col gap-12">
        {offers.map((offer, i) => (
          <article
            key={offer.id}
            className={`grid gap-8 lg:gap-14 lg:grid-cols-2 items-center ${
              i % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""
            }`}
          >
            <div className="relative aspect-[5/4] overflow-hidden rounded-3xl">
              <Image
                src={offer.image}
                alt={offer.title[locale]}
                fill
                className="object-cover"
                sizes="(min-width:1024px) 45vw, 100vw"
              />
              <span className="absolute top-4 left-4 rounded-full bg-[var(--color-accent)] text-[var(--color-ink)] text-[10px] uppercase tracking-[0.2em] px-3 py-1">
                {offer.badge[locale]}
              </span>
            </div>
            <div>
              <h2 className="font-display text-4xl sm:text-5xl leading-tight tracking-tight">
                {offer.title[locale]}
              </h2>
              <p className="mt-5 text-lg text-[var(--color-ink-soft)] leading-relaxed">
                {offer.description[locale]}
              </p>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                    {dict.offers.includes}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--color-ink-soft)]">
                    {offer.includes[locale].map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <Icon name="check" width={14} height={14} className="mt-1 text-[var(--color-accent-deep)]" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                    {dict.offers.conditions}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--color-ink-soft)]">
                    {offer.conditions[locale].map((c) => (
                      <li key={c} className="flex items-start gap-2">
                        <span className="mt-2 h-1 w-1 rounded-full bg-[var(--color-ink-muted)]" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                    {dict.offers.from}
                  </p>
                  <p className="font-display text-4xl mt-1">
                    {offer.priceFrom}€{" "}
                    <span className="text-xs font-sans normal-case tracking-normal text-[var(--color-ink-muted)] block sm:inline mt-1 sm:mt-0">
                      {offer.priceLabel[locale]}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/${locale}/reservar?offer=${offer.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] transition-colors"
                >
                  {dict.offers.bookOffer}
                  <Icon name="arrow-right" width={14} height={14} />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
