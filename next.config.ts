import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  // Shown on the login page. Bump "version" in package.json with each release.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  cacheComponents: true,
  // Staff photos and the bank QR are sent through server actions (default limit 1 MB).
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  partialPrefetching: true,
  // Product photos are compressed in the browser before upload, so skip
  // server-side image optimization (and its hosting cost).
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
