#!/usr/bin/env node
// Copy each brand's built bundle from dist-bundles/<brand>/ into the qa-portal's
// public/bundles/<brand>/ so Next serves the previews as static assets with their
// RELATIVE asset paths intact (../../../_vendor/react.js etc.). Iterates the four
// known brands only — never the stray "<brand> 2" copy artifacts in dist-bundles/.
// Run by the portal's predev/prebuild hooks (and the Plan 05 Docker build).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BRANDS = ["goldberry", "ggg", "nursery", "hub"];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "dist-bundles");
const DEST = join(ROOT, "apps", "qa-portal", "public", "bundles");

if (!existsSync(SRC)) {
  console.error("✗ dist-bundles/ missing — run `pnpm build:design-bundles` first.");
  process.exit(1);
}

// Validate ALL brand source dirs exist BEFORE touching DEST so a partial dist-bundles/
// never wipes a good public/bundles and leaves the portal serving a broken/empty set.
for (const brand of BRANDS) {
  if (!existsSync(join(SRC, brand))) {
    console.error(`✗ dist-bundles/${brand}/ missing — rebuild with \`pnpm build:design-bundles\`.`);
    process.exit(1);
  }
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

for (const brand of BRANDS) {
  cpSync(join(SRC, brand), join(DEST, brand), { recursive: true });
}

console.log(`✓ synced ${BRANDS.length} brand bundles → apps/qa-portal/public/bundles/`);
