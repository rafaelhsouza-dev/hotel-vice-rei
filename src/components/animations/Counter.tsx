"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = {
  value: string;
  className?: string;
};

export function Counter({ value, className }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const match = value.match(/^(\d+(?:\.\d+)?)/);
    if (!match) {
      setDisplay(value);
      return;
    }

    const target = parseFloat(match[1]);
    const suffix = value.slice(match[1].length);
    const obj = { v: 0 };

    setDisplay("0" + suffix);

    const tween = gsap.to(obj, {
      v: target,
      duration: 1.6,
      ease: "power3.out",
      paused: true,
      onUpdate: () => {
        const cur =
          target % 1 === 0 ? Math.round(obj.v) : obj.v.toFixed(1);
        setDisplay(`${cur}${suffix}`);
      },
    });

    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      onEnter: () => tween.play(),
      once: true,
    });

    return () => {
      tween.kill();
      st.kill();
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
