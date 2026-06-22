"use client";

import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CONSENT_KEY = "vicerei-cookie-consent";

/**
 * Loads Google Analytics 4 only when:
 *  - a measurement ID is configured (NEXT_PUBLIC_GA_ID), and
 *  - the visitor has accepted cookies.
 * In the mock no ID is set, so this is a no-op until one is provided.
 */
export function Analytics() {
  useEffect(() => {
    if (!GA_ID) return;
    try {
      if (localStorage.getItem(CONSENT_KEY) !== "accepted") return;
    } catch {
      return;
    }
    if (document.getElementById("ga4-src")) return;

    const src = document.createElement("script");
    src.id = "ga4-src";
    src.async = true;
    src.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(src);

    const init = document.createElement("script");
    init.id = "ga4-init";
    init.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`;
    document.head.appendChild(init);
  }, []);

  return null;
}
