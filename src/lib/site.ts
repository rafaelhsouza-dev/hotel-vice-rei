/**
 * Canonical origin for absolute URLs (metadata, sitemap, JSON-LD, OG images).
 * Set NEXT_PUBLIC_SITE_URL in the environment; the constant below is the
 * production fallback.
 */
const RAW = process.env.NEXT_PUBLIC_SITE_URL || "https://www.hotelvicerei.com";

/** No trailing slash — every caller concatenates its own path. */
export const SITE_URL = RAW.replace(/\/+$/, "");

export const OG_IMAGE = `${SITE_URL}/images/hero/banner-home.jpg`;
