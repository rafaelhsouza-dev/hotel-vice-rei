"use client";

import Image from "next/image";
import { useState } from "react";
import { Lightbox } from "./Lightbox";

type Img = string | { src: string; alt?: string; caption?: string };

function normalize(images: Img[]) {
  return images.map((i) =>
    typeof i === "string" ? { src: i } : i,
  );
}

export function LightboxGallery({
  images,
  className,
  layoutClass,
  aspectClass,
  caption,
}: {
  images: Img[];
  className?: string;
  layoutClass?: string[];
  aspectClass?: string;
  caption?: string;
}) {
  const items = normalize(images);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  function openAt(i: number) {
    setIndex(i);
    setOpen(true);
  }

  return (
    <>
      <div className={className}>
        {items.map((img, i) => (
          <button
            key={img.src + i}
            type="button"
            onClick={() => openAt(i)}
            aria-label={`Open image ${i + 1}`}
            className={`group relative overflow-hidden rounded-2xl cursor-zoom-in ${
              layoutClass?.[i] ?? ""
            } ${aspectClass ?? ""}`}
          >
            <Image
              src={img.src}
              alt={img.alt ?? ""}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(min-width:1024px) 30vw, 50vw"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-[var(--color-ink)] opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      <Lightbox
        images={items.map((it) => ({
          ...it,
          caption: it.caption ?? caption,
        }))}
        open={open}
        index={index}
        onClose={() => setOpen(false)}
        onIndexChange={setIndex}
      />
    </>
  );
}
