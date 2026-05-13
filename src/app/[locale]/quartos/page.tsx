import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { rooms } from "@/data/hotel";
import { PageHero } from "@/components/PageHero";
import { Icon } from "@/components/Icon";

type Props = { params: Promise<{ locale: string }> };

export default async function RoomsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <div>
      <PageHero
        eyebrow={dict.nav.rooms}
        title={dict.rooms.title}
        subtitle={dict.rooms.subtitle}
        image="/images/rooms/room-double.jpg"
      />

      <section className="container-x py-16 sm:py-20 lg:py-24 flex flex-col gap-16">
        {rooms.map((room, idx) => (
          <article
            key={room.id}
            className={`grid gap-10 lg:gap-16 lg:grid-cols-2 items-center ${
              idx % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""
            }`}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
              <Image
                src={room.image}
                alt={room.name[locale]}
                fill
                className="object-cover"
                sizes="(min-width:1024px) 45vw, 100vw"
              />
              <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink)]">
                {dict.rooms.fromPrice} {room.priceFrom}€ / {dict.booking.night}
              </span>
            </div>
            <div>
              <span className="eyebrow">
                {room.size}m² · {room.capacity} {dict.rooms.people}
              </span>
              <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight">
                {room.name[locale]}
              </h2>
              <p className="mt-4 text-lg text-[var(--color-ink-soft)] leading-relaxed">
                {room.shortDescription[locale]}
              </p>
              <ul className="mt-6 grid grid-cols-2 gap-y-2 gap-x-6 text-sm text-[var(--color-ink-soft)]">
                {room.amenities[locale].slice(0, 6).map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <Icon name="check" width={14} height={14} className="text-[var(--color-accent-deep)]" />
                    {a}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/quartos/${room.slug}`}
                  className="inline-flex items-center gap-2 rounded-full hairline bg-white px-6 py-3 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-line-soft)] transition-colors"
                >
                  {dict.cta.viewDetails}
                  <Icon name="arrow-right" width={14} height={14} />
                </Link>
                <Link
                  href={`/${locale}/reservar?room=${room.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] transition-colors"
                >
                  {dict.rooms.bookThis}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
