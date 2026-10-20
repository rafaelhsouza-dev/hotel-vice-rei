import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { BCP47, jsonLdScript, pageMeta } from "@/lib/seo";
import { getDictionary } from "@/i18n";
import { getPosts, getPostBySlug } from "@/lib/repo/content";
import { SITE_URL } from "@/lib/site";
import { PageHero } from "@/components/PageHero";
import { ShareButtons } from "@/components/ShareButtons";
import { Icon } from "@/components/Icon";
import { PageBreadcrumbs } from "@/components/site/PageBreadcrumbs";
import { getHotel } from "@/lib/repo/content";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 300;

export async function generateStaticParams() {
  const posts = await getPosts();
  const out: { locale: string; slug: string }[] = [];
  for (const locale of locales) {
    for (const p of posts) out.push({ locale, slug: p.slug });
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = await getPostBySlug(slug);
  if (!post) return {};

  return pageMeta({
    locale,
    path: `/blog/${post.slug}`,
    title: post.title[locale],
    description: post.excerpt[locale],
    image: post.image,
    imageAlt: post.title[locale],
    type: "article",
    publishedTime: post.date,
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const [post, posts, hotel] = await Promise.all([
    getPostBySlug(slug),
    getPosts(),
    getHotel(),
  ]);
  if (!post) notFound();

  const fmt = new Date(post.date).toLocaleDateString(BCP47[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const url = `${SITE_URL}/${locale}/blog/${post.slug}`;
  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div>
      <PageHero
        eyebrow={post.category[locale]}
        title={post.title[locale]}
        image={post.image}
      />

      <PageBreadcrumbs
        locale={locale}
        dict={dict}
        path={`/blog/${post.slug}`}
        crumbs={[
          { label: dict.nav.blog, href: `/${locale}/blog` },
          { label: post.title[locale] },
        ]}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title[locale],
          description: post.excerpt[locale],
          image: [`${SITE_URL}${post.image}`],
          datePublished: post.date,
          dateModified: post.date,
          inLanguage: BCP47[locale],
          articleSection: post.category[locale],
          wordCount: post.body[locale].join(" ").split(/\s+/).length,
          url,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          author: { "@type": "Organization", name: hotel.name, url: SITE_URL },
          publisher: {
            "@type": "Organization",
            name: hotel.name,
            logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-hotel-vice-rei.png` },
          },
          about: { "@id": `${SITE_URL}/#hotel` },
        })}
      />

      <section className="container-x py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-line)] pb-6">
            <div className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <span>
                {dict.blog.published} {fmt}
              </span>
              <span aria-hidden>·</span>
              <span>
                {post.readingMinutes} {dict.blog.readingTime}
              </span>
            </div>
            <ShareButtons dict={dict} url={url} title={post.title[locale]} />
          </div>

          <div className="mt-8 space-y-6 text-lg leading-relaxed text-[var(--color-ink-soft)]">
            {post.body[locale].map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-deep)] hover:text-[var(--color-ink)]"
            >
              <Icon
                name="chevron-right"
                width={14}
                height={14}
                className="rotate-180"
              />
              {dict.blog.backToBlog}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-line-soft)]">
        <div className="container-x py-16">
          <h2 className="font-display text-2xl tracking-tight">
            {dict.blog.related}
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/${locale}/blog/${p.slug}`}
                className="group flex gap-4 rounded-2xl bg-white hairline p-4 transition-all hover:shadow-[var(--shadow-card)]"
              >
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={p.image}
                    alt={p.title[locale]}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="112px"
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                    {p.category[locale]}
                  </p>
                  <p className="mt-1 font-display text-lg leading-tight tracking-tight">
                    {p.title[locale]}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
