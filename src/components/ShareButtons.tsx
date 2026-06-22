"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "./Icon";

export function ShareButtons({
  dict,
  url,
  title,
}: {
  dict: Dictionary;
  url: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const links = [
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
      icon: "facebook" as const,
    },
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?url=${enc}&text=${encTitle}`,
      icon: "twitter" as const,
    },
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encTitle}%20${enc}`,
      icon: "whatsapp" as const,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
        {dict.share.label}
      </span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          aria-label={l.name}
          className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-accent-deep)] hover:text-[var(--color-accent-deep)]"
        >
          <Icon name={l.icon} width={15} height={15} />
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy link"}
        className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-accent-deep)] hover:text-[var(--color-accent-deep)]"
      >
        <Icon name={copied ? "check" : "link"} width={15} height={15} />
      </button>
    </div>
  );
}
