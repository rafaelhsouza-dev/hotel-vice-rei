"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

/** Copies the public path so it can be pasted into any image field. */
export function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(path);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
    >
      <Icon name={copied ? "check" : "link"} width={13} height={13} />
      {copied ? "Copiado" : "Copiar caminho"}
    </button>
  );
}
