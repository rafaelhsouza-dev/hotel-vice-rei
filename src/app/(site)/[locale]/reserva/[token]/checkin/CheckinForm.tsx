"use client";

import { useActionState } from "react";
import type { Locale } from "@/i18n/config";
import { getEngineStrings } from "@/i18n/engine";
import { submitCheckin, type CheckinState } from "../../actions";

type GuestValues = {
  firstName: string;
  lastName: string;
  nationality: string;
  birthDate: string;
  birthPlace: string;
  documentType: string;
  documentNumber: string;
  documentCountry: string;
  residenceCountry: string;
  residenceCity: string;
};

/**
 * Online check-in, built for phones: one fieldset per guest, native date and
 * select inputs, autocomplete hints, and errors attached to the exact field.
 */
export function CheckinForm({
  token,
  locale,
  rows,
  countries,
  guests,
  primary,
  eta,
}: {
  token: string;
  locale: Locale;
  rows: number;
  countries: { code: string; name: string }[];
  guests: GuestValues[];
  primary: { firstName: string; lastName: string };
  eta: string;
}) {
  const s = getEngineStrings(locale);
  const [state, action, pending] = useActionState<CheckinState, FormData>(submitCheckin, { ok: false, message: "" });
  const bad = new Set(state.fields ?? []);
  const sent = state.values;
  const v = (name: string, fallback: string) => (sent ? (sent[name] ?? "") : fallback);
  const field =
    "w-full rounded-xl border bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-deep)]";
  const tone = (name: string) => (bad.has(name) ? "border-red-500" : "border-[var(--color-line)]");
  const label = "mb-1 block text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink-muted)]";
  const today = new Date().toISOString().slice(0, 10);

  if (state.ok) {
    return (
      <p role="status" className="mt-8 rounded-3xl bg-emerald-50 p-6 text-emerald-900">
        {s.checkinDone}
      </p>
    );
  }

  return (
    <form action={action} className="mt-8 grid gap-6" noValidate>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="guestCount" value={rows} />
      {Array.from({ length: rows }).map((_, i) => {
        const g = guests[i];
        const p = `g${i}`;
        const err = (k: string) =>
          bad.has(`${p}.${k}`) ? (
            <span id={`${p}-${k}-err`} className="mt-1 block text-xs text-red-700">
              {s.required}
            </span>
          ) : null;
        const describedBy = (k: string) => (bad.has(`${p}.${k}`) ? `${p}-${k}-err` : undefined);
        return (
          <fieldset key={i} className="rounded-3xl bg-white p-5 hairline sm:p-6">
            <legend className="px-1 font-display text-lg">{s.guest(i + 1)}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor={`${p}-fn`}>{s.firstNames}</label>
                <input id={`${p}-fn`} name={`${p}.firstName`} defaultValue={v(`${p}.firstName`, g?.firstName ?? (i === 0 ? primary.firstName : ""))} autoComplete={i === 0 ? "given-name" : "off"} aria-invalid={bad.has(`${p}.firstName`)} aria-describedby={describedBy("firstName")} className={`${field} ${tone(`${p}.firstName`)}`} />
                {err("firstName")}
              </div>
              <div>
                <label className={label} htmlFor={`${p}-ln`}>{s.lastName}</label>
                <input id={`${p}-ln`} name={`${p}.lastName`} defaultValue={v(`${p}.lastName`, g?.lastName ?? (i === 0 ? primary.lastName : ""))} autoComplete={i === 0 ? "family-name" : "off"} aria-invalid={bad.has(`${p}.lastName`)} aria-describedby={describedBy("lastName")} className={`${field} ${tone(`${p}.lastName`)}`} />
                {err("lastName")}
              </div>
              <div>
                <label className={label} htmlFor={`${p}-nat`}>{s.nationality}</label>
                <select id={`${p}-nat`} name={`${p}.nationality`} defaultValue={v(`${p}.nationality`, g?.nationality ?? "")} aria-invalid={bad.has(`${p}.nationality`)} aria-describedby={describedBy("nationality")} className={`${field} ${tone(`${p}.nationality`)}`}>
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                {err("nationality")}
              </div>
              <div>
                <label className={label} htmlFor={`${p}-bd`}>{s.birthDate}</label>
                <input id={`${p}-bd`} name={`${p}.birthDate`} type="date" max={today} defaultValue={v(`${p}.birthDate`, g?.birthDate ?? "")} autoComplete={i === 0 ? "bday" : "off"} aria-invalid={bad.has(`${p}.birthDate`)} aria-describedby={describedBy("birthDate")} className={`${field} ${tone(`${p}.birthDate`)}`} />
                {err("birthDate")}
              </div>
              <div>
                <label className={label} htmlFor={`${p}-bp`}>{s.birthPlace}</label>
                <input id={`${p}-bp`} name={`${p}.birthPlace`} defaultValue={v(`${p}.birthPlace`, g?.birthPlace ?? "")} aria-invalid={bad.has(`${p}.birthPlace`)} aria-describedby={describedBy("birthPlace")} className={`${field} ${tone(`${p}.birthPlace`)}`} />
                {err("birthPlace")}
              </div>
              <div>
                <label className={label} htmlFor={`${p}-dt`}>{s.docType}</label>
                <select id={`${p}-dt`} name={`${p}.documentType`} defaultValue={v(`${p}.documentType`, g?.documentType ?? "P") || "P"} className={`${field} border-[var(--color-line)]`}>
                  <option value="P">{s.docPassport}</option>
                  <option value="B">{s.docIdCard}</option>
                  <option value="O">{s.docOther}</option>
                </select>
              </div>
              <div>
                <label className={label} htmlFor={`${p}-dn`}>{s.docNumber}</label>
                <input id={`${p}-dn`} name={`${p}.documentNumber`} defaultValue={v(`${p}.documentNumber`, g?.documentNumber ?? "")} autoCapitalize="characters" spellCheck={false} aria-invalid={bad.has(`${p}.documentNumber`)} aria-describedby={describedBy("documentNumber")} className={`${field} ${tone(`${p}.documentNumber`)} font-mono`} />
                {err("documentNumber")}
              </div>
              <div>
                <label className={label} htmlFor={`${p}-dc`}>{s.docCountry}</label>
                <select id={`${p}-dc`} name={`${p}.documentCountry`} defaultValue={v(`${p}.documentCountry`, g?.documentCountry ?? "")} aria-invalid={bad.has(`${p}.documentCountry`)} aria-describedby={describedBy("documentCountry")} className={`${field} ${tone(`${p}.documentCountry`)}`}>
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                {err("documentCountry")}
              </div>
              <div>
                <label className={label} htmlFor={`${p}-rc`}>{s.residenceCountry}</label>
                <select id={`${p}-rc`} name={`${p}.residenceCountry`} defaultValue={v(`${p}.residenceCountry`, g?.residenceCountry ?? "")} aria-invalid={bad.has(`${p}.residenceCountry`)} aria-describedby={describedBy("residenceCountry")} className={`${field} ${tone(`${p}.residenceCountry`)}`}>
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                {err("residenceCountry")}
              </div>
              <div>
                <label className={label} htmlFor={`${p}-rcity`}>{s.residenceCity}</label>
                <input id={`${p}-rcity`} name={`${p}.residenceCity`} defaultValue={v(`${p}.residenceCity`, g?.residenceCity ?? "")} autoComplete={i === 0 ? "address-level2" : "off"} aria-invalid={bad.has(`${p}.residenceCity`)} aria-describedby={describedBy("residenceCity")} className={`${field} ${tone(`${p}.residenceCity`)}`} />
                {err("residenceCity")}
              </div>
            </div>
          </fieldset>
        );
      })}

      <div className="grid gap-4 rounded-3xl bg-white p-5 hairline sm:grid-cols-2 sm:p-6">
        <div>
          <label className={label} htmlFor="ci-eta">{s.eta}</label>
          <input id="ci-eta" name="eta" type="time" defaultValue={v("eta", eta)} className={`${field} border-[var(--color-line)]`} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="ci-req">{s.requests}</label>
          <textarea id="ci-req" name="requests" rows={3} maxLength={1000} defaultValue={v("requests", "")} className={`${field} border-[var(--color-line)]`} />
        </div>
        <label className={`flex items-start gap-3 text-sm sm:col-span-2 ${bad.has("consent") ? "text-red-700" : ""}`}>
          <input type="checkbox" name="consent" defaultChecked={sent?.consent === "on"} className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{s.consent}</span>
        </label>
      </div>

      {state.message && !state.ok && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message === "rate_limited" ? s.errors.rate_limited : state.message === "closed" ? s.checkinClosed : state.message === "consent" ? s.errors.terms : s.checkinInvalid}
        </p>
      )}

      <div>
        <button type="submit" disabled={pending} className="inline-flex items-center rounded-full bg-[var(--color-ink)] px-7 py-3.5 text-sm font-medium text-white hover:bg-[var(--color-accent-deep)] disabled:opacity-50">
          {pending ? "…" : s.submitCheckin}
        </button>
      </div>
    </form>
  );
}
