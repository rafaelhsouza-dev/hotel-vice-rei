import type { NextConfig } from "next";

/**
 * Baseline security headers for every response. A strict CSP is left out on
 * purpose: GA4, GTM, the Meta pixel and the payment pages each need their own
 * script and frame sources, and a wrong CSP breaks checkout silently.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js — required by the
  // Docker image used for the EasyPanel deploy.
  output: "standalone",
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 rejects any quality not listed here and silently falls back to
    // 75, so the lower setting the heroes ask for has to be declared.
    qualities: [68, 75],
  },
  experimental: {
    serverActions: {
      // Uploads (media library, fault photos) are capped at 8 MB per file in
      // lib/uploads.ts; leave room for the multipart overhead.
      bodySizeLimit: "9mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The backoffice and the guest's own booking pages must never be indexed.
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/:locale/reserva/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
