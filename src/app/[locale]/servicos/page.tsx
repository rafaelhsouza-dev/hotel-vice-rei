import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { services, hotel } from "@/data/hotel";
import { PageHero } from "@/components/PageHero";
import { Icon } from "@/components/Icon";
import { Reveal } from "@/components/animations/Reveal";

type Props = { params: Promise<{ locale: string }> };

export default async function ServicesPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <div>
      <PageHero
        eyebrow={dict.nav.services}
        title={dict.services.title}
        subtitle={dict.services.subtitle}
        image="/images/hero/featured-detail.jpg"
      />

      <section className="container-x py-16 sm:py-20 lg:py-24">
        <Reveal
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          stagger
          y={24}
        >
          {services.map((service) => (
            <div
              key={service.id}
              className="rounded-3xl bg-white hairline p-8 flex flex-col gap-4 hover:shadow-[var(--shadow-card)] hover:-translate-y-1 transition-all duration-500"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-line-soft)] text-[var(--color-accent-deep)]">
                <Icon name={service.icon} />
              </span>
              <h2 className="font-display text-2xl tracking-tight">
                {service.title[locale]}
              </h2>
              <p className="text-[var(--color-ink-soft)] leading-relaxed">
                {service.description[locale]}
              </p>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="bg-[var(--color-line-soft)]">
        <div className="container-x py-20 grid gap-10 md:grid-cols-2">
          <Reveal>
            <span className="eyebrow">{dict.services.paymentsTitle}</span>
            <h2 className="mt-4 font-display text-3xl tracking-tight">
              {dict.services.paymentsTitle}
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {hotel.paymentMethods.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-2 rounded-full bg-white hairline px-4 py-2 text-sm"
                >
                  <Icon name="shield" width={14} height={14} className="text-[var(--color-accent-deep)]" />
                  {m}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal>
            <span className="eyebrow">{dict.services.languagesTitle}</span>
            <h2 className="mt-4 font-display text-3xl tracking-tight">
              {dict.services.languagesTitle}
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {hotel.languages[locale].map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-2 rounded-full bg-white hairline px-4 py-2 text-sm"
                >
                  <Icon name="globe" width={14} height={14} className="text-[var(--color-accent-deep)]" />
                  {l}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
