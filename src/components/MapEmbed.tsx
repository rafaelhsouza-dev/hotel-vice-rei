"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";

/**
 * Navigable Google map, loaded on demand.
 *
 * The embed pulls close to a megabyte from Google and was dominating LCP on the
 * pages that showed it, so it only mounts once the visitor asks — which also
 * means no request reaches Google before an explicit action. Once mounted it is
 * the full interactive map: pan, zoom, Street View.
 *
 * Uses the keyless `maps.google.com/maps?output=embed` form, so there is no API
 * key to provision or leak.
 */
export function MapEmbed({
  lat,
  lng,
  dict,
  label,
  address,
  locale = "pt",
}: {
  lat: number;
  lng: number;
  dict: Dictionary;
  label: string;
  address: string;
  /** Interface language of the embedded map. */
  locale?: string;
}) {
  const [active, setActive] = useState(false);

  const query = encodeURIComponent(address);
  const embed = `https://maps.google.com/maps?q=${lat},${lng}&hl=${encodeURIComponent(locale)}&z=16&output=embed`;
  const open = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${query}`;

  return (
    <div className="overflow-hidden rounded-3xl hairline bg-[var(--color-line-soft)]">
      <div className="relative aspect-[4/3]">
        {active ? (
          <iframe
            title={label}
            src={embed}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setActive(true)}
            className="group absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center"
          >
            {/* Drawn, not fetched: nothing leaves the page until the click. */}
            <span
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0 22px, rgba(20,17,15,0.06) 22px 23px), repeating-linear-gradient(90deg, transparent 0 22px, rgba(20,17,15,0.06) 22px 23px)",
              }}
            />
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white text-[var(--color-accent-deep)] shadow-[var(--shadow-card)] transition-transform duration-500 group-hover:scale-110">
              <Icon name="map" width={22} height={22} />
            </span>
            <span className="relative font-display text-lg tracking-tight">
              {dict.contact.showMap}
            </span>
            <span className="relative max-w-xs text-xs leading-relaxed text-[var(--color-ink-muted)]">
              {dict.contact.mapConsent}
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] bg-white px-4 py-3">
        <a
          href={directions}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)]"
        >
          <Icon name="map" width={13} height={13} />
          {dict.contact.directions}
        </a>
        <a
          href={open}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2 text-xs text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
        >
          {dict.contact.openInMaps}
          <Icon name="arrow-right" width={12} height={12} />
        </a>
      </div>
    </div>
  );
}
