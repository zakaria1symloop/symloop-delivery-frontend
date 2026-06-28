import type { NextConfig } from "next";

// Live backend (plain HTTP on the VPS). The browser must NOT call this directly
// from an HTTPS (Vercel) page — that's mixed content and gets blocked. Instead we
// proxy same-origin: browser -> https://<vercel>/api/v1 -> Vercel rewrites
// server-side -> this HTTP origin. (On Vercel set NEXT_PUBLIC_API_URL="/api/v1".)
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://72.60.190.211:4000";

const nextConfig: NextConfig = {
  // Dev-only: allow HMR/client resources over the LAN IP (phones / other devices).
  allowedDevOrigins: ["192.168.100.123"],

  // Same-origin proxy to the HTTP backend (avoids mixed content on HTTPS hosts).
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${BACKEND_ORIGIN}/api/v1/:path*` },
      { source: "/storage/:path*", destination: `${BACKEND_ORIGIN}/storage/:path*` },
    ];
  },
};

export default nextConfig;
