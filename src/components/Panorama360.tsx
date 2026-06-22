"use client";

import Image from "next/image";
import { useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";

const DEFAULT_IMAGE =
  "https://mike-henderson.github.io/vrview/examples/gallery/R0010164-post.jpg";

/**
 * Immersive 360º photo viewer (Google VR View).
 * Click-to-load: the third-party iframe is only injected after the user
 * interacts, so nothing external loads (and no third-party cookies are set)
 * until the visitor opts in — friendlier for RGPD/GDPR compliance.
 */
export function Panorama360({
  dict,
  image = DEFAULT_IMAGE,
  poster = "/images/hero/hero-room.jpg",
}: {
  dict: Dictionary;
  image?: string;
  poster?: string;
}) {
  const [active, setActive] = useState(false);
  // Google VR View embed — a single-image, drag-to-rotate 360 viewer built
  // for iframing (the demo index.html page is not a clean embed).
  const embed = `https://storage.googleapis.com/vrview/2.0/embed?image=${encodeURIComponent(
    image,
  )}&is_stereo=false&is_autopan_off=true`;

  return (
    <div className="overflow-hidden rounded-3xl hairline bg-[var(--color-ink)]">
      <div className="relative aspect-[16/10] w-full sm:aspect-[16/9]">
        {active ? (
          <iframe
            title={dict.gallery.panoramaTitle}
            src={embed}
            allowFullScreen
            allow="accelerometer; gyroscope; fullscreen; xr-spatial-tracking"
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setActive(true)}
            className="group absolute inset-0 h-full w-full cursor-pointer"
            aria-label={dict.gallery.panoramaLoad}
          >
            <Image
              src={poster}
              alt=""
              fill
              sizes="(min-width:1024px) 60vw, 100vw"
              className="object-cover opacity-75 transition-opacity duration-500 group-hover:opacity-60"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/20"
            />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
              <span className="grid h-16 w-16 place-items-center rounded-full border border-white/30 bg-white/15 backdrop-blur transition-transform duration-500 group-hover:scale-110">
                <Icon name="globe" width={26} height={26} />
              </span>
              <span className="font-display text-xl tracking-tight sm:text-2xl">
                {dict.gallery.panoramaLoad}
              </span>
              <span className="max-w-sm text-xs leading-relaxed text-white/75">
                {dict.gallery.panoramaConsent}
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="px-4 py-3 text-center text-xs text-white/70">
        {dict.gallery.panoramaHint}
      </p>
    </div>
  );
}
