import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Course art and vault screenshots are served from /api/media (stable, CDN-cached) and resized here.
  images: {
    localPatterns: [{ pathname: "/api/media/**", search: "" }],
    qualities: [60, 75],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
  },
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  // Resources moved out of the Knowledge Base into their own section.
  async redirects() {
    return [
      { source: "/knowledge-base/resources", destination: "/resources", permanent: true },
      { source: "/knowledge-base/resources/:path*", destination: "/resources/:path*", permanent: true },
    ];
  },
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
