"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";

/**
 * OpenStreetMap embed that only loads on demand.
 *
 * The iframe pulls ~1 MB from a third party and was dominating LCP on the
 * pages that showed it. Deferring it until the visitor asks also means no
 * request leaves for openstreetmap.org without an explicit action.
 */
export function MapEmbed({
  lat,
  lng,
  dict,
  label,
}: {
  lat: number;
  lng: number;
  dict: Dictionary;
  label: string;
}) {
  const [active, setActive] = useState(false);

  const bbox = [lng - 0.008, lat - 0.005, lng + 0.008, lat + 0.005]
    .map((n) => n.toFixed(4))
    .join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl hairline bg-[var(--color-line-soft)]">
      {active ? (
        <iframe
          title={label}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center"
        >
          {/* Cheap decorative stand-in: no network request until clicked. */}
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
  );
}
