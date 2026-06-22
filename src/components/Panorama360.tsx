"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";

const DEFAULT_IMAGE =
  "https://mike-henderson.github.io/vrview/examples/gallery/R0010164-post.jpg";
const AFRAME_SRC = "https://aframe.io/releases/1.5.0/aframe.min.js";

declare global {
  interface Window {
    AFRAME?: unknown;
  }
}

/** Load the A-Frame library once, on demand (shared across instances). */
function loadAframe(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.AFRAME) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-aframe]",
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("aframe")));
      return;
    }
    const s = document.createElement("script");
    s.src = AFRAME_SRC;
    s.async = true;
    s.dataset.aframe = "true";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("aframe"));
    document.head.appendChild(s);
  });
}

/**
 * Immersive, drag-to-rotate 360º photo viewer powered by self-hosted A-Frame
 * (WebGL) — no third-party iframe. Click-to-load: the (heavy) A-Frame library
 * is only fetched after the user interacts, which keeps the page fast and is
 * friendlier for RGPD/GDPR.
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
  const [failed, setFailed] = useState(false);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const host = sceneRef.current;

    loadAframe()
      .then(() => {
        if (cancelled || !host) return;
        host.innerHTML = `
          <a-scene
            embedded
            vr-mode-ui="enabled: false"
            loading-screen="enabled: false"
            device-orientation-permission-ui="enabled: false"
            style="width:100%;height:100%;"
          >
            <a-sky src="${image}"></a-sky>
            <a-camera look-controls="reverseMouseDrag: true; touchEnabled: true" wasd-controls-enabled="false"></a-camera>
          </a-scene>`;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      // Remove the scene so A-Frame tears down its canvas / render loop.
      if (host) host.innerHTML = "";
    };
  }, [active, image]);

  return (
    <div className="overflow-hidden rounded-3xl hairline bg-[var(--color-ink)]">
      <div className="relative aspect-[16/10] w-full sm:aspect-[16/9]">
        {active ? (
          <>
            <div ref={sceneRef} className="absolute inset-0 h-full w-full" />
            {failed && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/80">
                {dict.gallery.panoramaConsent}
              </div>
            )}
          </>
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
