import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brand-voice guard for the farm storefront's customer copy (GOL-589, GOL-3315).
 *
 * The ratified Grove voice rule bans the em dash (U+2014) from anything a
 * customer reads. The nursery pins its surfaces in `shop-copy.test.ts`; this
 * does the same for the goldberry shop, PDP, variant picker and the checkout
 * confirmation pages, which GOL-3315 rewrites for the Printify shirts.
 *
 * Code comments legitimately use em dashes throughout this codebase, so they
 * are stripped before the scan. Only the copy the browser paints is enforced.
 */

const SOURCES = [
  "shop/page.tsx",
  "shop/shop-sub-header.tsx",
  "shop/[id]/page.tsx",
  "shop/[id]/variant-picker.tsx",
  "checkout/success/page.tsx",
  "checkout/success/[id]/page.tsx",
];

/** Drop block and line comments so only rendered code/copy remains. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ and JSDoc blocks
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // line comments (spares http:// URLs)
}

describe("goldberry customer copy honours the no-em-dash rule (GOL-589)", () => {
  it.each(SOURCES)("%s has no em dash", (rel) => {
    const src = stripComments(readFileSync(join(__dirname, rel), "utf8"));
    expect(src.split("\n").filter((line) => line.includes("—"))).toEqual([]);
  });
});
