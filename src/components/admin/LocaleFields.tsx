"use client";

import { useState } from "react";
import { locales, localeFlags, type Locale } from "@/i18n/config";

/**
 * One labelled input per locale, shown as tabs so the four translations of a
 * field stay together without a wall of inputs.
 *
 * Values post as `<name>.<locale>` — `parseTrio` on the server reassembles them.
 * `variant="list"` treats each line of a textarea as one array entry.
 */
export function LocaleFields({
  name,
  label,
  values,
  variant = "text",
  rows = 4,
  required = false,
  help,
}: {
  name: string;
  label: string;
  values?: Partial<Record<Locale, string | string[]>>;
  variant?: "text" | "textarea" | "list";
  rows?: number;
  required?: boolean;
  help?: string;
}) {
  const [active, setActive] = useState<Locale>(locales[0]);

  const field =
    "w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-accent-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/15";

  const valueFor = (locale: Locale): string => {
    const raw = values?.[locale];
    if (Array.isArray(raw)) return raw.join("\n");
    return raw ?? "";
  };

  return (
    <fieldset>
      <legend className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </legend>

      <div className="mb-2 flex gap-1" role="tablist" aria-label={`Idioma para ${label}`}>
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={active === l}
            onClick={() => setActive(l)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium uppercase tracking-wider transition-colors ${
              active === l
                ? "bg-[var(--color-ink)] text-white"
                : "bg-[var(--color-line-soft)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            <span aria-hidden className="mr-1">
              {localeFlags[l]}
            </span>
            {l}
          </button>
        ))}
      </div>

      {/* All locales stay mounted so unedited translations still post. */}
      {locales.map((l) => (
        <div key={l} hidden={active !== l}>
          <label className="sr-only" htmlFor={`${name}-${l}`}>
            {label} ({l})
          </label>
          {variant === "text" ? (
            <input
              id={`${name}-${l}`}
              name={`${name}.${l}`}
              defaultValue={valueFor(l)}
              required={required && l === locales[0]}
              className={field}
            />
          ) : (
            <textarea
              id={`${name}-${l}`}
              name={`${name}.${l}`}
              defaultValue={valueFor(l)}
              rows={rows}
              required={required && l === locales[0]}
              className={field}
            />
          )}
        </div>
      ))}

      {(help || variant === "list") && (
        <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
          {help ?? "Uma entrada por linha."}
        </p>
      )}
    </fieldset>
  );
}
