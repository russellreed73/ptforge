import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every PTForge page depends on who is signed in and which business they
  // are viewing, so pages render per request. Cache Components stays off
  // until there are public pages worth caching.
  experimental: {
    serverActions: {
      // Logo uploads (Settings). Vercel rejects request bodies over 4.5 MB,
      // so the logo limit in src/server/brand/logo.ts is 4 MB.
      bodySizeLimit: "4.5mb",
    },
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
