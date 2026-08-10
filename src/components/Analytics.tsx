"use client";

import { useEffect } from "react";

const CONSENT_KEY = "vicerei-cookie-consent";

/**
 * Loads Google Analytics 4 (and optionally Tag Manager) only when:
 *  - an ID is configured in the backoffice, and
 *  - the visitor has accepted cookies.
 *
 * The IDs arrive as props from the server rather than from a build-time env
 * var, so the hotel can change them in the admin without a redeploy.
 */
export function Analytics({ ga4, gtm }: { ga4?: string; gtm?: string }) {
  useEffect(() => {
    if (!ga4 && !gtm) return;

    try {
      if (localStorage.getItem(CONSENT_KEY) !== "accepted") return;
    } catch {
      return; // storage blocked — treat as no consent
    }

    if (ga4 && !document.getElementById("ga4-src")) {
      const src = document.createElement("script");
      src.id = "ga4-src";
      src.async = true;
      src.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`;
      document.head.appendChild(src);

      const init = document.createElement("script");
      init.id = "ga4-init";
      init.textContent =
        `window.dataLayer=window.dataLayer||[];` +
        `function gtag(){dataLayer.push(arguments);}` +
        `gtag('js',new Date());` +
        `gtag('config',${JSON.stringify(ga4)},{anonymize_ip:true});`;
      document.head.appendChild(init);
    }

    if (gtm && !document.getElementById("gtm-src")) {
      const script = document.createElement("script");
      script.id = "gtm-src";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm)}`;
      document.head.appendChild(script);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    }
  }, [ga4, gtm]);

  return null;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}
