import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Brand } from "./brands";

// Where the predev/prebuild sync hook copies dist-bundles/<brand>/.
const PUBLIC_BUNDLES = join(process.cwd(), "public", "bundles");

/**
 * The component list for a brand IS the directory listing of its bundle's
 * components/general/ — no manifest. `baseDir` is injectable for tests.
 */
export function listComponents(brand: Brand, baseDir: string = PUBLIC_BUNDLES): string[] {
  const dir = join(baseDir, brand, "components", "general");
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Public URL of a component's self-contained preview HTML (relative asset loads resolve here). */
export function previewSrc(brand: Brand, component: string): string {
  return `/bundles/${brand}/components/general/${component}/${component}.html`;
}
