import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { rooms } from "@/data/hotel";
import { PageHero } from "@/components/PageHero";
import { Icon } from "@/components/Icon";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  const out: { locale: string; slug: string }[] = [];
  for (const locale of locales) {
    for (const r of rooms) out.push({ locale, slug: r.slug });
  }
  return out;
}

export default async function RoomDetailPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const room = rooms.find((r) => r.slug === slug);
  if (!room) notFound();

  return (
    <div>
      <PageHero
        eyebrow={`${room.size}m² · ${dict.rooms.sleeps} ${room.capacity}`}
        title={room.name[locale]}
        subtitle={room.shortDescription[locale]}
        image={room.image}
      />

      <section className="container-x py-16 sm:py-20 lg:py-24 grid gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6 text-lg text-[var(--color-ink-soft)] leading-relaxed">
          {room.longDescription[locale].map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          <div className="grid grid-cols-2 gap-4 pt-6">
            {room.gallery.map((src) => (
              <div
                key={src}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl"
              >
                <Image
                  src={src}
                  alt={room.name[locale]}
                  fill
                  className="object-cover"
                  sizes="40vw"
                />
              </div>
            ))}
          </div>

          <div className="pt-6">
            <h2 className="font-display text-2xl tracking-tight text-[var(--color-ink)]">
              {dict.rooms.amenitiesTitle}
            </h2>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
              {room.amenities[locale].map((a) => (
                <li key={a} className="flex items-center gap-2 text-[var(--color-ink-soft)]">
                  <Icon name="check" width={14} height={14} className="text-[var(--color-accent-deep)]" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 self-start">
          <div className="rounded-3xl bg-white hairline p-6 shadow-[var(--shadow-card)]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
              {dict.rooms.fromPrice}
            </p>
            <p className="mt-2 font-display text-4xl">{room.priceFrom}€</p>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              {dict.booking.night} · {dict.booking.bestPrice}
            </p>

            <ul className="mt-6 space-y-2 text-sm text-[var(--color-ink-soft)]">
              <li className="flex items-center gap-2">
                <Icon name="users" width={14} height={14} className="text-[var(--color-ink-muted)]" />
                {dict.rooms.sleeps} {room.capacity} {dict.rooms.people}
              </li>
              <li className="flex items-center gap-2">
                <Icon name="bed" width={14} height={14} className="text-[var(--color-ink-muted)]" />
                {room.bed[locale]}
              </li>
              <li className="flex items-center gap-2">
                <Icon name="sparkle" width={14} height={14} className="text-[var(--color-ink-muted)]" />
                {room.size}m²
              </li>
            </ul>

            <Link
              href={`/${locale}/reservar?room=${room.id}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] transition-colors"
            >
              {dict.rooms.bookThis}
              <Icon name="arrow-right" width={14} height={14} />
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
