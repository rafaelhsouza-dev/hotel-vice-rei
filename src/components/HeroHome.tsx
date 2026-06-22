"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { KenBurns } from "./animations/KenBurns";
import { BookingWidget } from "./BookingWidget";
import { Icon } from "./Icon";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function HeroHome({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const root = useRef<HTMLElement | null>(null);
  const eyebrowRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const subRef = useRef<HTMLParagraphElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      const title = titleRef.current!;
      const words = title.querySelectorAll("[data-word] > span");

      gsap.set(words, { yPercent: 110, opacity: 0 });
      gsap.set(eyebrowRef.current, { opacity: 0, y: 14 });
      gsap.set(subRef.current, { opacity: 0, y: 18 });
      gsap.set(ctaRef.current, { opacity: 0, y: 18 });
      gsap.set(widgetRef.current, { opacity: 0, y: 30 });

      const tl = gsap.timeline({
        delay: 0.2,
        defaults: { ease: "power4.out" },
      });

      tl.to(
          eyebrowRef.current,
          { opacity: 1, y: 0, duration: 0.8 },
          0.2,
        )
        .to(
          words,
          {
            yPercent: 0,
            opacity: 1,
            duration: 1.0,
            stagger: 0.07,
          },
          0.3,
        )
        .to(
          subRef.current,
          { opacity: 1, y: 0, duration: 0.9 },
          0.7,
        )
        .to(
          ctaRef.current,
          { opacity: 1, y: 0, duration: 0.9 },
          0.85,
        )
        .to(
          widgetRef.current,
          { opacity: 1, y: 0, duration: 1.0 },
          0.95,
        );

      // Subtle fade on scroll for text
      gsap.to([eyebrowRef.current, titleRef.current, subRef.current, ctaRef.current], {
        y: -40,
        opacity: 0.2,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  const titleWords = dict.hero.title.split(" ");

  return (
    <section
      ref={root}
      className="relative isolate -mt-20 min-h-[100svh] overflow-hidden"
    >
      <KenBurns
        src="/images/hero/hero-main.jpg"
        alt=""
        priority
        className="absolute inset-0"
        intensity={1}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/75" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_75%)]" />
      {/* Grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.8 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Reveal veil — pure CSS so the hero image is always revealed,
          even if client JS fails to run. */}
      <div
        aria-hidden
        className="hero-veil pointer-events-none absolute inset-0 bg-black"
      />

      <div className="relative container-x flex min-h-[100svh] flex-col justify-end pb-10 pt-28 sm:pt-32 lg:pt-44 text-white">
        <div className="max-w-3xl">
          <div ref={eyebrowRef}>
            <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/90">
              <span aria-hidden className="h-px w-6 bg-white/70" />
              {dict.hero.eyebrow}
            </span>
          </div>
          <h1
            ref={titleRef}
            aria-label={dict.hero.title}
            className="mt-4 sm:mt-5 font-display text-[2.5rem] sm:text-6xl lg:text-7xl leading-[1] sm:leading-[0.95] tracking-tight text-balance"
          >
            {titleWords.map((w, i) => (
              <span
                key={i}
                data-word
                className="inline-block overflow-hidden align-baseline mr-[0.18em]"
              >
                <span className="inline-block will-change-transform">
                  {w}
                </span>
              </span>
            ))}
          </h1>
          <p
            ref={subRef}
            className="mt-5 sm:mt-6 max-w-xl text-base sm:text-lg text-white/85 leading-relaxed"
          >
            {dict.hero.subtitle}
          </p>
          <div ref={ctaRef} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/${locale}/reservar`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)] transition-colors"
            >
              {dict.cta.bookNow}
              <Icon name="arrow-right" width={14} height={14} />
            </Link>
            <Link
              href={`/${locale}/quartos`}
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              {dict.cta.seeRooms}
            </Link>
            <span className="inline-flex items-center gap-2 text-xs text-white/80 ml-2">
              <Icon name="shield" width={14} height={14} />
              {dict.hero.badge}
            </span>
          </div>
        </div>
        <div ref={widgetRef} className="mt-8 sm:mt-10 lg:mt-14">
          <BookingWidget locale={locale} dict={dict} />
        </div>
      </div>

      {/* Scroll hint — only on lg+ to avoid overlapping booking widget */}
      <div className="hidden lg:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/60 text-[10px] tracking-[0.3em] uppercase flex-col items-center gap-2 animate-bounce pointer-events-none">
        <span>{dict.hero.scroll}</span>
        <span className="block h-8 w-px bg-white/30" />
      </div>
    </section>
  );
}
