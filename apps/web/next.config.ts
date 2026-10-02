import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are published as TypeScript source.
  transpilePackages: ["@edukemonos/curriculum", "@edukemonos/ai"],
};

export default nextConfig;
