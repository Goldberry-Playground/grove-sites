import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Root vitest config — apps and packages can extend this.
//
// Default environment is "node" (fastest). Per-test-file directives like
// `// @vitest-environment happy-dom` switch on a DOM when needed for React
// component tests. This avoids paying the happy-dom startup cost on the
// pure-function tests that make up the bulk of the suite.

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/*/src/**/*.{test,spec}.{ts,tsx}",
      "apps/*/lib/**/*.{test,spec}.{ts,tsx}",
      "apps/*/app/**/*.{test,spec}.{ts,tsx}",
      "apps/*/data/**/*.{test,spec}.{ts,tsx}",
      "apps/*/components/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "packages/*/src/**/*.{ts,tsx}",
        "apps/*/lib/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "**/*.d.ts", "**/types.ts"],
    },
  },
  resolve: {
    alias: {
      "@grove/brand": path.resolve(__dirname, "packages/grove-brand/src"),
      "@grove/odoo-client": path.resolve(__dirname, "packages/odoo-client/src"),
      "@grove/ghost-client": path.resolve(__dirname, "packages/ghost-client/src"),
      "@grove/ui": path.resolve(__dirname, "packages/ui/src"),
      "@grove/config": path.resolve(__dirname, "packages/config/src"),
      "@grove/analytics": path.resolve(__dirname, "packages/analytics/src"),
      "@grove/newsletter": path.resolve(__dirname, "packages/newsletter/src"),
      "@grove/checkout/server": path.resolve(__dirname, "packages/checkout/src/server.ts"),
      "@grove/checkout": path.resolve(__dirname, "packages/checkout/src"),
      // `server-only` is a Next.js build-time marker (it throws when loaded in
      // a Client Component bundle). In Node-based tests, alias it to a no-op
      // so server modules can be imported without exploding.
      "server-only": path.resolve(__dirname, "vitest.server-only-stub.ts"),
    },
  },
});
