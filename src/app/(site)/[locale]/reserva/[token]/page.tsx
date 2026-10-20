import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getEngineStrings } from "@/i18n/engine";
import { getBookingByToken, listCharges, buildFolio } from "@/lib/repo/bookings";
import { listBookingPayments, getPaymentSetup, type PaymentSetup } from "@/lib/payments/service";
import { feeIfCancelledToday } from "@/lib/booking/lifecycle";
import { hotelNow, penaltyFrom, addDays, type PolicySnapshot } from "@/lib/booking/pricing";
import { getHotel, getRooms } from "@/lib/repo/content";
import { getBookingRules } from "@/lib/repo/rate-plans";
import { GuestActions } from "./GuestActions";

export const dynamic = "force-dynamic";

// The link is private: never indexed, never cached by intermediaries.
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ pagamento?: string }>;
};

export default async function GuestBookingPage({ params, searchParams }: Props) {
  const { locale: raw, token } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const { pagamento } = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) notFound();

  const s = getEngineStrings(locale);
  const dict = getDictionary(locale);
  const [charges, payments, setup, hotel, rooms, rules] = await Promise.all([
    listCharges(b.id),
    listBookingPayments(b.id),
    getPaymentSetup().catch((): PaymentSetup => ({ any: false, methods: {} })),
    getHotel(),
    getRooms(),
    getBookingRules(),
  ]);
  const folio = buildFolio(b, charges);
  const room = rooms.find((r) => r.id === b.roomId);
  const policy = b.policy as Partial<PolicySnapshot>;
  const today = hotelNow().date;
  const fee = feeIfCancelledToday(b);
  const live = b.status === "pending" || b.status === "confirmed";
  const canSelfCancel = live && b.checkIn > today && fee === 0 && b.paidTotal === 0;
  const pending = payments.find((p) => p.status === "pending" && p.kind === "payment");
  const dueNow = Math.max(0, b.amountDueNow - b.paidTotal);
  const roomBalance = Math.max(0, folio.balance - b.touristTax);
  const payable = live || b.status === "checked_in" ? dueNow || (setup.any ? roomBalance : 0) : 0;
  const methods = (Object.keys(setup.methods) as ("card" | "mbway" | "multibanco")[]).filter((m) => setup.methods[m]);
  const nf = new Intl.NumberFormat({ pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" }[locale], { style: "currency", currency: "EUR" });
  const df = new Intl.DateTimeFormat({ pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" }[locale], { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const date = (d: string) => df.format(new Date(`${d}T00:00:00Z`));
  const free = policy.refundable !== undefined ? penaltyFrom(policy as PolicySnapshot, b.checkIn) : null;
  const checkinOpen = ["pending", "confirmed", "checked_in"].includes(b.status);

  return (
    <section className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{s.yourBooking}</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          {b.firstName} {b.lastName}
        </h1>
        <p className="mt-2 text-[var(--color-ink-soft)]">
          {dict.booking_page.reference} <span className="font-mono font-medium">{b.reference}</span> · {s.status[b.status] ?? b.status}
        </p>

        {pagamento === "ok" && (
          <p role="status" className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {b.paymentStatus === "paid" || b.paidTotal >= b.amountDueNow ? s.paidOk : s.paidProcessing}
          </p>
        )}
        {pagamento === "cancelado" && (
          <p role="alert" className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {s.paidCancelled}
          </p>
        )}

        <dl className="mt-8 grid gap-4 rounded-3xl bg-white p-6 hairline sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{dict.booking.checkIn}</dt>
            <dd className="font-medium">
              {date(b.checkIn)} · {rules.checkInFrom}–{rules.checkInUntil}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{dict.booking.checkOut}</dt>
            <dd className="font-medium">
              {date(b.checkOut)} · {rules.checkOutUntil}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{dict.booking.roomType}</dt>
            <dd className="font-medium">{room?.name[locale] ?? b.roomName}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{s.rate}</dt>
            <dd className="font-medium">{policy.planName?.[locale] ?? policy.planName?.pt ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
              {dict.booking.adults} / {dict.booking.children}
            </dt>
            <dd className="font-medium">
              {b.adults} + {b.children}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{s.grandTotal}</dt>
            <dd className="font-medium">
              {nf.format(folio.grandTotal)}
              <span className="block text-xs font-normal text-[var(--color-ink-muted)]">
                {s.paymentStatus[b.paymentStatus] ?? b.paymentStatus}
                {b.paidTotal > 0 ? ` · ${nf.format(b.paidTotal)}` : ""}
                {b.touristTax > 0 ? ` · ${s.touristTax}: ${nf.format(b.touristTax)} — ${s.touristTaxNote}` : ""}
              </span>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{s.cancelTitle}</dt>
            <dd className="text-sm">
              {policy.refundable === false ? s.nonRefundable : free ? (free <= today ? s.penaltyNow : `${s.refundable(policy.freeCancelDays ?? 0)} (${date(addDays(free, -1))})`) : "—"}
            </dd>
          </div>
        </dl>

        {pending?.mbReference && (
          <div className="mt-6 rounded-3xl bg-white p-6 hairline">
            <p className="font-medium">{s.methodMultibanco}</p>
            <dl className="mt-3 grid max-w-xs grid-cols-2 gap-2 text-sm">
              <dt className="text-[var(--color-ink-muted)]">Entidade</dt>
              <dd className="font-mono">{pending.mbEntity}</dd>
              <dt className="text-[var(--color-ink-muted)]">Referência</dt>
              <dd className="font-mono">{pending.mbReference.replace(/(\d{3})(?=\d)/g, "$1 ")}</dd>
              <dt className="text-[var(--color-ink-muted)]">Valor</dt>
              <dd>{nf.format(pending.amount)}</dd>
            </dl>
          </div>
        )}

        <GuestActions
          token={token}
          locale={locale}
          payable={payable > 0 && methods.length > 0 ? payable : 0}
          methods={methods}
          canSelfCancel={canSelfCancel}
          contactOnly={live && !canSelfCancel}
          phone={hotel.phones[0] ?? ""}
          email={hotel.email}
          defaultPhone={b.phone}
        />

        {checkinOpen && (
          <div className="mt-8 rounded-3xl bg-[var(--color-line-soft)] p-6">
            <p className="font-display text-xl tracking-tight">{s.checkinTitle}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{b.checkinDoneAt ? s.checkinDone : s.checkinIntro}</p>
            <Link
              href={`/${locale}/reserva/${token}/checkin`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)]"
            >
              {s.checkinCta}
            </Link>
          </div>
        )}

        <p className="mt-10 text-sm text-[var(--color-ink-muted)]">
          {hotel.name} · {hotel.address.street}, {hotel.address.postalCode} {hotel.address.city} ·{" "}
          <a href={`tel:${(hotel.phones[0] ?? "").replace(/\s/g, "")}`} className="underline">
            {hotel.phones[0]}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${hotel.email}`} className="underline">
            {hotel.email}
          </a>
        </p>
      </div>
    </section>
  );
}
