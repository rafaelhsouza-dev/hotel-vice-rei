import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getRooms, getRoomBySlug, getHotel } from "@/lib/repo/content";
import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Icon } from "@/components/Icon";
import { LightboxGallery } from "@/components/LightboxGallery";
import { Panorama360 } from "@/components/Panorama360";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 300;

export async function generateStaticParams() {
  const rooms = await getRooms();
  const out: { locale: string; slug: string }[] = [];
  for (const locale of locales) {
    for (const r of rooms) out.push({ locale, slug: r.slug });
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const room = await getRoomBySlug(slug);
  if (!room) return {};

  const title = `${room.name[locale]} — ${room.size}m², até ${room.capacity} pessoas`;
  const description = room.shortDescription[locale];
  const path = `/quartos/${room.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}${path}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
        ["x-default", `${SITE_URL}/pt${path}`],
      ]),
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: `${SITE_URL}/${locale}${path}`,
      images: [{ url: `${SITE_URL}${room.image}`, width: 1200, height: 630, alt: room.name[locale] }],
    },
  };
}

export default async function RoomDetailPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const [room, hotel] = await Promise.all([getRoomBySlug(slug), getHotel()]);
  if (!room) notFound();

  return (
    <div>
      <PageHero
        eyebrow={`${room.size}m² · ${dict.rooms.sleeps} ${room.capacity}`}
        title={room.name[locale]}
        subtitle={room.shortDescription[locale]}
        image={room.image}
      />

      <Breadcrumbs
        locale={locale}
        homeLabel={dict.nav.home}
        crumbs={[
          { label: dict.nav.rooms, href: `/${locale}/quartos` },
          { label: room.name[locale] },
        ]}
      />

      <section className="container-x py-12 sm:py-16 lg:py-20 grid gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6 text-lg text-[var(--color-ink-soft)] leading-relaxed">
          {room.longDescription[locale].map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          <LightboxGallery
            className="grid grid-cols-2 gap-4 pt-6"
            aspectClass="aspect-[4/3]"
            images={room.gallery.map((src) => ({
              src,
              alt: room.name[locale],
              caption: room.name[locale],
            }))}
          />

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

      {/* 360º ROOM VIEW */}
      <section className="bg-[var(--color-line-soft)]">
        <div className="container-x py-16 sm:py-20 lg:py-24">
          <div className="max-w-2xl">
            <span className="eyebrow">{dict.gallery.panoramaEyebrow}</span>
            <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
              {dict.gallery.panoramaTitle}
            </h2>
            <p className="mt-4 text-[var(--color-ink-soft)]">
              {dict.gallery.panoramaSubtitle}
            </p>
          </div>
          <div className="mt-10">
            <Panorama360
              dict={dict}
              image={room.panorama360}
              poster={room.image}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
