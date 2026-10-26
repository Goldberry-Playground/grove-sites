import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (same as nursery).
  output: "standalone",
  // Workspace root is two directories up so the standalone tracer pulls in
  // any @grove/* package files from the monorepo.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
};

export default nextConfig;
