import type { NextConfig } from "next";

/**
 * Basic security headers on every page: no framing (so no clickjacking of a student's
 * session), no MIME sniffing, a referrer that never carries paths to other sites, and no
 * access to the camera, microphone or location, which Eduka never uses.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  // Workspace packages are published as TypeScript source.
  transpilePackages: ["@edukemonos/curriculum", "@edukemonos/ai"],
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
