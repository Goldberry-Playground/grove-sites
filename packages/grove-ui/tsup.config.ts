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
});
