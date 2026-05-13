import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { PageHero } from "@/components/PageHero";
import { Icon } from "@/components/Icon";
import { Reveal } from "@/components/animations/Reveal";

type Props = { params: Promise<{ locale: string }> };

export default async function AboutPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <div>
      <PageHero
        eyebrow={dict.about.subtitle}
        title={dict.about.title}
        image="/images/hero/featured-lobby.jpg"
      />

      <section className="container-x py-16 sm:py-20 lg:py-24 grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-7" stagger y={20}>
          <span className="eyebrow">{dict.about.intro}</span>
          <p className="mt-4 font-display text-3xl sm:text-4xl leading-tight tracking-tight text-[var(--color-ink)]">
            {dict.about.tagline}
          </p>
          <div className="mt-8 space-y-6 text-lg text-[var(--color-ink-soft)] leading-relaxed">
            {dict.about.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Reveal>
        <aside className="lg:col-span-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative aspect-[3/4] overflow-hidden rounded-3xl">
              <Image
                src="/images/hero/featured-detail.jpg"
                alt=""
                fill
                className="object-cover"
                sizes="(min-width:1024px) 25vw, 50vw"
              />
            </div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-3xl mt-10">
              <Image
                src="/images/hero/featured-suite.jpg"
                alt=""
                fill
                className="object-cover"
                sizes="(min-width:1024px) 25vw, 50vw"
              />
            </div>
          </div>
        </aside>
      </section>

      <section className="bg-white">
        <div className="container-x py-16 sm:py-20 lg:py-24">
          <div className="max-w-2xl">
            <span className="eyebrow">Hotel Vice-Rei</span>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl leading-tight tracking-tight">
              {dict.about.highlightsTitle}
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {dict.about.highlights.map((h, i) => (
              <div
                key={i}
                className="rounded-3xl hairline p-6 bg-[var(--color-bg)] flex flex-col gap-3"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--color-accent-deep)]">
                  <Icon name={["map", "concierge", "sparkle", "shield"][i] as never} />
                </span>
                <h3 className="font-display text-xl tracking-tight">
                  {h.title}
                </h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  {h.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-16 sm:py-20 lg:py-24">
        <div className="rounded-3xl bg-[var(--color-ink)] text-white p-10 sm:p-14 flex flex-col lg:flex-row items-start lg:items-center gap-8 justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight">
              {dict.home.location.title}
            </h2>
            <p className="mt-3 text-white/75">{dict.home.location.body}</p>
          </div>
          <Link
            href={`/${locale}/reservar`}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)] transition-colors"
          >
            {dict.cta.bookDirect}
            <Icon name="arrow-right" width={14} height={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
