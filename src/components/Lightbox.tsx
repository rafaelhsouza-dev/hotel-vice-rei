"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { Icon } from "./Icon";

type LightboxProps = {
  images: { src: string; alt?: string; caption?: string }[];
  open: boolean;
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
};

export function Lightbox({
  images,
  open,
  index,
  onClose,
  onIndexChange,
}: LightboxProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const backdrop = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = images.length;

  const prev = useCallback(
    () => onIndexChange((index - 1 + total) % total),
    [index, total, onIndexChange],
  );
  const next = useCallback(
    () => onIndexChange((index + 1) % total),
    [index, total, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, prev, next, onClose]);

  useEffect(() => {
    if (!open || !backdrop.current || !stage.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        backdrop.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: "power2.out" },
      );
      gsap.fromTo(
        stage.current,
        { opacity: 0, scale: 0.97, y: 12 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "expo.out" },
      );
    }, root);
    return () => ctx.revert();
  }, [open]);

  // Animate image swap when index changes
  useEffect(() => {
    if (!open || !stage.current) return;
    const img = stage.current.querySelector("[data-lb-image]");
    if (!img) return;
    gsap.fromTo(
      img,
      { opacity: 0, x: 12 },
      { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" },
    );
  }, [index, open]);

  if (!mounted || !open) return null;

  const current = images[index];
  if (!current) return null;

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) prev();
      else next();
    }
    touchStart.current = null;
  }

  return createPortal(
    <div
      ref={root}
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
    >
      <div
        ref={backdrop}
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6 text-white">
        <span className="text-xs sm:text-sm tracking-[0.2em] uppercase text-white/70">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full border border-white/20 hover:border-white/40 hover:bg-white/10 transition-colors"
        >
          <Icon name="close" />
        </button>
      </div>

      {/* stage */}
      <div
        ref={stage}
        className="absolute inset-0 flex items-center justify-center px-4 sm:px-16 lg:px-24 pointer-events-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative w-full max-w-6xl h-[68vh] sm:h-[78vh] pointer-events-auto">
          <div
            data-lb-image
            className="absolute inset-0 will-change-transform"
          >
            <Image
              src={current.src}
              alt={current.alt ?? ""}
              fill
              priority
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      </div>

      {/* prev/next */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous"
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-10 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full border border-white/20 bg-black/30 text-white hover:bg-black/60 hover:border-white/40 transition-colors"
      >
        <Icon name="chevron-right" className="rotate-180" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next"
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-10 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full border border-white/20 bg-black/30 text-white hover:bg-black/60 hover:border-white/40 transition-colors"
      >
        <Icon name="chevron-right" />
      </button>

      {/* caption */}
      {current.caption && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-4 text-center text-sm text-white/80 max-w-xl">
          {current.caption}
        </div>
      )}
    </div>,
    document.body,
  );
}
