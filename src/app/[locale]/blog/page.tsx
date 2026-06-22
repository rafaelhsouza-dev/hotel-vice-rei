import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { posts } from "@/data/blog";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/animations/Reveal";
import { Icon } from "@/components/Icon";

const BCP47: Record<Locale, string> = {
  pt: "pt-PT",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
};

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.blog.title, description: dict.blog.subtitle };
}

export default async function BlogPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(BCP47[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div>
      <PageHero
        eyebrow={dict.nav.blog}
        title={dict.blog.title}
        subtitle={dict.blog.subtitle}
        image="/images/hero/hero-porto.jpg"
      />

      <section className="container-x py-16 sm:py-20 lg:py-24">
        <Reveal
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
          stagger
          y={40}
        >
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/${locale}/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl bg-white hairline transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={post.image}
                  alt={post.title[locale]}
                  fill
                  className="object-cover transition-transform duration-[1.2s] group-hover:scale-110"
                  sizes="(min-width:1024px) 30vw, 100vw"
                />
                <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink)]">
                  {post.category[locale]}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                  <span>{fmt(post.date)}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {post.readingMinutes} {dict.blog.readingTime}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-2xl tracking-tight">
                  {post.title[locale]}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  {post.excerpt[locale]}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-deep)] transition-all group-hover:gap-3">
                  {dict.blog.readMore}
                  <Icon name="arrow-right" width={14} height={14} />
                </span>
              </div>
            </Link>
          ))}
        </Reveal>
      </section>
    </div>
  );
}
