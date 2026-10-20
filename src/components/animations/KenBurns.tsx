"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MOTION_OK } from "./motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = {
  src: string;
  alt?: string;
  /** Preload as the LCP image (page heroes only). */
  preload?: boolean;
  className?: string;
  parallax?: boolean;
  intensity?: number;
};

export function KenBurns({
  src,
  alt = "",
  preload,
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

    // Ken Burns and parallax only when reduced motion is not requested;
    // matchMedia reverts them live if the preference changes.
    const mm = gsap.matchMedia(wrap);
    mm.add(MOTION_OK, () => {
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
    });

    return () => mm.revert();
  }, [parallax, intensity]);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className ?? ""}`}>
      <div ref={imgRef} className="absolute inset-[-4%] will-change-transform">
        <Image
          src={src}
          alt={alt}
          fill
          preload={preload}
          sizes="100vw"
          // Heroes always sit under a dark gradient, so a lower quality is
          // indistinguishable here and meaningfully cheaper for LCP.
          quality={68}
          className="object-cover"
        />
      </div>
    </div>
  );
}
