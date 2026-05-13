"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

export function Marquee({
  items,
  speed = 40,
  className,
}: {
  items: ReactNode[];
  speed?: number;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const tween = gsap.to(track, {
      xPercent: -50,
      duration: speed,
      ease: "none",
      repeat: -1,
    });
    return () => {
      tween.kill();
    };
  }, [speed]);

  return (
    <div className={`overflow-hidden ${className ?? ""}`}>
      <div ref={trackRef} className="flex w-max gap-12 will-change-transform">
        {[...items, ...items].map((it, i) => (
          <span
            key={i}
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
