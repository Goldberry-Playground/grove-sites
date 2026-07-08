import { defineConfig } from "tsup";

// Build the library to an ESM dist/ + .d.ts tree.
// /design-sync bundles dist/index.js into the Claude Design `window.*` global,
// and reads the .d.ts as each component's API contract — so dts: true is load-bearing.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  external: ["react", "react-dom"],
  clean: true,
  sourcemap: false,
  // tsup strips per-file "use client" directives when bundling to a single
  // entry, so server layouts importing the kit pulled createContext into a
  // Server Component (first caught by CI's Production build — local dev
  // never ran a fresh build). The banner marks the whole bundle as a client
  // boundary, which is correct: every component in the kit is presentational
  // client code, and Server Components may freely render client components.
  banner: { js: '"use client";' },
});
