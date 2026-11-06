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
      // the Video Ads guides moved into the course (Marketing & Advertising → Video Ads)
      { source: "/resources/video-ads/formats", destination: "/knowledge-base/lesson/f7e0733d-b20a-4aae-a82a-c1cd297eff65", permanent: false },
      { source: "/resources/video-ads/hiring-editors", destination: "/knowledge-base/lesson/ad783257-a5e3-4491-b84b-dc233f12a1cd", permanent: false },
      { source: "/resources/video-ads", destination: "/knowledge-base/65f79636-2d9f-4416-900f-29986b0434b7/3e010849-f9b0-4738-9b23-f2bb209f29e3", permanent: false },
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
