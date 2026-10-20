import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getRooms, getRoomBySlug } from "@/lib/repo/content";
import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { BCP47, jsonLdScript, pageMeta } from "@/lib/seo";
import { HOTEL_ID } from "@/components/JsonLd";
import { PageBreadcrumbs } from "@/components/site/PageBreadcrumbs";
import { lightboxLabels } from "@/components/site/labels";
import { PageHero } from "@/components/PageHero";
import { Icon } from "@/components/Icon";
import { LightboxGallery } from "@/components/LightboxGallery";
import { Panorama360 } from "@/components/Panorama360";

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

function roomTitle(template: { many: string; one: string }, name: string, size: number, capacity: number) {
  return (capacity === 1 ? template.one : template.many)
    .replace("{name}", name)
    .replace("{size}", String(size))
    .replace("{n}", String(capacity));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const room = await getRoomBySlug(slug);
  if (!room) return {};
  const dict = getDictionary(locale);

  return pageMeta({
    locale,
    path: `/quartos/${room.slug}`,
    title: roomTitle(
      { many: dict.rooms.roomTitle, one: dict.rooms.roomTitleOne },
      room.name[locale],
      room.size,
      room.capacity,
    ),
    description: room.shortDescription[locale],
    image: room.image,
    imageAlt: room.name[locale],
  });
}

export default async function RoomDetailPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const room = await getRoomBySlug(slug);
  if (!room) notFound();
  const url = `${SITE_URL}/${locale}/quartos/${room.slug}`;

  const roomLd = {
    "@context": "https://schema.org",
    "@type": "HotelRoom",
    "@id": `${url}#room`,
    name: room.name[locale],
    description: room.shortDescription[locale],
    url,
    image: room.gallery.length
      ? room.gallery.map((src) => `${SITE_URL}${src}`)
      : `${SITE_URL}${room.image}`,
    bed: { "@type": "BedDetails", typeOfBed: room.bed[locale] },
    occupancy: { "@type": "QuantitativeValue", maxValue: room.capacity, unitText: "person" },
    floorSize: { "@type": "QuantitativeValue", value: room.size, unitCode: "MTK" },
    amenityFeature: room.amenities[locale].map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
    containedInPlace: { "@id": HOTEL_ID },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/${locale}/reservar?room=${room.id}`,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        minPrice: room.priceFrom,
        priceCurrency: "EUR",
        unitText: "night",
      },
    },
  };

  return (
    <div>
      <PageHero
        eyebrow={`${room.size}m² · ${dict.rooms.sleeps} ${room.capacity}`}
        title={room.name[locale]}
        subtitle={room.shortDescription[locale]}
        image={room.image}
      />

      <PageBreadcrumbs
        locale={locale}
        dict={dict}
        path={`/quartos/${room.slug}`}
        crumbs={[
          { label: dict.nav.rooms, href: `/${locale}/quartos` },
          { label: room.name[locale] },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(roomLd)} />

      <section className="container-x py-12 sm:py-16 lg:py-20 grid gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6 text-lg text-[var(--color-ink-soft)] leading-relaxed">
          {room.longDescription[locale].map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          <LightboxGallery
            className="grid grid-cols-2 gap-3 pt-6 sm:gap-4"
            aspectClass="aspect-[4/3]"
            labels={lightboxLabels(dict)}
            images={room.gallery.map((src, i) => ({
              src,
              alt: `${room.name[locale]} — ${dict.a11y.photo.replace("{n}", String(i + 1))}`,
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
            <p className="mt-2 font-display text-4xl">{new Intl.NumberFormat(BCP47[locale], { style: "currency", currency: "EUR" }).format(room.priceFrom)}</p>
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

      {/* 360º ROOM VIEW — only for rooms that have their own panorama. */}
      {room.panorama360 && (
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
      )}
    </div>
  );
}
