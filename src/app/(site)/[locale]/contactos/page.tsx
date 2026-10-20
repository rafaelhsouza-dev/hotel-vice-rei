import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { pageMeta, parentImages } from "@/lib/seo";
import { getHotel, getPois } from "@/lib/repo/content";
import { PageHero } from "@/components/PageHero";
import { PageBreadcrumbs } from "@/components/site/PageBreadcrumbs";
import { Icon } from "@/components/Icon";
import { ContactForm } from "@/components/ContactForm";
import { PoiMap } from "@/components/map/PoiMap";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMeta({
    locale,
    path: "/contactos",
    title: dict.contact.meta.title,
    description: dict.contact.meta.description,
    fallbackImages: await parentImages(parent),
  });
}

export const revalidate = 300;

export default async function ContactPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const [hotel, pois] = await Promise.all([getHotel(), getPois()]);
  const address = `${hotel.name}, ${hotel.address.street}, ${hotel.address.postalCode} ${hotel.address.city}`;

  return (
    <div>
      <PageHero
        eyebrow={dict.nav.contact}
        title={dict.contact.title}
        subtitle={dict.contact.subtitle}
        image="/images/hero/contact.webp"
      />

      <PageBreadcrumbs
        locale={locale}
        dict={dict}
        path="/contactos"
        crumbs={[{ label: dict.nav.contact }]}
      />

      <section className="container-x py-16 sm:py-20 lg:py-24 grid gap-12 lg:grid-cols-12">
        <aside className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl bg-white hairline p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
              {dict.contact.address}
            </p>
            <p className="mt-3 font-display text-xl tracking-tight leading-snug sm:text-2xl">
              {hotel.address.street}
              <br />
              {hotel.address.postalCode} {hotel.address.city}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              {hotel.address.country[locale]}
            </p>
          </div>

          <div className="rounded-3xl bg-white hairline p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-line-soft)] text-[var(--color-accent-deep)]">
                <Icon name="phone" />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                  {dict.contact.phone}
                </p>
                {hotel.phones.map((p) => (
                  <a
                    key={p}
                    href={`tel:${p.replace(/\s+/g, "")}`}
                    className="block font-medium hover:text-[var(--color-accent-deep)] transition-colors"
                  >
                    {p}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-line-soft)] text-[var(--color-accent-deep)]">
                <Icon name="mail" />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                  {dict.contact.email}
                </p>
                <a
                  href={`mailto:${hotel.email}`}
                  className="break-all font-medium hover:text-[var(--color-accent-deep)] transition-colors"
                >
                  {hotel.email}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-line-soft)] text-[var(--color-accent-deep)]">
                <Icon name="reception24" />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                  {dict.contact.hours}
                </p>
                <p className="font-medium">24/7</p>
                <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                  {dict.contact.callRate}
                </p>
              </div>
            </div>
            <a
              href="https://www.metrodoporto.pt/uploads/document/file/47/MetroPorto.pdf"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 rounded-full hairline bg-white px-4 py-2.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)] transition-colors"
            >
              <Icon name="map" width={14} height={14} className="text-[var(--color-accent-deep)]" />
              {dict.contact.metroMap}
            </a>
          </div>
        </aside>

        <div className="lg:col-span-7">
          <div className="rounded-3xl bg-white hairline p-5 sm:p-10">
            <h2 className="font-display text-3xl tracking-tight">
              {dict.contact.formTitle}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              {dict.contact.subtitle}
            </p>
            <ContactForm dict={dict} locale={locale} />
          </div>
        </div>
      </section>

      <section aria-labelledby="mapa" className="bg-[var(--color-line-soft)]">
        <div className="container-x py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">{dict.map.eyebrow}</span>
          <h2 id="mapa" className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
            {dict.map.title}
          </h2>
          <div className="mt-8">
            <PoiMap
              locale={locale}
              dict={dict}
              hotel={{ name: hotel.name, lat: hotel.coords.lat, lng: hotel.coords.lng, address }}
              pois={pois}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
