#!/usr/bin/env node
/**
 * Regenerate / verify the seeded-catalog snapshot behind the hub's featured row.
 *
 * The hub's featured[] refs (apps/hub/data/marketplace.ts) are silently dropped
 * by fetchFeaturedProducts when a slug doesn't exist in the seeded Odoo, which
 * renders an empty featured row (GOL-400). Two guards prevent that:
 *   - featured-slugs-resolve.test.ts  — every-PR check against the snapshot
 *   - featured-slugs-live.test.ts     — live gate when GROVE_ODOO_URL is set
 * This script keeps the snapshot honest by regenerating it FROM the seeded Odoo.
 *
 * Usage (GROVE_ODOO_URL must point at a seeded Odoo — preview env or QA droplet):
 *   GROVE_ODOO_URL=http://... node scripts/check-featured-slugs.mjs           # verify (default)
 *   GROVE_ODOO_URL=http://... node scripts/check-featured-slugs.mjs --write   # rewrite the snapshot
 * Optional auth: GROVE_ODOO_API_KEY=<key> (sent as Bearer, matching createOdooClient).
 *
 * --verify exits non-zero if any featured slug returns count=0 live.
 * --write rewrites apps/hub/data/qa-catalog-snapshot.ts from the live catalog.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKETPLACE = join(ROOT, "apps/hub/data/marketplace.ts");
const SNAPSHOT = join(ROOT, "apps/hub/data/qa-catalog-snapshot.ts");

const write = process.argv.includes("--write");
const odooUrl = process.env.GROVE_ODOO_URL;
const apiKey = process.env.GROVE_ODOO_API_KEY;

if (!odooUrl) {
  console.error("GROVE_ODOO_URL is required (point it at a seeded Odoo).");
  process.exit(2);
}

const src = await readFile(MARKETPLACE, "utf8");

// Vendor tenant slugs — read from the source of truth so the script never
// drifts from the vendor list.
const tenantSlugs = [...src.matchAll(/tenantSlug:\s*"([^"]+)"/g)].map((m) => m[1]);
// Featured refs — { vendor: "x", productSlug: "y" }.
const featured = [...src.matchAll(/vendor:\s*"([^"]+)",\s*productSlug:\s*"([^"]+)"/g)].map(
  (m) => ({ vendor: m[1], productSlug: m[2] }),
);

async function tenantSlugsFromOdoo(tenant) {
  const headers = { "X-Grove-Tenant": tenant };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${odooUrl}/grove/api/v1/products?limit=500`, { headers });
  if (!res.ok) throw new Error(`${tenant}: ${res.status} ${res.statusText}`);
  const body = await res.json();
  return (body.results ?? []).map((p) => p.slug).filter(Boolean).sort();
}

const catalog = {};
for (const tenant of tenantSlugs) {
  catalog[tenant] = await tenantSlugsFromOdoo(tenant);
  console.log(`${tenant}: ${catalog[tenant].length} seeded product(s)`);
}

if (write) {
  const body = tenantSlugs
    .map((t) => `  ${t}: [${(catalog[t] ?? []).map((s) => `"${s}"`).join(", ")}],`)
    .join("\n");
  const header = (await readFile(SNAPSHOT, "utf8")).split(
    "export const seededCatalogSnapshot",
  )[0];
  await writeFile(
    SNAPSHOT,
    `${header}export const seededCatalogSnapshot: Record<string, string[]> = {\n${body}\n};\n`,
  );
  console.log(`\nWrote ${SNAPSHOT}`);
  process.exit(0);
}

// --verify: fail if any featured slug is absent from the live catalog.
const missing = featured.filter((f) => !(catalog[f.vendor] ?? []).includes(f.productSlug));
if (missing.length) {
  console.error(
    `\nFAIL: featured slug(s) return count=0 from the seeded Odoo:\n` +
      missing.map((f) => `  - ${f.vendor}/${f.productSlug}`).join("\n"),
  );
  process.exit(1);
}
console.log(`\nOK: all ${featured.length} featured slug(s) resolve against the seeded Odoo.`);
