import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getRooms, getOffers, getExtras } from "@/lib/repo/content";
import { SITE_URL } from "@/lib/site";
import { PageHero } from "@/components/PageHero";
import { ReservationFlow } from "@/components/ReservationFlow";
import { BestPriceBadge } from "@/components/BestPriceBadge";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    adults?: string;
    children?: string;
    room?: string;
    offer?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  return {
    title: dict.booking_page.title,
    description: dict.booking_page.subtitle,
    alternates: {
      canonical: `${SITE_URL}/${locale}/reservar`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${SITE_URL}/${l}/reservar`]),
        ["x-default", `${SITE_URL}/pt/reservar`],
      ]),
    },
  };
}

export default async function ReservePage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const sp = await searchParams;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  const [rooms, offers, extras] = await Promise.all([
    getRooms(),
    getOffers(),
    getExtras(),
  ]);

  const initial = {
    checkIn: sp.checkIn ?? "",
    checkOut: sp.checkOut ?? "",
    adults: sp.adults ? Number(sp.adults) : 2,
    children: sp.children ? Number(sp.children) : 0,
    roomId: sp.room ?? "",
    offerId: sp.offer ?? "",
  };

  return (
    <div>
      <PageHero
        eyebrow={dict.nav.book}
        title={dict.booking_page.title}
        subtitle={dict.booking_page.subtitle}
        image="/images/hero/booking.webp"
      />

      <section className="container-x py-20">
        <div className="mb-8">
          <BestPriceBadge dict={dict} />
        </div>
        <ReservationFlow
          locale={locale}
          dict={dict}
          rooms={rooms}
          offers={offers}
          extras={extras}
          initial={initial}
        />
      </section>
    </div>
  );
}
