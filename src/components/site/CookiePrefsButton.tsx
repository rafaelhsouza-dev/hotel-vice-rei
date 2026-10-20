"use client";

import { OPEN_CONSENT_EVENT } from "./consent";

/** Footer link that reopens the cookie banner with the current choices. */
export function CookiePrefsButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      {label}
    </button>
  );
}
