import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Brand-voice guard for the consult-built carve-out notice (GOL-3054).
 *
 * CMO sign-off on GOL-3054 ratified two rules for this disclosure, and a
 * disclosure is the worst place to let either regress: it is the last thing a
 * customer reads before paying a deposit.
 *
 * 1. **No em dash** in anything a customer reads (GOL-589, GOL-1371). The vault
 *    `Marketing/Brand Voice` blesses em dashes for Josh's *spoken* long-form
 *    cadence (scripts, blog, newsletter); the storefront rule is the narrower
 *    one and it governs transactional copy. `product-view.copy.test.ts` already
 *    guards its own file this way; this is the same guard for the notice.
 * 2. **US spelling, and no apology register.** "honour" shipped in the first
 *    draft of the sibling unconfirmed-branch string, and an apology opener
 *    ("unfortunately") inverts the pillar-2 rule that a constraint leads with
 *    what the customer *does* get. Neither is caught by a type-checker.
 *
 * Code comments legitimately use em dashes and British spelling throughout this
 * codebase, so they are stripped before the scan — only the copy the browser
 * paints is enforced.
 */

const NOTICE = path.join(__dirname, "consult-carveout-notice.tsx");
const ESTIMATOR = path.join(__dirname, "shop/[id]/shipping-estimator.tsx");

/** Drop block and line comments so only rendered code/copy remains. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ and JSDoc blocks
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // line comments (spares http:// URLs)
}

function offendingLines(file: string, pattern: RegExp): string[] {
  return stripComments(readFileSync(file, "utf8"))
    .split("\n")
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ line, n }) => `  L${n}: ${line}`);
}

describe("consult carve-out notice — customer-facing copy (GOL-3054)", () => {
  it("renders no em dash outside of code comments (GOL-589)", () => {
    const offending = offendingLines(NOTICE, /—/);
    expect(
      offending,
      `em dash (—) found in customer-facing copy; use a period or comma instead:\n${offending.join("\n")}`,
    ).toEqual([]);
  });

  // Both surfaces' strings, because the unconfirmed-branch rewrite that GOL-3054
  // signed off lives in the estimator, not the notice. Scoped to spelling and
  // apology register only: the estimator still carries four pre-existing em
  // dashes in older copy, tracked separately, so it cannot join the rule above
  // until those are redlined.
  for (const [name, file] of [
    ["notice", NOTICE],
    ["estimator", ESTIMATOR],
  ] as const) {
    it(`${name}: uses US spelling and no apology register`, () => {
      const offending = offendingLines(
        file,
        /\b(honour|honours|honoured|colour|favour|behaviour|apologise|unfortunately|we regret)\b/i,
      );
      expect(
        offending,
        `British spelling or apology register found in customer-facing copy.\n` +
          `Use US spelling; lead a constraint with what the customer does get:\n${offending.join("\n")}`,
      ).toEqual([]);
    });
  }
});
