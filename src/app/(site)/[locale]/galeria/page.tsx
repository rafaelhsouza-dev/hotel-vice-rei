import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { pageMeta, parentImages } from "@/lib/seo";
import { getGallery } from "@/lib/repo/content";
import { PageHero } from "@/components/PageHero";
import { PageBreadcrumbs } from "@/components/site/PageBreadcrumbs";
import { LightboxGallery } from "@/components/LightboxGallery";
import { lightboxLabels } from "@/components/site/labels";

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
    path: "/galeria",
    title: dict.gallery.meta.title,
    description: dict.gallery.meta.description,
    fallbackImages: await parentImages(parent),
  });
}

// Layouts only apply at md+ to keep mobile grid clean (2-col flow)
const layoutClass = [
  "md:row-span-2 md:col-span-2",
  "",
  "",
  "md:row-span-2",
  "",
  "md:col-span-2",
  "",
  "",
  "md:row-span-2",
  "",
];

export const revalidate = 300;

export default async function GalleryPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const galleryImages = await getGallery();

  return (
    <div>
      <PageHero
        eyebrow={dict.nav.gallery}
        title={dict.gallery.title}
        subtitle={dict.gallery.subtitle}
        image="/images/hero/gallery.webp"
      />

      <PageBreadcrumbs
        locale={locale}
        dict={dict}
        path="/galeria"
        crumbs={[{ label: dict.nav.gallery }]}
      />

      <section className="container-x py-16 sm:py-20 lg:py-24">
        <LightboxGallery
          labels={lightboxLabels(dict)}
          images={galleryImages.map((img, i) => ({
            src: img.src,
            // Admin alt text wins; the generic seed caption is replaced by a
            // numbered one in the page language.
            alt:
              img.alt && img.alt !== "Hotel Vice-Rei · Porto"
                ? img.alt
                : dict.gallery.photoAlt.replace("{n}", String(i + 1)),
          }))}
          className="grid grid-cols-2 md:grid-cols-4 auto-rows-[150px] sm:auto-rows-[220px] gap-2 sm:gap-3"
          layoutClass={layoutClass}
        />
      </section>
    </div>
  );
}
