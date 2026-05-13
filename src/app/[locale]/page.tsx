import Image from "next/image";
import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { rooms, services, offers, testimonials, hotel } from "@/data/hotel";
import { HeroHome } from "@/components/HeroHome";
import { Icon } from "@/components/Icon";
import { Reveal } from "@/components/animations/Reveal";
import { Counter } from "@/components/animations/Counter";
import { Marquee } from "@/components/animations/Marquee";
import { Parallax } from "@/components/animations/Parallax";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  const featuredRooms = rooms.slice(0, 3);

  return (
    <div>
      <HeroHome locale={locale} dict={dict} />

      {/* MARQUEE STRIP */}
      <section className="bg-[var(--color-ink)] text-white py-4 sm:py-5 border-y border-white/5">
        <Marquee
          speed={60}
          items={services.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 sm:gap-3 font-display text-sm sm:text-lg lg:text-xl tracking-tight text-white/80"
            >
              <Icon
                name={s.icon}
                width={16}
                height={16}
                className="text-[var(--color-accent-soft)]"
              />
              {s.title[locale]}
            </span>
          ))}
        />
      </section>

      {/* INTRO */}
      <section className="container-x py-16 sm:py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12 items-center">
          <Reveal as="div" className="lg:col-span-5" stagger>
            <span className="eyebrow">{dict.home.intro.eyebrow}</span>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight text-balance">
              {dict.home.intro.title}
            </h2>
            <p className="mt-6 text-lg text-[var(--color-ink-soft)] leading-relaxed">
              {dict.home.intro.body}
            </p>
            <Link
              href={`/${locale}/apresentacao`}
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-deep)] hover:text-[var(--color-ink)] transition-colors group"
            >
              {dict.cta.learnMore}
              <span className="transition-transform group-hover:translate-x-1">
                <Icon name="arrow-right" width={14} height={14} />
              </span>
            </Link>
          </Reveal>

          <div className="lg:col-span-7 grid grid-cols-2 gap-4">
            <Parallax amount={40}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl group">
                <Image
                  src="/images/hero/featured-lobby.jpg"
                  alt=""
                  fill
                  className="object-cover transition-transform duration-[1.4s] group-hover:scale-105"
                  sizes="(min-width:1024px) 30vw, 50vw"
                />
              </div>
            </Parallax>
            <div className="flex flex-col gap-4">
              <Parallax amount={20}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl group">
                  <Image
                    src="/images/hero/featured-suite.jpg"
                    alt=""
                    fill
                    className="object-cover transition-transform duration-[1.4s] group-hover:scale-105"
                    sizes="(min-width:1024px) 30vw, 50vw"
                  />
                </div>
              </Parallax>
              <Reveal className="rounded-3xl bg-[var(--color-line-soft)] p-6 flex flex-col gap-4" y={20}>
                {dict.home.intro.stats.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] last:border-0 pb-3 last:pb-0"
                  >
                    <Counter
                      value={s.value}
                      className="font-display text-3xl text-[var(--color-ink)]"
                    />
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)] text-right">
                      {s.label}
                    </span>
                  </div>
                ))}
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ROOMS */}
      <section className="bg-white">
        <div className="container-x py-16 sm:py-20 lg:py-28">
          <Reveal className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <span className="eyebrow">{dict.home.rooms.eyebrow}</span>
              <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight">
                {dict.home.rooms.title}
              </h2>
              <p className="mt-4 max-w-xl text-[var(--color-ink-soft)]">
                {dict.home.rooms.body}
              </p>
            </div>
            <Link
              href={`/${locale}/quartos`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-deep)] hover:text-[var(--color-ink)] transition-colors group"
            >
              {dict.cta.seeRooms}
              <span className="transition-transform group-hover:translate-x-1">
                <Icon name="arrow-right" width={14} height={14} />
              </span>
            </Link>
          </Reveal>

          <Reveal
            className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            stagger
            y={40}
          >
            {featuredRooms.map((room) => (
              <Link
                key={room.id}
                href={`/${locale}/quartos/${room.slug}`}
                className="group flex flex-col rounded-3xl hairline overflow-hidden bg-white hover:shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 duration-500"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={room.image}
                    alt={room.name[locale]}
                    fill
                    className="object-cover transition-transform duration-[1.2s] group-hover:scale-110"
                    sizes="(min-width:1024px) 30vw, 100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink)]">
                    {dict.rooms.fromPrice} {room.priceFrom}€
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-display text-2xl tracking-tight">
                    {room.name[locale]}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed flex-1">
                    {room.shortDescription[locale]}
                  </p>
                  <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="users" width={14} height={14} /> {room.capacity} {dict.rooms.people}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="bed" width={14} height={14} />
                    </span>
                    <span>{room.size}m²</span>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-deep)] group-hover:gap-3 transition-all">
                    {dict.cta.viewDetails}
                    <Icon name="arrow-right" width={14} height={14} />
                  </span>
                </div>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>

      {/* SERVICES GRID */}
      <section className="container-x py-16 sm:py-20 lg:py-28">
        <Reveal className="max-w-2xl">
          <span className="eyebrow">{dict.home.services.eyebrow}</span>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight">
            {dict.home.services.title}
          </h2>
        </Reveal>
        <Reveal
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--color-line)] rounded-3xl overflow-hidden hairline"
          stagger
          y={20}
        >
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-[var(--color-bg)] p-7 sm:p-8 flex flex-col gap-3 hover:bg-white transition-colors group"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white hairline text-[var(--color-accent-deep)] group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-ink)] transition-colors duration-500">
                <Icon name={service.icon} />
              </span>
              <h3 className="font-display text-xl tracking-tight">
                {service.title[locale]}
              </h3>
              <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                {service.description[locale]}
              </p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* OFFERS */}
      <section className="relative bg-[var(--color-ink)] text-white overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[var(--color-accent)]/15 blur-3xl"
        />
        <div className="relative container-x py-16 sm:py-20 lg:py-28">
          <Reveal className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <span className="eyebrow text-[var(--color-accent-soft)] before:bg-[var(--color-accent-soft)]">
                {dict.home.offers.eyebrow}
              </span>
              <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight">
                {dict.home.offers.title}
              </h2>
            </div>
            <Link
              href={`/${locale}/promocoes`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-soft)] hover:text-white transition-colors group"
            >
              {dict.cta.seeOffers}
              <span className="transition-transform group-hover:translate-x-1">
                <Icon name="arrow-right" width={14} height={14} />
              </span>
            </Link>
          </Reveal>

          <Reveal
            className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            stagger
            y={40}
          >
            {offers.map((offer) => (
              <article
                key={offer.id}
                className="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 hover:border-white/30 transition-all duration-500 flex flex-col hover:-translate-y-1"
              >
                <div className="relative aspect-[5/4] overflow-hidden">
                  <Image
                    src={offer.image}
                    alt={offer.title[locale]}
                    fill
                    className="object-cover opacity-90 group-hover:scale-110 group-hover:opacity-100 transition-all duration-[1.2s]"
                    sizes="(min-width:1024px) 30vw, 100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className="absolute top-4 left-4 rounded-full bg-[var(--color-accent)] text-[var(--color-ink)] text-[10px] uppercase tracking-[0.2em] px-3 py-1">
                    {offer.badge[locale]}
                  </span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-display text-2xl tracking-tight text-white">
                    {offer.title[locale]}
                  </h3>
                  <p className="mt-3 text-sm text-white/75 leading-relaxed flex-1">
                    {offer.description[locale]}
                  </p>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                        {dict.offers.from}
                      </p>
                      <p className="font-display text-3xl mt-1">
                        {offer.priceFrom}€
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/reservar?offer=${offer.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)] transition-colors"
                    >
                      {dict.offers.bookOffer}
                      <Icon name="arrow-right" width={12} height={12} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="container-x py-16 sm:py-20 lg:py-28">
        <Reveal className="max-w-2xl">
          <span className="eyebrow">{dict.home.testimonials.eyebrow}</span>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight">
            {dict.home.testimonials.title}
          </h2>
        </Reveal>
        <Reveal
          className="mt-12 grid gap-6 md:grid-cols-3"
          stagger
          y={30}
        >
          {testimonials.map((t) => (
            <figure
              key={t.id}
              className="rounded-3xl bg-white hairline p-8 flex flex-col gap-4 hover:shadow-[var(--shadow-card)] transition-shadow duration-500"
            >
              <div className="flex items-center gap-1 text-[var(--color-accent)]">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Icon key={i} name="star" width={14} height={14} />
                ))}
              </div>
              <blockquote className="font-display text-xl leading-snug tracking-tight">
                “{t.quote[locale]}”
              </blockquote>
              <figcaption className="mt-auto text-sm">
                <p className="font-medium">{t.author}</p>
                <p className="text-[var(--color-ink-muted)] text-xs">
                  {t.origin[locale]}
                </p>
              </figcaption>
            </figure>
          ))}
        </Reveal>
      </section>

      {/* LOCATION */}
      <section className="bg-[var(--color-line-soft)]">
        <div className="container-x py-16 sm:py-20 lg:py-28 grid gap-12 lg:grid-cols-2 items-center">
          <Reveal stagger>
            <span className="eyebrow">{dict.home.location.eyebrow}</span>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight">
              {dict.home.location.title}
            </h2>
            <p className="mt-6 text-lg text-[var(--color-ink-soft)] leading-relaxed">
              {dict.home.location.body}
            </p>
            <div className="mt-8 grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-white p-5 hairline">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                  {dict.contact.address}
                </p>
                <p className="mt-2 font-medium">
                  {hotel.address.street}
                  <br />
                  {hotel.address.postalCode} {hotel.address.city}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 hairline">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                  {dict.contact.phone}
                </p>
                <p className="mt-2 font-medium">{hotel.phones[0]}</p>
              </div>
            </div>
            <Link
              href={`/${locale}/contactos`}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] transition-colors group"
            >
              {dict.cta.contact}
              <span className="transition-transform group-hover:translate-x-1">
                <Icon name="arrow-right" width={14} height={14} />
              </span>
            </Link>
          </Reveal>
          <Reveal y={30}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl hairline bg-white">
              <iframe
                title="Map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=-8.636,41.153,-8.620,41.163&layer=mapnik&marker=${hotel.coords.lat},${hotel.coords.lng}`}
                className="absolute inset-0 h-full w-full"
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
