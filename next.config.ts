import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
