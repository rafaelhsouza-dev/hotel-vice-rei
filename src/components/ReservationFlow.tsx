"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import type { Offer, Room } from "@/data/hotel";
import { Icon } from "./Icon";

type Initial = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomId: string;
  offerId: string;
};

function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.round(ms / 86_400_000);
}

function todayPlus(d: number) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}

export function ReservationFlow({
  locale,
  dict,
  rooms,
  offers,
  initial,
}: {
  locale: Locale;
  dict: Dictionary;
  rooms: Room[];
  offers: Offer[];
  initial: Initial;
}) {
  const [step, setStep] = useState(initial.roomId ? 1 : 0);
  const [done, setDone] = useState(false);
  const [checkIn, setCheckIn] = useState(initial.checkIn || todayPlus(1));
  const [checkOut, setCheckOut] = useState(initial.checkOut || todayPlus(3));
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [roomId, setRoomId] = useState(initial.roomId);
  const offer = useMemo(
    () => offers.find((o) => o.id === initial.offerId),
    [offers, initial.offerId],
  );
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");

  const nights = nightsBetween(checkIn, checkOut);
  const selectedRoom = rooms.find((r) => r.id === roomId);
  const total =
    selectedRoom && nights > 0 ? selectedRoom.priceFrom * nights : 0;

  const steps = [
    dict.booking_page.step1,
    dict.booking_page.step2,
    dict.booking_page.step3,
    dict.booking_page.step4,
  ];

  function next() {
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto rounded-3xl bg-white hairline p-8 sm:p-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--color-success)] text-white">
          <Icon name="check" width={24} height={24} />
        </span>
        <h2 className="mt-6 font-display text-3xl tracking-tight">
          {dict.booking_page.successTitle}
        </h2>
        <p className="mt-3 text-[var(--color-ink-soft)] leading-relaxed">
          {dict.booking_page.successBody}
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-4 text-left text-sm bg-[var(--color-line-soft)] rounded-2xl p-6">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
              {dict.booking.checkIn}
            </dt>
            <dd className="font-medium">{checkIn}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
              {dict.booking.checkOut}
            </dt>
            <dd className="font-medium">{checkOut}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
              {dict.booking.roomType}
            </dt>
            <dd className="font-medium">
              {selectedRoom ? selectedRoom.name[locale] : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
              {dict.booking_page.total}
            </dt>
            <dd className="font-medium">{total}€</dd>
          </div>
        </dl>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-accent-deep)] focus:ring-2 focus:ring-[var(--color-accent)]/15";
  const label =
    "text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] mb-1.5 block";

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <ol className="flex items-center gap-1 sm:gap-2 mb-8 overflow-x-auto scroll-bar-thin pb-2">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-medium shrink-0 ${
                  i <= step
                    ? "bg-[var(--color-ink)] text-white"
                    : "bg-[var(--color-line-soft)] text-[var(--color-ink-muted)]"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-xs sm:text-sm whitespace-nowrap ${
                  i === step
                    ? "font-medium text-[var(--color-ink)]"
                    : "text-[var(--color-ink-muted)]"
                }`}
              >
                {s}
              </span>
              {i < steps.length - 1 && (
                <span className="mx-1 sm:mx-2 h-px w-4 sm:w-8 bg-[var(--color-line)]" />
              )}
            </li>
          ))}
        </ol>

        <form
          onSubmit={(e) => {
            if (step < 2) {
              e.preventDefault();
              next();
            } else {
              submit(e);
            }
          }}
          className="rounded-3xl bg-white hairline p-5 sm:p-8 lg:p-10"
        >
          {step === 0 && (
            <div className="grid gap-5">
              <h2 className="font-display text-2xl tracking-tight">
                {dict.booking_page.step1}
              </h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={label} htmlFor="rf-checkin">
                    {dict.booking.checkIn}
                  </label>
                  <input
                    id="rf-checkin"
                    type="date"
                    value={checkIn}
                    min={todayPlus(0)}
                    onChange={(e) => setCheckIn(e.target.value)}
                    required
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="rf-checkout">
                    {dict.booking.checkOut}
                  </label>
                  <input
                    id="rf-checkout"
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => setCheckOut(e.target.value)}
                    required
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="rf-adults">
                    {dict.booking.adults}
                  </label>
                  <select
                    id="rf-adults"
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className={field}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="rf-children">
                    {dict.booking.children}
                  </label>
                  <select
                    id="rf-children"
                    value={children}
                    onChange={(e) => setChildren(Number(e.target.value))}
                    className={field}
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <h2 className="font-display text-2xl tracking-tight">
                {dict.booking_page.step2}
              </h2>
              <div className="grid gap-4">
                {rooms
                  .filter((r) => r.capacity >= adults)
                  .map((r) => (
                    <label
                      key={r.id}
                      className={`flex flex-col sm:flex-row gap-4 items-start sm:items-center rounded-2xl border p-4 cursor-pointer transition-colors ${
                        roomId === r.id
                          ? "border-[var(--color-accent-deep)] bg-[var(--color-line-soft)]"
                          : "border-[var(--color-line)] bg-white hover:bg-[var(--color-line-soft)]/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="roomId"
                        value={r.id}
                        checked={roomId === r.id}
                        onChange={() => setRoomId(r.id)}
                        className="sr-only"
                      />
                      <div className="relative h-24 w-32 overflow-hidden rounded-xl flex-shrink-0">
                        <Image
                          src={r.image}
                          alt={r.name[locale]}
                          fill
                          className="object-cover"
                          sizes="128px"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-display text-xl tracking-tight">
                          {r.name[locale]}
                        </p>
                        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
                          {r.shortDescription[locale]}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-[var(--color-ink-muted)]">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="users" width={12} height={12} />
                            {r.capacity}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icon name="bed" width={12} height={12} />
                            {r.bed[locale]}
                          </span>
                          <span>{r.size}m²</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                          {dict.rooms.fromPrice}
                        </p>
                        <p className="font-display text-2xl">{r.priceFrom}€</p>
                        <p className="text-[10px] text-[var(--color-ink-muted)]">
                          / {dict.booking.night}
                        </p>
                      </div>
                    </label>
                  ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5">
              <h2 className="font-display text-2xl tracking-tight">
                {dict.booking_page.guestData}
              </h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={label} htmlFor="rf-first">
                    {dict.booking_page.firstName}
                  </label>
                  <input
                    id="rf-first"
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    required
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="rf-last">
                    {dict.booking_page.lastName}
                  </label>
                  <input
                    id="rf-last"
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                    required
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="rf-email">
                    {dict.contact.email}
                  </label>
                  <input
                    id="rf-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="rf-phone">
                    {dict.booking_page.phone}
                  </label>
                  <input
                    id="rf-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={field}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="rf-country">
                    {dict.booking_page.country}
                  </label>
                  <input
                    id="rf-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={field}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="rf-notes">
                    {dict.booking_page.notes}
                  </label>
                  <textarea
                    id="rf-notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={field}
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--color-ink-muted)] mt-2 leading-relaxed">
                {dict.booking_page.paymentNote}
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={back}
              disabled={step === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full hairline bg-white px-5 py-3 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {dict.booking_page.back}
            </button>
            <button
              type="submit"
              disabled={step === 1 && !roomId}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {step === 2 ? dict.booking_page.confirm : dict.booking_page.next}
              <Icon name="arrow-right" width={14} height={14} />
            </button>
          </div>
        </form>
      </div>

      <aside className="lg:col-span-4">
        <div className="lg:sticky lg:top-28 rounded-3xl bg-white hairline p-6 sm:p-8 shadow-[var(--shadow-card)]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
            {dict.booking_page.summary}
          </p>

          {offer && (
            <div className="mt-4 rounded-2xl bg-[var(--color-line-soft)] p-4 flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-ink)]">
                <Icon name="sparkle" width={14} height={14} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                  {offer.badge[locale]}
                </p>
                <p className="font-medium text-sm mt-0.5">
                  {offer.title[locale]}
                </p>
              </div>
            </div>
          )}

          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--color-ink-muted)]">
                {dict.booking.checkIn}
              </dt>
              <dd className="font-medium">{checkIn || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--color-ink-muted)]">
                {dict.booking.checkOut}
              </dt>
              <dd className="font-medium">{checkOut || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--color-ink-muted)]">
                {nights || 0} {nights === 1 ? dict.booking.night : dict.booking.nights}
              </dt>
              <dd className="font-medium">
                {adults} + {children}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--color-ink-muted)]">
                {dict.booking.roomType}
              </dt>
              <dd className="font-medium text-right">
                {selectedRoom ? selectedRoom.name[locale] : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-[var(--color-line)] pt-6">
            <div className="flex items-baseline justify-between">
              <p className="text-[var(--color-ink-muted)] text-sm">
                {dict.booking_page.total}
              </p>
              <p className="font-display text-3xl">{total}€</p>
            </div>
            <p className="mt-2 text-xs text-[var(--color-ink-muted)] leading-relaxed">
              {dict.booking.bestPrice} · {dict.booking_page.paymentNote}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
