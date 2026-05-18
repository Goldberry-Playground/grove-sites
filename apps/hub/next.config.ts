import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@grove/ui",
    "@grove/analytics",
    "@grove/config",
    "@grove/ghost-client",
  ],
};

export default nextConfig;
