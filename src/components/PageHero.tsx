"use client";

import { Fragment, useEffect, useRef } from "react";
import gsap from "gsap";
import { KenBurns } from "./animations/KenBurns";
import { MOTION_OK } from "./animations/motion";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image: string;
}) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Transform-only entrance: the server-rendered text is never hidden after it
  // has painted (no opacity reset), and nothing moves under reduced motion.
  useEffect(() => {
    if (!titleRef.current || !wrapRef.current) return;
    const words = titleRef.current.querySelectorAll("[data-word] > span");
    const mm = gsap.matchMedia(wrapRef.current);
    mm.add(MOTION_OK, () => {
      gsap
        .timeline({ delay: 0.05 })
        .from(wrapRef.current, { y: 12, duration: 0.8, ease: "power3.out" })
        .from(
          words,
          { y: "0.25em", duration: 0.9, stagger: 0.05, ease: "power4.out" },
          0.05,
        );
    });
    return () => mm.revert();
  }, []);

  const words = title.split(" ");

  return (
    <section className="relative isolate -mt-20 h-[68vh] min-h-[460px] overflow-hidden bg-[var(--color-ink)]">
      <KenBurns src={image} preload className="absolute inset-0" intensity={1} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/70" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.8 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        ref={wrapRef}
        className="relative container-x flex h-full flex-col justify-end pb-12 pt-32 text-white sm:pb-14 sm:pt-36"
      >
        {eyebrow && (
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/90">
            <span aria-hidden className="h-px w-6 bg-white/70" />
            <span className="min-w-0 truncate">{eyebrow}</span>
          </span>
        )}
        <h1
          ref={titleRef}
          className="mt-3 max-w-3xl font-display text-[2.5rem] leading-[1] tracking-tight text-balance break-words hyphens-auto sm:text-6xl sm:leading-[0.95] lg:text-7xl"
        >
          {/* Real spaces between words, so assistive tech reads the title as text. */}
          {words.map((w, i) => (
            <Fragment key={i}>
              {i > 0 && " "}
              <span data-word className="inline-block align-baseline">
                <span className="inline-block will-change-transform">{w}</span>
              </span>
            </Fragment>
          ))}
        </h1>
        {subtitle && (
          <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
