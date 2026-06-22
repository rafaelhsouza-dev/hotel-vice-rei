import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { rooms } from "@/data/hotel";
import { Icon } from "@/components/Icon";

type Props = { params: Promise<{ locale: string }> };

const BCP47: Record<Locale, string> = {
  pt: "pt-PT",
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
};

type Status = "confirmed" | "pending" | "checkedIn";

const bookings: {
  guest: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: Status;
  total: number;
}[] = [
  { guest: "Sophie Laurent", roomId: "twin-double", checkIn: "2026-06-24", checkOut: "2026-06-27", status: "checkedIn", total: 168 },
  { guest: "Marco Bianchi", roomId: "single-superior", checkIn: "2026-06-24", checkOut: "2026-06-26", status: "confirmed", total: 92 },
  { guest: "Anna Schmidt", roomId: "romantic", checkIn: "2026-06-25", checkOut: "2026-06-28", status: "confirmed", total: 180 },
  { guest: "James Carter", roomId: "triple", checkIn: "2026-06-25", checkOut: "2026-06-27", status: "pending", total: 124 },
  { guest: "Inês Ferreira", roomId: "twin-double-superior", checkIn: "2026-06-26", checkOut: "2026-06-29", status: "confirmed", total: 168 },
  { guest: "Pedro Gómez", roomId: "single", checkIn: "2026-06-27", checkOut: "2026-06-28", status: "pending", total: 43 },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.backoffice.title, description: dict.backoffice.subtitle, robots: { index: false } };
}

export default async function BackofficePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(BCP47[locale], { day: "2-digit", month: "short" });
  const roomName = (id: string) =>
    rooms.find((r) => r.id === id)?.name[locale] ?? id;

  const kpis = [
    { label: dict.backoffice.kpiReservations, value: "128", icon: "calendar" as const },
    { label: dict.backoffice.kpiOccupancy, value: "82%", icon: "bed" as const },
    { label: dict.backoffice.kpiRevenue, value: "€41.6k", icon: "shield" as const },
    { label: dict.backoffice.kpiArrivals, value: "9", icon: "users" as const },
  ];

  const statusStyles: Record<Status, string> = {
    confirmed: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
    pending: "bg-[var(--color-accent)]/15 text-[var(--color-accent-deep)]",
    checkedIn: "bg-[var(--color-ink)]/10 text-[var(--color-ink)]",
  };
  const statusLabel: Record<Status, string> = {
    confirmed: dict.backoffice.statusConfirmed,
    pending: dict.backoffice.statusPending,
    checkedIn: dict.backoffice.statusCheckedIn,
  };

  return (
    <div>
      {/* Dark band sits behind the fixed header so its white text stays readable */}
      <section className="bg-[var(--color-ink)] text-white">
        <div className="container-x pt-28 pb-12 sm:pt-32">
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
            <span aria-hidden className="h-px w-6 bg-[var(--color-accent-soft)]" />
            {dict.backoffice.title}
          </span>
          <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
            {dict.backoffice.subtitle}
          </h1>
        </div>
      </section>

      <div className="container-x py-10 sm:py-12">
        <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm text-[var(--color-accent-deep)]">
        {dict.backoffice.demoNote}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-3xl bg-white hairline p-6 shadow-[var(--shadow-card)]">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-line-soft)] text-[var(--color-accent-deep)]">
              <Icon name={k.icon} width={18} height={18} />
            </span>
            <p className="mt-4 font-display text-3xl">{k.value}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
              {k.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl tracking-tight">
          {dict.backoffice.upcoming}
        </h2>
        <div className="mt-4 overflow-x-auto scroll-bar-thin rounded-3xl bg-white hairline">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink-muted)]">
                <th className="px-5 py-4 font-medium">{dict.backoffice.guest}</th>
                <th className="px-5 py-4 font-medium">{dict.backoffice.room}</th>
                <th className="px-5 py-4 font-medium">{dict.backoffice.checkIn}</th>
                <th className="px-5 py-4 font-medium">{dict.backoffice.checkOut}</th>
                <th className="px-5 py-4 font-medium">{dict.backoffice.status}</th>
                <th className="px-5 py-4 font-medium text-right">{dict.backoffice.total}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--color-line-soft)] last:border-0 hover:bg-[var(--color-line-soft)]/40"
                >
                  <td className="px-5 py-4 font-medium text-[var(--color-ink)]">{b.guest}</td>
                  <td className="px-5 py-4 text-[var(--color-ink-soft)]">{roomName(b.roomId)}</td>
                  <td className="px-5 py-4 text-[var(--color-ink-soft)]">{fmt(b.checkIn)}</td>
                  <td className="px-5 py-4 text-[var(--color-ink-soft)]">{fmt(b.checkOut)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyles[b.status]}`}>
                      {statusLabel[b.status]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium">{b.total}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
