"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = {
  src: string;
  alt?: string;
  priority?: boolean;
  className?: string;
  parallax?: boolean;
  intensity?: number;
};

export function KenBurns({
  src,
  alt = "",
  priority,
  className,
  parallax = true,
  intensity = 1,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;

    const ctx = gsap.context(() => {
      gsap.set(img, { scale: 1.05, xPercent: -1, yPercent: -1 });
      gsap.to(img, {
        scale: 1.18 * intensity,
        xPercent: 1,
        yPercent: 1,
        duration: 16,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      if (parallax) {
        gsap.to(img, {
          yPercent: 12,
          ease: "none",
          scrollTrigger: {
            trigger: wrap,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }
    }, wrap);

    return () => ctx.revert();
  }, [parallax, intensity]);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className ?? ""}`}>
      <div ref={imgRef} className="absolute inset-[-4%] will-change-transform">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
