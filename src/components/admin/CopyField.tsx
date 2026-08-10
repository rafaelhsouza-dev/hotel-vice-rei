"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Read-only URL with a copy button.
 *
 * The calendar URLs carry a secret and are long enough that hand-selecting
 * them invites truncation, which fails silently on the channel's side hours
 * later. The input stays readable so the operator can still verify what they
 * are pasting.
 */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-40 shrink-0 text-xs uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        {label}
      </span>
      <input
        readOnly
        value={value}
        aria-label={`Endereço do calendário: ${label}`}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-line-soft)] px-3 py-2 font-mono text-xs text-[var(--color-ink-soft)]"
      />
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-white px-4 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
      >
        <Icon name={copied ? "check" : "link"} width={14} height={14} />
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
