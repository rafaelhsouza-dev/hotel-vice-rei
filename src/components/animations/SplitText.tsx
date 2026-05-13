"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type Props = {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
  splitBy?: "char" | "word";
  duration?: number;
  trigger?: "load" | "scroll";
};

export function SplitText({
  text,
  className,
  as: Tag = "span",
  delay = 0,
  splitBy = "word",
  duration = 1.0,
  trigger = "load",
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pieces = el.querySelectorAll("[data-split]");

    gsap.set(pieces, { yPercent: 110, opacity: 0 });

    const tween = gsap.to(pieces, {
      yPercent: 0,
      opacity: 1,
      duration,
      delay,
      ease: "power4.out",
      stagger: splitBy === "char" ? 0.02 : 0.06,
    });

    let st: ScrollTrigger | null = null;
    if (trigger === "scroll") {
      tween.pause();
      const mod = require("gsap/ScrollTrigger");
      const ScrollTrigger = mod.ScrollTrigger ?? mod.default;
      gsap.registerPlugin(ScrollTrigger);
      st = ScrollTrigger.create({
        trigger: el,
        start: "top 85%",
        onEnter: () => tween.play(),
      });
    }

    return () => {
      tween.kill();
      st?.kill();
    };
  }, [delay, splitBy, duration, trigger, text]);

  const pieces = splitBy === "char" ? Array.from(text) : text.split(/(\s+)/);

  return (
    // @ts-expect-error ref on dynamic Tag
    <Tag ref={ref} className={className} aria-label={text}>
      {pieces.map((piece, i) => {
        if (/^\s+$/.test(piece)) return <span key={i}>{piece}</span>;
        return (
          <span
            key={i}
            className="inline-block overflow-hidden align-baseline"
            aria-hidden="true"
          >
            <span data-split className="inline-block will-change-transform">
              {piece}
            </span>
          </span>
        );
      })}
    </Tag>
  );
}
