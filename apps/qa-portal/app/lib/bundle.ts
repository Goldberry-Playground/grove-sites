import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Brand } from "./brands";

// Where the predev/prebuild sync hook copies dist-bundles/<brand>/.
// Assumes process.cwd() is the apps/qa-portal root (guaranteed by Next under next dev/build/standalone;
// tests bypass this via the injectable baseDir param and never rely on this path).
const PUBLIC_BUNDLES = join(process.cwd(), "public", "bundles");

/**
 * The component list for a brand IS the directory listing of its bundle's
 * components/general/ — no manifest. `baseDir` is injectable for tests.
 */
export function listComponents(brand: Brand, baseDir: string = PUBLIC_BUNDLES): string[] {
  // "general" is the single group used in slice 1 (all 11 components live here); parameterize if multi-group bundles land.
  const dir = join(baseDir, brand, "components", "general");
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Re-export so existing imports from this module keep working.
export { previewSrc } from "./preview-src";
