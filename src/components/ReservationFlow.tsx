"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { getEngineStrings, violationText } from "@/i18n/engine";
import type { Offer, Room } from "@/data/hotel";
import type { BookingExtra } from "@/lib/repo/content";
import {
  checkPromo,
  getQuote,
  searchAvailability,
  submitBooking,
  type BookingResult,
  type ClientQuote,
  type SearchResult,
} from "@/app/(site)/[locale]/reservar/actions";
import { track } from "@/lib/track";
import { Icon } from "./Icon";

type Initial = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomId: string;
  offerId: string;
};

/** Local calendar date (the visitor's), as the date inputs expect. */
function localDate(offsetDays: number) {
  const x = new Date();
  x.setDate(x.getDate() + offsetDays);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const d = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function plusDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function ReservationFlow({
  locale,
  dict,
  rooms,
  offers,
  extras: extraDefs,
  initial,
  childMaxAge,
  privacyHref,
  cancellationHref,
}: {
  locale: Locale;
  dict: Dictionary;
  rooms: Room[];
  offers: Offer[];
  /** Priced add-ons, managed in the backoffice. */
  extras: BookingExtra[];
  initial: Initial;
  childMaxAge: number;
  privacyHref: string;
  cancellationHref: string;
}) {
  const s = getEngineStrings(locale);
  const money = useMemo(
    () =>
      new Intl.NumberFormat({ pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" }[locale], {
        style: "currency",
        currency: "EUR",
      }),
    [locale],
  );

  const firstIn = validDate(initial.checkIn) && initial.checkIn >= localDate(0) ? initial.checkIn : localDate(1);
  const firstOut = validDate(initial.checkOut) && initial.checkOut > firstIn ? initial.checkOut : plusDays(firstIn, 2);

  const [step, setStep] = useState(0);
  const [checkIn, setCheckIn] = useState(firstIn);
  const [checkOut, setCheckOut] = useState(firstOut);
  const [adults, setAdults] = useState(Math.min(4, Math.max(1, initial.adults || 2)));
  const [children, setChildren] = useState(Math.min(3, Math.max(0, initial.children || 0)));
  const [roomId, setRoomId] = useState(initial.roomId);
  const [planId, setPlanId] = useState("");
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [quote, setQuote] = useState<ClientQuote | null>(null);
  const [chosenExtras, setChosenExtras] = useState<string[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState(false);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [payMethod, setPayMethod] = useState<"card" | "mbway" | "multibanco" | "">("");
  const [mbwayPhone, setMbwayPhone] = useState("");
  const [accept, setAccept] = useState(false);

  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<Extract<BookingResult, { ok: true }> | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isQuoting, startQuote] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const offer = useMemo(() => offers.find((o) => o.id === initial.offerId), [offers, initial.offerId]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const selectedRoom = roomById.get(roomId);
  const option = search?.options.find((o) => o.roomId === roomId);
  const selectedPlan = search?.plans.find((p) => p.id === planId);
  const planQuote = option?.plans.find((p) => p.planId === planId);

  const steps = [dict.booking_page.step1, dict.booking_page.step2, dict.booking_page.step3];

  // Move focus to the step heading so keyboard and screen-reader users know
  // the content changed.
  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  function runSearch(after?: () => void) {
    setSubmitError("");
    startSearch(async () => {
      const r = await searchAvailability({ checkIn, checkOut, adults, children });
      setSearch(r);
      // Keep the visitor's room if it is still bookable; else clear it.
      const keep = r.options.find((o) => o.roomId === roomId && o.available);
      if (!keep) setRoomId("");
      const okPlan = keep?.plans.find((p) => p.planId === planId && p.ok) ?? keep?.plans.find((p) => p.ok);
      setPlanId(okPlan?.planId ?? "");
      after?.();
    });
  }

  // Server quote for the chosen combination — the only figures we show.
  useEffect(() => {
    if (!roomId || !planId || step === 0) {
      setQuote(null);
      return;
    }
    const handle = setTimeout(() => {
      startQuote(async () => {
        setQuote(
          await getQuote({
            roomId,
            ratePlanId: planId,
            checkIn,
            checkOut,
            adults,
            children,
            extras: chosenExtras,
            promoCode,
          }),
        );
      });
    }, 150);
    return () => clearTimeout(handle);
  }, [roomId, planId, chosenExtras, promoCode, checkIn, checkOut, adults, children, step]);

  function applyPromo() {
    startQuote(async () => {
      const r = await checkPromo(promoInput);
      if (r.ok && r.code) {
        setPromoCode(r.code);
        setPromoError(false);
      } else {
        setPromoCode("");
        setPromoError(true);
      }
    });
  }

  const dueNow = quote?.dueNow ?? 0;
  const methods = search?.methods ?? [];

  function submit() {
    setSubmitError("");
    if (!accept) {
      setSubmitError(s.errors.terms);
      return;
    }
    if (dueNow > 0 && !payMethod) {
      setSubmitError(s.payment);
      return;
    }
    startSubmit(async () => {
      const r = await submitBooking({
        roomId,
        ratePlanId: planId,
        checkIn,
        checkOut,
        adults,
        children,
        extras: chosenExtras,
        promoCode,
        firstName: first,
        lastName: last,
        email,
        phone,
        country,
        notes,
        offerId: initial.offerId,
        paymentMethod: dueNow > 0 ? payMethod : "hotel",
        mbwayPhone,
        acceptTerms: accept,
        website,
        locale,
      });
      if (!r.ok) {
        if (r.violations?.length) {
          setSubmitError(violationText(s, r.violations[0]));
          // Inventory changed under us: go back to the room list.
          runSearch(() => setStep(1));
        } else {
          setSubmitError(violationText(s, { code: r.error }));
        }
        return;
      }
      track("purchase", {
        transaction_id: r.reference,
        value: r.total,
        currency: "EUR",
        items: [{ item_id: roomId, item_name: selectedRoom?.name.pt, item_variant: planId, quantity: quote?.nights ?? 1 }],
      });
      if (r.payment?.kind === "redirect") {
        window.location.assign(r.payment.url);
        return;
      }
      setResult(r);
    });
  }

  const field =
    "w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-base sm:text-sm focus:outline-none focus:border-[var(--color-accent-deep)] focus:ring-2 focus:ring-[var(--color-accent-deep)]";
  const label = "text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] mb-1.5 block";

  // --- done ----------------------------------------------------------------
  if (result) {
    const confirmed = result.status === "confirmed";
    const p = result.payment;
    return (
      <div className="mx-auto max-w-2xl rounded-3xl bg-white hairline p-6 text-center sm:p-12" role="status">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-white ${confirmed ? "bg-[var(--color-success)]" : "bg-[var(--color-accent-deep)]"}`}>
          <Icon name="check" width={24} height={24} />
        </span>
        <h2 className="mt-6 font-display text-3xl tracking-tight">{confirmed ? s.successConfirmed : s.successPending}</h2>
        <p className="mt-3 leading-relaxed text-[var(--color-ink-soft)]">
          {confirmed ? s.successBodyConfirmed : s.successBodyPending}
        </p>
        <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-line-soft)] px-5 py-2.5">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">{dict.booking_page.reference}</span>
          <span className="font-mono text-base font-medium">{result.reference}</span>
        </p>

        {p?.kind === "multibanco" && (
          <dl className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-3 rounded-2xl border border-[var(--color-line)] p-5 text-left text-sm">
            <dt className="text-[var(--color-ink-muted)]">Entidade</dt>
            <dd className="text-right font-mono font-medium">{p.entity}</dd>
            <dt className="text-[var(--color-ink-muted)]">Referência</dt>
            <dd className="text-right font-mono font-medium">{p.reference.replace(/(\d{3})(?=\d)/g, "$1 ")}</dd>
            <dt className="text-[var(--color-ink-muted)]">Valor</dt>
            <dd className="text-right font-medium">{money.format(p.amount)}</dd>
          </dl>
        )}
        {p?.kind === "mbway" && (
          <p className="mx-auto mt-6 max-w-md rounded-2xl bg-[var(--color-line-soft)] p-4 text-sm">{s.mbwayWaiting}</p>
        )}
        {p?.kind === "error" && (
          <p className="mx-auto mt-6 max-w-md rounded-2xl bg-red-50 p-4 text-sm text-red-800">{s.paymentRetry}</p>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-4 rounded-2xl bg-[var(--color-line-soft)] p-6 text-left text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{dict.booking.checkIn}</dt>
            <dd className="font-medium">{checkIn}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{dict.booking.checkOut}</dt>
            <dd className="font-medium">{checkOut}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{dict.booking.roomType}</dt>
            <dd className="font-medium">{selectedRoom?.name[locale] ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{s.grandTotal}</dt>
            <dd className="font-medium">{money.format(result.total + result.touristTax)}</dd>
          </div>
        </dl>
        <a
          href={result.manageUrl}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)]"
        >
          {s.manage}
          <Icon name="arrow-right" width={14} height={14} />
        </a>
      </div>
    );
  }

  const boardLabel = (b: string) => (b === "breakfast" ? s.boardBreakfast : b === "half_board" ? s.boardHalf : s.boardRoomOnly);

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <ol className="scroll-bar-thin mb-8 flex items-center gap-1 overflow-x-auto pb-2 sm:gap-2" aria-label={dict.booking_page.title}>
          {steps.map((label, i) => (
            <li key={label} className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-current={i === step ? "step" : undefined}>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-medium ${
                  i <= step ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-line-soft)] text-[var(--color-ink-muted)]"
                }`}
              >
                {i + 1}
              </span>
              <span className={`whitespace-nowrap text-xs sm:text-sm ${i === step ? "font-medium text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]"}`}>
                {label}
              </span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-4 bg-[var(--color-line)] sm:mx-2 sm:w-8" />}
            </li>
          ))}
        </ol>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 0) {
              if (!(checkOut > checkIn)) {
                setSubmitError(s.errors.invalid_dates);
                return;
              }
              track("begin_checkout", { currency: "EUR" });
              runSearch(() => setStep(1));
            } else if (step === 1) {
              if (!roomId || !planId) {
                setSubmitError(s.errors.missing_room);
                return;
              }
              track("add_to_cart", { currency: "EUR", value: quote?.total, items: [{ item_id: roomId, item_variant: planId }] });
              setSubmitError("");
              setStep(2);
            } else {
              submit();
            }
          }}
          className="rounded-3xl bg-white hairline p-5 sm:p-8 lg:p-10"
          noValidate={false}
        >
          {/* --- step 1: dates ------------------------------------------------ */}
          {step === 0 && (
            <div className="grid gap-5">
              <h2 className="font-display text-2xl tracking-tight">{dict.booking_page.step1}</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="rf-checkin">
                    {dict.booking.checkIn}
                  </label>
                  <input
                    id="rf-checkin"
                    type="date"
                    value={checkIn}
                    min={localDate(0)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCheckIn(v);
                      if (validDate(v) && !(checkOut > v)) setCheckOut(plusDays(v, 1));
                    }}
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
                    min={validDate(checkIn) ? plusDays(checkIn, 1) : localDate(1)}
                    onChange={(e) => setCheckOut(e.target.value)}
                    required
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="rf-adults">
                    {dict.booking.adults}
                  </label>
                  <select id="rf-adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={field}>
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
                  <select id="rf-children" value={children} onChange={(e) => setChildren(Number(e.target.value))} className={field} aria-describedby="rf-children-hint">
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <p id="rf-children-hint" className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    {s.childrenHint(childMaxAge)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* --- step 2: room & rate ------------------------------------------ */}
          {step === 1 && search && (
            <div className="grid gap-5">
              <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl tracking-tight outline-none">
                {dict.booking_page.step2}
              </h2>
              {search.violations.length > 0 && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  {violationText(s, search.violations[0])}
                </p>
              )}
              {search.options.length > 0 && !search.options.some((o) => o.available) && search.violations.length === 0 && (
                <div role="status" className="rounded-2xl bg-[var(--color-line-soft)] p-5 text-sm">
                  <p className="font-medium">{s.noRooms}</p>
                  <p className="mt-1 text-[var(--color-ink-muted)]">{s.tryOther}</p>
                </div>
              )}

              <div className="grid gap-4" role="radiogroup" aria-label={dict.booking.roomType}>
                {search.options
                  .filter((o) => roomById.has(o.roomId))
                  .sort((a, b) => Number(b.available) - Number(a.available))
                  .map((o) => {
                    const r = roomById.get(o.roomId)!;
                    const okPlans = o.plans.filter((p) => p.ok);
                    const cheapest = okPlans.length ? Math.min(...okPlans.map((p) => p.nightlyAverage)) : null;
                    const selected = roomId === r.id;
                    return (
                      <div
                        key={r.id}
                        className={`rounded-2xl border p-4 transition-colors ${
                          selected ? "border-[var(--color-accent-deep)] bg-[var(--color-line-soft)]" : "border-[var(--color-line)] bg-white"
                        } ${o.available ? "" : "opacity-70"}`}
                      >
                        <label className={`flex flex-col gap-4 sm:flex-row sm:items-center ${o.available ? "cursor-pointer" : "cursor-not-allowed"} rounded-xl has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-accent-deep)]`}>
                          <input
                            type="radio"
                            name="roomId"
                            value={r.id}
                            checked={selected}
                            disabled={!o.available}
                            onChange={() => {
                              setRoomId(r.id);
                              const best = o.plans.find((p) => p.ok);
                              setPlanId(best?.planId ?? "");
                            }}
                            className="sr-only"
                          />
                          <div className="relative h-36 w-full flex-shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-32">
                            <Image src={r.image} alt={r.name[locale]} fill className="object-cover" sizes="(min-width: 640px) 128px, 100vw" />
                          </div>
                          <div className="flex-1">
                            <p className="font-display text-xl tracking-tight">{r.name[locale]}</p>
                            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{r.shortDescription[locale]}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-ink-muted)]">
                              <span className="inline-flex items-center gap-1">
                                <Icon name="users" width={12} height={12} />
                                {s.capacityHint(r.capacity)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Icon name="bed" width={12} height={12} />
                                {r.bed[locale]}
                              </span>
                              <span>{r.size} m²</span>
                            </div>
                          </div>
                          <div className="sm:text-right">
                            {o.available && cheapest != null ? (
                              <>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{s.from}</p>
                                <p className="font-display text-2xl">{money.format(cheapest)}</p>
                                <p className="text-[10px] text-[var(--color-ink-muted)]">{s.perNight}</p>
                              </>
                            ) : (
                              <p className="text-sm font-medium text-red-700">
                                {o.reason ? violationText(s, o.reason) : s.soldOut}
                              </p>
                            )}
                          </div>
                        </label>

                        {selected && o.available && (
                          <fieldset className="mt-4 grid gap-2 border-t border-[var(--color-line)] pt-4">
                            <legend className="mb-2 text-sm font-medium">{s.choosePlan}</legend>
                            {o.plans.map((pq) => {
                              const plan = search.plans.find((p) => p.id === pq.planId);
                              if (!plan) return null;
                              const on = planId === plan.id;
                              return (
                                <label
                                  key={plan.id}
                                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                                    on ? "border-[var(--color-accent-deep)] bg-white" : "border-[var(--color-line)] bg-white/60"
                                  } ${pq.ok ? "" : "cursor-not-allowed opacity-60"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-accent-deep)]`}
                                >
                                  <span className="flex items-start gap-3">
                                    <input
                                      type="radio"
                                      name="planId"
                                      value={plan.id}
                                      checked={on}
                                      disabled={!pq.ok}
                                      onChange={() => setPlanId(plan.id)}
                                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent-deep)]"
                                    />
                                    <span>
                                      <span className="block font-medium">{plan.name[locale] ?? plan.name.pt}</span>
                                      <span className="block text-xs text-[var(--color-ink-muted)]">
                                        {boardLabel(plan.board)} ·{" "}
                                        {plan.refundable ? s.refundable(plan.freeCancelDays) : s.nonRefundable} ·{" "}
                                        {plan.paymentPolicy === "full"
                                          ? s.payFull
                                          : plan.paymentPolicy === "deposit"
                                            ? s.payDeposit(plan.depositPct)
                                            : s.payHotel}
                                      </span>
                                      {!pq.ok && pq.violations[0] && (
                                        <span className="mt-1 block text-xs text-red-700">{violationText(s, pq.violations[0])}</span>
                                      )}
                                    </span>
                                  </span>
                                  {pq.ok && (
                                    <span className="text-right">
                                      <span className="block font-display text-xl">{money.format(pq.total)}</span>
                                      <span className="block text-[11px] text-[var(--color-ink-muted)]">
                                        {money.format(pq.nightlyAverage)} {s.perNight}
                                      </span>
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </fieldset>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Extras (upsells) */}
              {extraDefs.length > 0 && roomId && (
                <div className="border-t border-[var(--color-line)] pt-6">
                  <h3 className="font-display text-xl tracking-tight">{dict.extras.title}</h3>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{dict.extras.subtitle}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {extraDefs.map((ex) => {
                      const on = chosenExtras.includes(ex.id);
                      return (
                        <label
                          key={ex.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                            on ? "border-[var(--color-accent-deep)] bg-[var(--color-line-soft)]" : "border-[var(--color-line)] hover:bg-[var(--color-line-soft)]/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setChosenExtras((c) => (c.includes(ex.id) ? c.filter((id) => id !== ex.id) : [...c, ex.id]))
                            }
                            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent-deep)]"
                          />
                          <span className="flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-medium">{ex.label[locale]}</span>
                              <span className="text-sm font-medium text-[var(--color-accent-deep)]">+{money.format(ex.price)}</span>
                            </span>
                            <span className="mt-0.5 block text-xs text-[var(--color-ink-muted)]">
                              {ex.description[locale]} · {ex.perNight ? dict.extras.perNight : dict.extras.perStay}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Promo code */}
              {roomId && (
                <div className="border-t border-[var(--color-line)] pt-6">
                  <label className={label} htmlFor="rf-promo">
                    {dict.extras.promoTitle}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="rf-promo"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder={dict.extras.promoPlaceholder}
                      autoComplete="off"
                      className={field}
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      className="shrink-0 rounded-xl bg-[var(--color-ink)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)]"
                    >
                      {dict.extras.promoApply}
                    </button>
                  </div>
                  <p aria-live="polite" className="mt-2 text-xs">
                    {promoCode && quote?.promo && (
                      <span className="text-[var(--color-success)]">
                        {dict.extras.promoApplied}: {quote.promo.code} (−{Math.round(quote.promo.percent * 100)}%)
                      </span>
                    )}
                    {promoError && <span className="text-red-700">{dict.extras.promoInvalid}</span>}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* --- step 3: guest & payment -------------------------------------- */}
          {step === 2 && (
            <div className="grid gap-5">
              <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl tracking-tight outline-none">
                {dict.booking_page.guestData}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="rf-first">
                    {dict.booking_page.firstName}
                  </label>
                  <input id="rf-first" value={first} onChange={(e) => setFirst(e.target.value)} required autoComplete="given-name" maxLength={80} className={field} />
                </div>
                <div>
                  <label className={label} htmlFor="rf-last">
                    {dict.booking_page.lastName}
                  </label>
                  <input id="rf-last" value={last} onChange={(e) => setLast(e.target.value)} required autoComplete="family-name" maxLength={80} className={field} />
                </div>
                <div>
                  <label className={label} htmlFor="rf-email">
                    {dict.contact.email}
                  </label>
                  <input id="rf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" maxLength={160} className={field} />
                </div>
                <div>
                  <label className={label} htmlFor="rf-phone">
                    {dict.booking_page.phone}
                  </label>
                  <input id="rf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={40} className={field} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="rf-country">
                    {dict.booking_page.country}
                  </label>
                  <input id="rf-country" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" maxLength={80} className={field} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="rf-notes">
                    {dict.booking_page.notes}
                  </label>
                  <textarea id="rf-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className={field} />
                </div>
                {/* Honeypot: hidden from people and assistive tech. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label htmlFor="rf-website">Website</label>
                  <input id="rf-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
              </div>

              <div className="border-t border-[var(--color-line)] pt-6">
                <h3 className="font-display text-xl tracking-tight">{s.payment}</h3>
                {dueNow > 0 ? (
                  <>
                    <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                      {s.dueNow}: <strong className="text-[var(--color-ink)]">{money.format(dueNow)}</strong>
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={s.payment}>
                      {(["card", "mbway", "multibanco"] as const)
                        .filter((m) => methods.includes(m))
                        .map((m) => (
                          <label
                            key={m}
                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-accent-deep)] ${
                              payMethod === m ? "border-[var(--color-accent-deep)] bg-[var(--color-line-soft)]" : "border-[var(--color-line)]"
                            }`}
                          >
                            <input
                              type="radio"
                              name="payMethod"
                              checked={payMethod === m}
                              onChange={() => setPayMethod(m)}
                              className="h-4 w-4 accent-[var(--color-accent-deep)]"
                            />
                            <span className="font-medium">
                              {m === "card" ? s.methodCard : m === "mbway" ? s.methodMbway : s.methodMultibanco}
                            </span>
                          </label>
                        ))}
                    </div>
                    {payMethod === "mbway" && (
                      <div className="mt-4">
                        <label className={label} htmlFor="rf-mbway">
                          {s.mbwayPhone}
                        </label>
                        <input
                          id="rf-mbway"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel-national"
                          value={mbwayPhone}
                          onChange={(e) => setMbwayPhone(e.target.value)}
                          placeholder="9XX XXX XXX"
                          required
                          className={field}
                        />
                        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{s.mbwayHint}</p>
                      </div>
                    )}
                    {payMethod === "multibanco" && <p className="mt-4 text-sm text-[var(--color-ink-muted)]">{s.multibancoHint}</p>}
                    {payMethod === "card" && <p className="mt-4 text-sm text-[var(--color-ink-muted)]">{s.cardHint}</p>}
                    <p className="mt-4 inline-flex items-start gap-1.5 text-xs text-[var(--color-ink-muted)]">
                      <Icon name="shield" width={14} height={14} />
                      {s.secure}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{s.paymentHotelOnly}</p>
                )}
              </div>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  required
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent-deep)]"
                />
                <span>
                  {s.terms}{" "}
                  <Link href={cancellationHref} target="_blank" className="underline underline-offset-2">
                    {s.termsLink}
                  </Link>{" "}
                  ·{" "}
                  <Link href={privacyHref} target="_blank" className="underline underline-offset-2">
                    {s.privacyLink}
                  </Link>
                </span>
              </label>
            </div>
          )}

          {submitError && (
            <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </p>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setSubmitError("");
                setStep((v) => Math.max(0, v - 1));
              }}
              disabled={step === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full hairline bg-white px-5 py-3 text-sm font-medium text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)] disabled:pointer-events-none disabled:opacity-40"
            >
              {dict.booking_page.back}
            </button>
            <button
              type="submit"
              disabled={(step === 1 && (!roomId || !planId || !quote?.ok)) || isSearching || isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)] disabled:pointer-events-none disabled:opacity-50"
            >
              {isSearching
                ? s.searching
                : isSubmitting
                  ? dict.booking_page.sending
                  : step === 2
                    ? dueNow > 0
                      ? s.confirmAndPay
                      : s.confirm
                    : dict.booking_page.next}
              <Icon name="arrow-right" width={14} height={14} />
            </button>
          </div>
        </form>
      </div>

      <aside className="lg:col-span-4" aria-live="polite">
        <div className="rounded-3xl bg-white hairline p-6 shadow-[var(--shadow-card)] sm:p-8 lg:sticky lg:top-28">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{dict.booking_page.summary}</p>

          {offer && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--color-line-soft)] p-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-ink)]">
                <Icon name="sparkle" width={14} height={14} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{offer.badge[locale]}</p>
                <p className="mt-0.5 text-sm font-medium">{offer.title[locale]}</p>
              </div>
            </div>
          )}

          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">{dict.booking.checkIn}</dt>
              <dd className="font-medium">{checkIn || "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">{dict.booking.checkOut}</dt>
              <dd className="font-medium">{checkOut || "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">{dict.booking.adults} / {dict.booking.children}</dt>
              <dd className="font-medium">
                {adults} + {children}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-ink-muted)]">{dict.booking.roomType}</dt>
              <dd className="text-right font-medium">{selectedRoom ? selectedRoom.name[locale] : "—"}</dd>
            </div>
            {selectedPlan && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--color-ink-muted)]">{s.choosePlan}</dt>
                <dd className="text-right font-medium">{selectedPlan.name[locale] ?? selectedPlan.name.pt}</dd>
              </div>
            )}
            {quote?.ok && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--color-ink-muted)]">{s.totalFor(quote.nights)}</dt>
                  <dd className="font-medium">{money.format(quote.base)}</dd>
                </div>
                {quote.extrasTotal > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--color-ink-muted)]">{dict.extras.extrasLine}</dt>
                    <dd className="font-medium">+{money.format(quote.extrasTotal)}</dd>
                  </div>
                )}
                {quote.discount > 0 && (
                  <div className="flex items-center justify-between gap-3 text-[var(--color-success)]">
                    <dt>
                      {dict.extras.discount}
                      {quote.promo ? ` · ${quote.promo.code}` : ""}
                    </dt>
                    <dd className="font-medium">−{money.format(quote.discount)}</dd>
                  </div>
                )}
                {quote.touristTax > 0 && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-[var(--color-ink-muted)]">
                      {s.touristTax}
                      <span className="block text-[11px]">{s.touristTaxNote}</span>
                    </dt>
                    <dd className="font-medium">{money.format(quote.touristTax)}</dd>
                  </div>
                )}
              </>
            )}
            {quote && !quote.ok && quote.violations[0] && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">{violationText(s, quote.violations[0])}</p>
            )}
          </dl>

          <div className="mt-6 border-t border-[var(--color-line)] pt-6">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-[var(--color-ink-muted)]">{s.grandTotal}</p>
              <p className="font-display text-3xl">
                {quote?.ok ? money.format(quote.total + quote.touristTax) : planQuote?.ok ? money.format(planQuote.total + planQuote.touristTax) : "—"}
              </p>
            </div>
            {quote?.ok && (
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                {dueNow > 0
                  ? `${s.dueNow}: ${money.format(dueNow)} · ${s.dueAtHotel}: ${money.format(quote.total + quote.touristTax - dueNow)}`
                  : `${s.dueAtHotel}: ${money.format(quote.total + quote.touristTax)}`}
              </p>
            )}
            {isQuoting && <p className="mt-2 text-xs text-[var(--color-ink-muted)]">…</p>}
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-muted)]">{dict.booking.bestPrice}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
