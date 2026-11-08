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
  // Pages can't be shown inside other sites' frames (clickjacking), except
  // the embeddable Apply form under /embed/, which coaches put on their sites.
  async headers() {
    return [
      {
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
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
