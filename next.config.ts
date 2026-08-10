import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js — required by the
  // Docker image used for the EasyPanel deploy.
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 rejects any quality not listed here and silently falls back to
    // 75, so the lower setting the heroes ask for has to be declared.
    qualities: [68, 75],
  },
};

export default nextConfig;
