import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/animations/Reveal";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.accessibility.title,
    description: dict.accessibility.subtitle,
  };
}

export default async function AccessibilityPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <div>
      <PageHero
        eyebrow={dict.footer.legal}
        title={dict.accessibility.title}
        subtitle={dict.accessibility.subtitle}
        image="/images/hero/featured-lobby.jpg"
      />

      <section className="container-x py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
            {dict.accessibility.updated}
          </p>
          <div className="mt-8 space-y-10">
            {dict.accessibility.sections.map((s) => (
              <Reveal key={s.heading} y={20}>
                <h2 className="font-display text-2xl tracking-tight">
                  {s.heading}
                </h2>
                <p className="mt-3 leading-relaxed text-[var(--color-ink-soft)]">
                  {s.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
