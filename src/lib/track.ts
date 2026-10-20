/**
 * Analytics events from client components. Pushes to the GTM/GA4 dataLayer
 * only — whether anything is sent is decided by Consent Mode, which keeps
 * storage denied until the visitor accepts cookies.
 */

type Params = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params: Params = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, params);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event, ...params });
    }
  } catch {
    /* analytics must never break the page */
  }
}
