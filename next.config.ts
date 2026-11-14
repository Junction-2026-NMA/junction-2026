import type { NextConfig } from "next";

// Optional, for a deployment that is only the phone demo (both unset: nothing changes).
// SISU_API_ORIGIN  e.g. https://sisu-api.vercel.app — every /api request is forwarded there, so this site uses
//                  the team's hosted backend (per-visitor state, its own keys) instead of its own API routes.
// SISU_HOME        e.g. /app — where the site's root address sends a visitor.
const apiOrigin = process.env.SISU_API_ORIGIN?.replace(/\/+$/, "");
const home = process.env.SISU_HOME;

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    if (!apiOrigin) return [];
    return { beforeFiles: [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }], afterFiles: [], fallback: [] };
  },
  async redirects() {
    if (!home || home === "/") return [];
    return [{ source: "/", destination: home, permanent: false }];
  },
};

export default nextConfig;
