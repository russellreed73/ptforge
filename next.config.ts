import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every PTForge page depends on who is signed in and which business they
  // are viewing, so pages render per request. Cache Components stays off
  // until there are public pages worth caching.
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
