import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getEngineStrings } from "@/i18n/engine";
import { getBookingByToken, listGuests } from "@/lib/repo/bookings";
import { ISO_COUNTRIES } from "@/lib/siba/countries";
import { CheckinForm } from "./CheckinForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Country names in the guest's language, from the ISO list. */
function countryOptions(locale: Locale) {
  const names = new Intl.DisplayNames([locale === "pt" ? "pt-PT" : locale], { type: "region" });
  return ISO_COUNTRIES.map((c) => {
    let name = c.namePt;
    try {
      name = names.of(c.alpha2) ?? c.namePt;
    } catch {
      /* keep the Portuguese name */
    }
    return { code: c.alpha3, name };
  }).sort((a, b) => a.name.localeCompare(b.name, locale));
}

export default async function CheckinPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: raw, token } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const s = getEngineStrings(locale);
  const open = ["pending", "confirmed", "checked_in"].includes(b.status);
  const guests = await listGuests(b.id);
  const rows = Math.min(10, Math.max(guests.length, b.adults + b.children, 1));

  return (
    <section className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Link href={`/${locale}/reserva/${token}`} className="text-sm text-[var(--color-ink-muted)] hover:underline">
          ← {s.yourBooking} {b.reference}
        </Link>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">{s.checkinTitle}</h1>
        {!open ? (
          <p className="mt-6 rounded-2xl bg-[var(--color-line-soft)] p-5">{s.checkinClosed}</p>
        ) : (
          <>
            <p className="mt-3 text-[var(--color-ink-soft)]">{s.checkinIntro}</p>
            {b.checkinDoneAt && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{s.checkinDone}</p>}
            <CheckinForm
              token={token}
              locale={locale}
              rows={rows}
              countries={countryOptions(locale)}
              eta={b.eta}
              guests={guests.map((g) => ({
                firstName: g.firstName,
                lastName: g.lastName,
                nationality: g.nationality,
                birthDate: g.birthDate ?? "",
                birthPlace: g.birthPlace,
                documentType: g.documentType || "P",
                documentNumber: g.documentNumber,
                documentCountry: g.documentCountry,
                residenceCountry: g.residenceCountry,
                residenceCity: g.residenceCity,
              }))}
              primary={{ firstName: b.firstName, lastName: b.lastName }}
            />
          </>
        )}
      </div>
    </section>
  );
}
