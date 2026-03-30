import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@grove/ui",
    "@grove/odoo-client",
    "@grove/ghost-client",
    "@grove/analytics",
    "@grove/config",
  ],
};

export default nextConfig;
