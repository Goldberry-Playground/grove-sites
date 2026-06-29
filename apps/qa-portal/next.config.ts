import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker deploys (same pattern as the brand apps).
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
