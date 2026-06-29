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

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

for (const brand of BRANDS) {
  const from = join(SRC, brand);
  if (!existsSync(from)) {
    console.error(`✗ dist-bundles/${brand}/ missing — rebuild with \`pnpm build:design-bundles\`.`);
    process.exit(1);
  }
  cpSync(from, join(DEST, brand), { recursive: true });
}

console.log(`✓ synced ${BRANDS.length} brand bundles → apps/qa-portal/public/bundles/`);
