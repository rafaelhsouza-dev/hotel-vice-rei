import Image from "next/image";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { galleryImages } from "@/data/hotel";
import { PageHero } from "@/components/PageHero";

type Props = { params: Promise<{ locale: string }> };

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

export default async function GalleryPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <div>
      <PageHero
        eyebrow={dict.nav.gallery}
        title={dict.gallery.title}
        subtitle={dict.gallery.subtitle}
        image="/images/hero/hero-main.jpg"
      />

      <section className="container-x py-16 sm:py-20 lg:py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[180px] sm:auto-rows-[220px] gap-3">
          {galleryImages.map((src, i) => (
            <div
              key={src}
              className={`relative overflow-hidden rounded-2xl ${layoutClass[i] ?? ""}`}
            >
              <Image
                src={src}
                alt=""
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
                sizes="(min-width:768px) 25vw, 50vw"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
