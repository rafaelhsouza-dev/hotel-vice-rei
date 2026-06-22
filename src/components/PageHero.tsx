"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { KenBurns } from "./animations/KenBurns";

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

  useEffect(() => {
    if (!titleRef.current) return;
    const words = titleRef.current.querySelectorAll("[data-word] > span");
    const ctx = gsap.context(() => {
      gsap.set(words, { yPercent: 110, opacity: 0 });
      gsap.set(wrapRef.current, { opacity: 0, y: 12 });
      const tl = gsap.timeline({ delay: 0.15 });
      tl.to(wrapRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
      }).to(
        words,
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.0,
          stagger: 0.06,
          ease: "power4.out",
        },
        0.1,
      );
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  const words = title.split(" ");

  return (
    <section className="relative isolate -mt-20 h-[68vh] min-h-[460px] overflow-hidden">
      <KenBurns
        src={image}
        priority
        className="absolute inset-0"
        intensity={1}
      />
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
        className="relative container-x flex h-full flex-col justify-end pb-14 pt-36 text-white"
      >
        {eyebrow && (
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/90">
            <span aria-hidden className="h-px w-6 bg-white/70" />
            {eyebrow}
          </span>
        )}
        <h1
          ref={titleRef}
          aria-label={title}
          className="mt-3 font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight text-balance max-w-3xl"
        >
          {words.map((w, i) => (
            <span
              key={i}
              data-word
              className="inline-block overflow-hidden align-baseline mr-[0.18em]"
            >
              <span className="inline-block will-change-transform">{w}</span>
            </span>
          ))}
        </h1>
        {subtitle && (
          <p className="mt-5 max-w-xl text-lg text-white/85">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
