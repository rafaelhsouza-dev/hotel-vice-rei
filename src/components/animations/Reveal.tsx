"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MOTION_OK } from "./motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = {
  children: ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  delay?: number;
  y?: number;
  stagger?: boolean;
  duration?: number;
  once?: boolean;
};

export function Reveal({
  children,
  as = "div",
  className,
  delay = 0,
  y = 32,
  stagger = false,
  duration = 0.9,
  once = true,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = stagger ? Array.from(el.children) : [el];

    // Under reduced motion nothing is hidden or moved: content stays as painted.
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.set(targets, { opacity: 0, y });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration,
        delay,
        ease: "power3.out",
        stagger: stagger ? 0.08 : 0,
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: once ? "play none none none" : "play none none reverse",
        },
      });
    });

    return () => mm.revert();
  }, [delay, y, stagger, duration, once]);

  const Tag = as as keyof React.JSX.IntrinsicElements;
  return (
    // @ts-expect-error generic ref attribute
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
