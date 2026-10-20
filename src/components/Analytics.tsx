"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent, type Consent } from "./site/consent";

/**
 * Tag loading under Google Consent Mode v2.
 *
 * - GA4 and GTM load on every page (afterInteractive). Consent Mode keeps
 *   analytics/ad storage denied until the visitor chooses, so before consent
 *   they only send cookieless pings. The defaults are set by the inline
 *   `consent-default` script in the layout, which runs first.
 * - Microsoft Clarity and Hotjar load only after analytics consent.
 * - Meta Pixel and the Google Ads tag load only after marketing consent.
 *
 * Google Ads conversion: the booking flow calls track("purchase", …) from
 * src/lib/track.ts, which ends up as a dataLayer push (via gtag or directly).
 * gtag.js does not turn a GA4 `purchase` into an Ads conversion by itself, so
 * once marketing consent is given we wrap dataLayer.push — always calling the
 * original first — and, for each purchase seen, send
 * gtag('event','conversion',{send_to:`${id}/${label}`, value, currency,
 * transaction_id}) and fbq('track','Purchase'). gtag.js and GTM wrap push the
 * same way, so the chain holds whichever loads first. Sites using GTM can
 * configure the conversion there instead and leave the label empty.
 *
 * IDs arrive as props from the server, so the hotel changes them in the admin
 * without a redeploy.
 */

type Props = {
  ga4?: string;
  gtm?: string;
  clarity?: string;
  hotjar?: string;
  metaPixel?: string;
  googleAdsId?: string;
  googleAdsLabel?: string;
};

type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    __vrPurchaseHook?: boolean;
  }
}

const safeId = (v?: string) => (v && /^[A-Za-z0-9_-]+$/.test(v) ? v : "");

function inject(id: string, code: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.text = code;
  document.head.appendChild(s);
}

type PurchaseParams = { value?: unknown; currency?: unknown; transaction_id?: unknown };

/** Extract purchase params from either push shape: gtag Arguments or object. */
function purchaseFrom(entry: unknown): PurchaseParams | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string | number, unknown>;
  if (e[0] === "event" && e[1] === "purchase") {
    return (e[2] as PurchaseParams) ?? {};
  }
  if (e.event === "purchase") return e as PurchaseParams;
  return null;
}

function installPurchaseHook(adsId: string, adsLabel: string, pixel: boolean) {
  if (window.__vrPurchaseHook) return;
  window.__vrPurchaseHook = true;
  window.dataLayer = window.dataLayer || [];
  const layer = window.dataLayer as unknown[] & { push: (...items: unknown[]) => number };
  const seen = new Set<string>();

  const handle = (entry: unknown) => {
    const p = purchaseFrom(entry);
    if (!p) return;
    const tx = typeof p.transaction_id === "string" ? p.transaction_id : "";
    if (tx && seen.has(tx)) return;
    if (tx) seen.add(tx);
    const value = typeof p.value === "number" ? p.value : Number(p.value) || undefined;
    const currency = typeof p.currency === "string" ? p.currency : "EUR";
    // Deferred so the original push (and gtag's own processing) completes first.
    setTimeout(() => {
      try {
        if (adsId && adsLabel && typeof window.gtag === "function") {
          window.gtag("event", "conversion", {
            send_to: `${adsId}/${adsLabel}`,
            value,
            currency,
            transaction_id: tx || undefined,
          });
        }
        if (pixel && typeof window.fbq === "function") {
          window.fbq("track", "Purchase", { value, currency }, tx ? { eventID: tx } : undefined);
        }
      } catch {
        /* never break the booking flow */
      }
    }, 0);
  };

  const original = layer.push.bind(layer);
  layer.push = (...items: unknown[]) => {
    const result = original(...items);
    try {
      items.forEach(handle);
    } catch {
      /* ignore */
    }
    return result;
  };
}

export function Analytics(props: Props) {
  const ga4 = safeId(props.ga4);
  const gtm = safeId(props.gtm);
  const clarity = safeId(props.clarity);
  const hotjar = /^\d+$/.test(props.hotjar ?? "") ? props.hotjar! : "";
  const metaPixel = /^\d+$/.test(props.metaPixel ?? "") ? props.metaPixel! : "";
  const adsId = safeId(props.googleAdsId);
  const adsLabel = safeId(props.googleAdsLabel);

  const [consent, setConsent] = useState<Consent | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onChange = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const analyticsOk = Boolean(consent?.analytics);
  const marketingOk = Boolean(consent?.marketing);

  // Analytics-only tools.
  useEffect(() => {
    if (!analyticsOk) return;
    if (clarity) {
      inject(
        "ms-clarity",
        `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(clarity)});`,
      );
    }
    if (hotjar) {
      inject(
        "hotjar",
        `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${hotjar},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
      );
    }
  }, [analyticsOk, clarity, hotjar]);

  // Marketing tools: Meta Pixel, Google Ads tag and the purchase conversion.
  useEffect(() => {
    if (!marketingOk) return;
    if (metaPixel) {
      inject(
        "meta-pixel",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(metaPixel)});fbq('track','PageView');`,
      );
    }
    if (adsId) {
      // With no GA4 ID the gtag.js library is loaded for the Ads ID below.
      if (!ga4 && !document.getElementById("gtag-ads-src")) {
        const s = document.createElement("script");
        s.id = "gtag-ads-src";
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(adsId)}`;
        document.head.appendChild(s);
        window.gtag?.("js", new Date());
      }
      window.gtag?.("config", adsId);
    }
    if ((adsId && adsLabel) || metaPixel) {
      installPurchaseHook(adsLabel ? adsId : "", adsLabel, Boolean(metaPixel));
    }
  }, [marketingOk, metaPixel, adsId, adsLabel, ga4]);

  return (
    <>
      {ga4 && (
        <>
          <Script
            id="ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];if(typeof window.gtag!=='function'){window.gtag=function(){window.dataLayer.push(arguments);};}window.gtag('js',new Date());window.gtag('config',${JSON.stringify(ga4)});`}
          </Script>
        </>
      )}
      {gtm && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtm)});`}
        </Script>
      )}
    </>
  );
}
