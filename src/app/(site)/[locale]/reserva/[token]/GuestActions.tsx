"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";
import { getEngineStrings } from "@/i18n/engine";
import { cancelByGuest, payBalance, type GuestPayResult } from "../actions";

/** Pay what is due and, when free, cancel — the two things a guest does alone. */
export function GuestActions({
  token,
  locale,
  payable,
  methods,
  canSelfCancel,
  contactOnly,
  phone,
  email,
  defaultPhone,
}: {
  token: string;
  locale: Locale;
  payable: number;
  methods: ("card" | "mbway" | "multibanco")[];
  canSelfCancel: boolean;
  contactOnly: boolean;
  phone: string;
  email: string;
  defaultPhone: string;
}) {
  const s = getEngineStrings(locale);
  const router = useRouter();
  const [method, setMethod] = useState(methods[0] ?? "");
  const [mbPhone, setMbPhone] = useState(defaultPhone);
  const [result, setResult] = useState<GuestPayResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const nf = new Intl.NumberFormat({ pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" }[locale], { style: "currency", currency: "EUR" });

  const label = (m: string) => (m === "card" ? s.methodCard : m === "mbway" ? s.methodMbway : s.methodMultibanco);

  function pay() {
    setMessage("");
    start(async () => {
      const r = await payBalance(token, method, mbPhone);
      if (r.ok && r.kind === "redirect") {
        window.location.assign(r.url);
        return;
      }
      setResult(r);
      if (!r.ok) setMessage(r.message === "rate_limited" ? s.errors.rate_limited : s.paymentRetry);
    });
  }

  function cancel() {
    start(async () => {
      const r = await cancelByGuest(token, confirm);
      setMessage(r.ok ? s.cancelDone : s.cancelContact);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="mt-6 grid gap-6">
      {payable > 0 && (
        <div className="rounded-3xl bg-white p-6 hairline">
          <p className="font-medium">
            {s.amountDue}: {nf.format(payable)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={s.payment}>
            {methods.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${method === m ? "border-[var(--color-accent-deep)] bg-[var(--color-line-soft)]" : "border-[var(--color-line)]"}`}>
                <input type="radio" name="m" checked={method === m} onChange={() => setMethod(m)} className="h-4 w-4" />
                {label(m)}
              </label>
            ))}
          </div>
          {method === "mbway" && (
            <div className="mt-3">
              <label className="mb-1 block text-xs text-[var(--color-ink-muted)]" htmlFor="ga-mb">
                {s.mbwayPhone}
              </label>
              <input id="ga-mb" type="tel" autoComplete="tel" value={mbPhone} onChange={(e) => setMbPhone(e.target.value)} className="w-full rounded-xl border border-[var(--color-line)] px-4 py-3 text-base sm:max-w-xs" />
            </div>
          )}
          <button
            type="button"
            onClick={pay}
            disabled={pending || !method}
            className="mt-4 inline-flex items-center rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] disabled:opacity-50"
          >
            {pending ? "…" : s.payNow}
          </button>
          {result?.ok && result.kind === "multibanco" && (
            <dl className="mt-4 grid max-w-xs grid-cols-2 gap-2 text-sm" role="status">
              <dt className="text-[var(--color-ink-muted)]">Entidade</dt>
              <dd className="font-mono">{result.entity}</dd>
              <dt className="text-[var(--color-ink-muted)]">Referência</dt>
              <dd className="font-mono">{result.reference.replace(/(\d{3})(?=\d)/g, "$1 ")}</dd>
              <dt className="text-[var(--color-ink-muted)]">Valor</dt>
              <dd>{nf.format(result.amount)}</dd>
            </dl>
          )}
          {result?.ok && result.kind === "mbway" && <p role="status" className="mt-4 text-sm">{s.mbwayWaiting}</p>}
          <p className="mt-3 text-xs text-[var(--color-ink-muted)]">{s.secure}</p>
        </div>
      )}

      {canSelfCancel && (
        <div className="rounded-3xl bg-white p-6 hairline">
          <p className="font-medium">{s.cancelTitle}</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{s.cancelFree}</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="h-5 w-5" /> {s.cancelConfirm}
          </label>
          <button
            type="button"
            onClick={cancel}
            disabled={!confirm || pending}
            className="mt-4 inline-flex items-center rounded-full border border-red-300 bg-white px-6 py-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {s.cancelButton}
          </button>
        </div>
      )}
      {contactOnly && (
        <p className="text-sm text-[var(--color-ink-soft)]">
          {s.cancelContact}{" "}
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="underline">
            {phone}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${email}`} className="underline">
            {email}
          </a>
        </p>
      )}
      {message && (
        <p role="status" className="rounded-2xl bg-[var(--color-line-soft)] px-4 py-3 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
