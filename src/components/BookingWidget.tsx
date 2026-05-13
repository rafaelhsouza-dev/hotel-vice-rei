"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { rooms } from "@/data/hotel";
import { Icon } from "./Icon";

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function BookingWidget({
  locale,
  dict,
  variant = "card",
}: {
  locale: Locale;
  dict: Dictionary;
  variant?: "card" | "inline";
}) {
  const [checkIn, setCheckIn] = useState(todayPlus(1));
  const [checkOut, setCheckOut] = useState(todayPlus(3));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomId, setRoomId] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams({
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(children),
    });
    if (roomId) p.set("room", roomId);
    return p.toString();
  }, [checkIn, checkOut, adults, children, roomId]);

  const fieldClass =
    "w-full bg-transparent border-0 outline-none focus:ring-0 text-[var(--color-ink)] font-medium";
  const labelClass =
    "text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]";

  const wrapper =
    variant === "card"
      ? "rounded-3xl bg-white/95 hairline shadow-[var(--shadow-floating)] backdrop-blur p-3 sm:p-5 lg:p-6"
      : "rounded-2xl bg-white hairline shadow-[var(--shadow-card)] p-4";

  return (
    <form
      action={`/${locale}/reservar`}
      method="get"
      className={wrapper}
    >
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="children" value={children} />
      {roomId && <input type="hidden" name="room" value={roomId} />}

      {variant === "card" && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-display text-lg leading-tight">
              {dict.booking.title}
            </p>
            <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
              {dict.booking.bestPrice}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-line-soft)] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent-deep)]">
            <Icon name="shield" width={12} height={12} />
            Direct
          </span>
        </div>
      )}

      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-[var(--color-line)] px-3 sm:px-4 py-2.5 sm:py-3">
          <label className={labelClass} htmlFor="bw-checkin">
            {dict.booking.checkIn}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Icon name="calendar" width={14} height={14} className="text-[var(--color-ink-muted)] shrink-0" />
            <input
              id="bw-checkin"
              type="date"
              value={checkIn}
              min={todayPlus(0)}
              onChange={(e) => setCheckIn(e.target.value)}
              className={fieldClass + " text-sm min-w-0"}
            />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] px-3 sm:px-4 py-2.5 sm:py-3">
          <label className={labelClass} htmlFor="bw-checkout">
            {dict.booking.checkOut}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Icon name="calendar" width={14} height={14} className="text-[var(--color-ink-muted)] shrink-0" />
            <input
              id="bw-checkout"
              type="date"
              value={checkOut}
              min={checkIn}
              onChange={(e) => setCheckOut(e.target.value)}
              className={fieldClass + " text-sm min-w-0"}
            />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] px-3 sm:px-4 py-2.5 sm:py-3">
          <label className={labelClass} htmlFor="bw-adults">
            {dict.booking.adults}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Icon name="users" width={14} height={14} className="text-[var(--color-ink-muted)] shrink-0" />
            <select
              id="bw-adults"
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className={fieldClass + " text-sm min-w-0"}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] px-3 sm:px-4 py-2.5 sm:py-3">
          <label className={labelClass} htmlFor="bw-children">
            {dict.booking.children}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Icon name="users" width={14} height={14} className="text-[var(--color-ink-muted)] shrink-0" />
            <select
              id="bw-children"
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className={fieldClass + " text-sm min-w-0"}
            >
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] px-3 sm:px-4 py-2.5 sm:py-3 col-span-2 lg:col-span-1">
          <label className={labelClass} htmlFor="bw-room">
            {dict.booking.roomType}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Icon name="bed" width={14} height={14} className="text-[var(--color-ink-muted)] shrink-0" />
            <select
              id="bw-room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={fieldClass + " text-sm min-w-0"}
            >
              <option value="">{dict.booking.any}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name[locale]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="hidden sm:block text-xs text-[var(--color-ink-muted)]">
          {dict.booking.subtitle}
        </p>
        <button
          type="submit"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] transition-colors"
        >
          {dict.booking.submit}
          <Icon name="arrow-right" width={14} height={14} />
        </button>
      </div>
      {/* Hidden link version for non-JS fallback */}
      <noscript>
        <Link href={`/${locale}/reservar?${queryString}`}>{dict.booking.submit}</Link>
      </noscript>
    </form>
  );
}
