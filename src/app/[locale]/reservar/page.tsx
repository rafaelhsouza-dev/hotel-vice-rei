import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { rooms, offers } from "@/data/hotel";
import { PageHero } from "@/components/PageHero";
import { ReservationFlow } from "@/components/ReservationFlow";

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

export default async function ReservePage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const sp = await searchParams;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

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
        eyebrow="Booking"
        title={dict.booking_page.title}
        subtitle={dict.booking_page.subtitle}
        image="/images/hero/featured-suite.jpg"
      />

      <section className="container-x py-20">
        <ReservationFlow
          locale={locale}
          dict={dict}
          rooms={rooms}
          offers={offers}
          initial={initial}
        />
      </section>
    </div>
  );
}
