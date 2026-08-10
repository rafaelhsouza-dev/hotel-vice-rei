"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export type Slide = { src: string; alt?: string };

/**
 * Cross-fading hero backdrop.
 *
 * One Ken Burns transform drives the whole stack — the slides sit inside it and
 * only their opacity changes, so adding images costs no extra animation work.
 * The first slide is eager and priority (it is the LCP element); the rest load
 * lazily and are only faded in once decoded, so a slow image never shows as a
 * blank frame.
 */
export function HeroSlideshow({
  slides,
  intervalMs = 6500,
  className,
  label,
}: {
  slides: Slide[];
  intervalMs?: number;
  className?: string;
  label: string;
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

    const ctx = gsap.context(() => {
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
    }, wrap);

    return () => ctx.revert();
  }, []);

  // Advance the slide. Held still for anyone who asked for reduced motion.
  useEffect(() => {
    if (slides.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs]);

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
            className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out"
            style={{ opacity: i === index ? 1 : 0 }}
          >
            {(i === 0 || ready[i]) && (
              <Image
                src={slide.src}
                alt=""
                fill
                priority={i === 0}
                loading={i === 0 ? "eager" : "lazy"}
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
              aria-label={slide.alt ?? `Fotografia ${i + 1}`}
              aria-current={i === index}
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
