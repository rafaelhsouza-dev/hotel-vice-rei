"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { MOTION_OK } from "./motion";

export function Marquee({
  items,
  speed = 40,
  className,
}: {
  items: ReactNode[];
  speed?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;

    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const tween = gsap.to(track, {
        xPercent: -50,
        duration: speed,
        ease: "none",
        repeat: -1,
      });
      // Pause on hover and keyboard focus (WCAG 2.2.2).
      const pause = () => tween.pause();
      const play = () => tween.play();
      wrap.addEventListener("mouseenter", pause);
      wrap.addEventListener("mouseleave", play);
      wrap.addEventListener("focusin", pause);
      wrap.addEventListener("focusout", play);
      return () => {
        wrap.removeEventListener("mouseenter", pause);
        wrap.removeEventListener("mouseleave", play);
        wrap.removeEventListener("focusin", pause);
        wrap.removeEventListener("focusout", play);
      };
    });
    return () => mm.revert();
  }, [speed]);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className ?? ""}`}>
      <div ref={trackRef} className="flex w-max gap-12 will-change-transform">
        {[...items, ...items].map((it, i) => (
          <span
            key={i}
            // The second copy only exists for the seamless loop.
            aria-hidden={i >= items.length ? true : undefined}
            className="inline-flex items-center gap-12 whitespace-nowrap"
          >
            {it}
            <span aria-hidden className="text-[var(--color-accent)]">
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
