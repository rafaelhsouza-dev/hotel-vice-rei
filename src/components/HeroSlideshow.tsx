"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { MOTION_OK } from "./animations/motion";

export type Slide = { src: string; alt?: string };

/**
 * Cross-fading hero backdrop.
 *
 * One Ken Burns transform drives the whole stack — the slides sit inside it and
 * only their opacity changes, so adding images costs no extra animation work.
 * The first slide is preloaded (it is the LCP element); the rest load
 * lazily and are only faded in once decoded, so a slow image never shows as a
 * blank frame.
 */
export function HeroSlideshow({
  slides,
  intervalMs = 6500,
  startDelayMs = 9000,
  className,
  label,
  photoLabel = "{n}",
}: {
  slides: Slide[];
  intervalMs?: number;
  /** How long the opening photograph holds before the first change. */
  startDelayMs?: number;
  className?: string;
  label: string;
  /** Fallback dot label for slides without alt, with "{n}" for the number. */
  photoLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState<boolean[]>(() => slides.map((_, i) => i === 0));
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);

  // Ken Burns on the container, shared by every slide.
  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;

    // Stopped entirely under reduced motion.
    const mm = gsap.matchMedia(wrap);
    mm.add(MOTION_OK, () => {
      gsap.set(img, { scale: 1.05, xPercent: -1, yPercent: -1 });
      gsap.to(img, {
        scale: 1.16,
        xPercent: 1,
        yPercent: 1,
        duration: 18,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    });

    return () => mm.revert();
  }, []);

  // Advance the slide. Held still for anyone who asked for reduced motion.
  //
  // The first change waits `startDelayMs`. A cross-fade counts as a visual
  // change, so rotating early tanks Speed Index — and it also gives the opening
  // photograph time to land before anything moves.
  useEffect(() => {
    if (slides.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    let interval = 0;
    const start = window.setTimeout(() => {
      setIndex((current) => (current + 1) % slides.length);
      interval = window.setInterval(() => {
        setIndex((current) => (current + 1) % slides.length);
      }, intervalMs);
    }, startDelayMs);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [slides.length, intervalMs, startDelayMs]);

  // Start fetching the next slide a little before it is needed.
  useEffect(() => {
    const next = (index + 1) % slides.length;
    setReady((current) =>
      current[next] ? current : current.map((v, i) => (i === next ? true : v)),
    );
  }, [index, slides.length]);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className ?? ""}`}>
      <div ref={imgRef} className="absolute inset-[-4%] will-change-transform">
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            aria-hidden={i !== index}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: i === index ? 1 : 0 }}
          >
            {(i === 0 || ready[i]) && (
              <Image
                src={slide.src}
                alt=""
                fill
                preload={i === 0}
                loading={i === 0 ? undefined : "lazy"}
                sizes="100vw"
                quality={68}
                className="object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div
          role="group"
          aria-label={label}
          className="absolute bottom-5 right-5 z-20 flex items-center gap-2 sm:bottom-7 sm:right-8"
        >
          {slides.map((slide, i) => (
            // The visible dot is small by design; the button around it carries
            // the 24×24 touch target WCAG asks for.
            <button
              key={slide.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={slide.alt || photoLabel.replace("{n}", String(i + 1))}
              aria-pressed={i === index}
              className="grid h-6 w-6 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span
                aria-hidden
                className={`block h-2 rounded-full transition-all duration-500 ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/60"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
