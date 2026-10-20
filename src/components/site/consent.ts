/**
 * Cookie consent: storage format, Google Consent Mode v2 signals and the
 * window events the banner, the footer link and the analytics loader share.
 *
 * Stored under one localStorage key. Older builds stored the plain strings
 * "accepted" / "rejected"; those still read as all-or-nothing.
 */

export const CONSENT_KEY = "vicerei-cookie-consent";
/** Fired on window after the visitor saves a choice. detail: Consent. */
export const CONSENT_EVENT = "vr:consent";
/** Fired on window to reopen the banner (footer "Cookie preferences"). */
export const OPEN_CONSENT_EVENT = "vr:open-consent";

export type Consent = { analytics: boolean; marketing: boolean };

export function parseConsent(raw: string | null): Consent | null {
  if (!raw) return null;
  if (raw === "accepted") return { analytics: true, marketing: true };
  if (raw === "rejected") return { analytics: false, marketing: false };
  try {
    const j = JSON.parse(raw) as Partial<Consent>;
    return { analytics: Boolean(j.analytics), marketing: Boolean(j.marketing) };
  } catch {
    return null;
  }
}

export function readConsent(): Consent | null {
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null; // storage blocked — treat as undecided
  }
}

/** Consent Mode v2 fields for a choice. */
export function consentSignals(c: Consent) {
  const ads = c.marketing ? "granted" : "denied";
  return {
    analytics_storage: c.analytics ? "granted" : "denied",
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
  } as const;
}

/** Persist, tell Google, and let the loaders react. */
export function saveConsent(c: Consent): void {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ v: 2, analytics: c.analytics, marketing: c.marketing, ts: Date.now() }),
    );
  } catch {
    /* storage unavailable — the choice still applies to this page view */
  }
  try {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag() {
        // gtag.js expects the Arguments object itself, not an array.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
    }
    window.gtag("consent", "update", consentSignals(c));
  } catch {
    /* analytics must never break the page */
  }
  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_EVENT, { detail: c }));
}

/**
 * Inline, runs before any Google tag: everything denied by default, then the
 * stored choice (if any) restored. `wait_for_update` gives the banner time on
 * a first visit before tags fire their cookieless pings.
 */
export const CONSENT_DEFAULT_SCRIPT = `(function(){
var w=window;w.dataLayer=w.dataLayer||[];
if(typeof w.gtag!=='function'){w.gtag=function(){w.dataLayer.push(arguments);};}
w.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
w.gtag('set','ads_data_redaction',true);
w.gtag('set','url_passthrough',false);
try{var raw=localStorage.getItem(${JSON.stringify(CONSENT_KEY)});var a=null,m=null;
if(raw==='accepted'){a=true;m=true;}else if(raw==='rejected'){a=false;m=false;}
else if(raw&&raw.charAt(0)==='{'){var j=JSON.parse(raw);a=!!j.analytics;m=!!j.marketing;}
if(a!==null){var g=m?'granted':'denied';w.gtag('consent','update',{analytics_storage:a?'granted':'denied',ad_storage:g,ad_user_data:g,ad_personalization:g});}
}catch(e){}
})();`;
