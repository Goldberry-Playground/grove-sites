import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Brand-voice guard for the department / Guilds / search copy (GOL-589,
 * GOL-2745).
 *
 * The ratified Grove voice rule bans the em dash (U+2014) from anything a
 * customer reads. `product-view.copy.test.ts` pins the PDP the same way; this
 * extends the guard to the surfaces GOL-2745 adds, which between them carry a
 * lot of new prose: the department teasers, the waitlist, the Guilds cards and
 * every shop empty state.
 *
 * Code comments legitimately use em dashes throughout this codebase, so they're
 * stripped before the scan — only the copy the browser paints is enforced.
 */

const SOURCES = [
  "../../data/nav.ts",
  "../department-nav.tsx",
  "./department-teaser.tsx",
  "./notify-me.tsx",
  "./search-results.tsx",
  "./shop-browse.tsx",
  "./product-grid.tsx",
  "./guilds/page.tsx",
  "./guilds/guild-card.tsx",
];

/** Drop block and line comments so only rendered code/copy remains. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ and JSDoc blocks
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // line comments (spares http:// URLs)
}

describe("shop department copy honours the no-em-dash rule (GOL-589)", () => {
  it.each(SOURCES)("%s renders no em dash outside of code comments", (rel) => {
    const file = path.join(__dirname, rel);
    const rendered = stripComments(readFileSync(file, "utf8"));
    const offending = rendered
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => line.includes("—"));

    expect(
      offending,
      `em dash (—) found in customer-facing copy in ${rel}; use a period or comma instead:\n` +
        offending.map(({ line, n }) => `  L${n}: ${line.trim()}`).join("\n"),
    ).toEqual([]);
  });
});
