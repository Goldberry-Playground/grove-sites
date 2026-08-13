import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Brand-voice guard for the storefront's customer-facing copy (GOL-589, GOL-1371).
 *
 * The ratified Grove voice rule bans the em dash (U+2014) from anything a customer
 * reads. The fulfillment-mode.ts unit tests already cover the copy that lives in
 * that module (barerootNote / barerootTimingShort), but product-view.tsx renders
 * several strings inline in JSX — the legacy bareroot deposit note, the pickup-only
 * line, the notify-me description. Those escaped every guard until an em dash
 * shipped in one of them (GOL-1371). This scans the rendered source directly so a
 * new inline string can't regress.
 *
 * Code comments legitimately use em dashes throughout this codebase, so they're
 * stripped before the scan — only the copy the browser paints is enforced.
 */

const SOURCE = path.join(__dirname, "product-view.tsx");

/** Drop block and line comments so only rendered code/copy remains. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ and JSDoc blocks
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // line comments (spares http:// URLs)
}

describe("product-view.tsx — customer-facing copy honours the no-em-dash rule (GOL-589)", () => {
  it("renders no em dash outside of code comments", () => {
    const rendered = stripComments(readFileSync(SOURCE, "utf8"));
    const offending = rendered
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => line.includes("—"));

    expect(
      offending,
      `em dash (—) found in customer-facing copy; use a period or comma instead:\n` +
        offending.map(({ line, n }) => `  L${n}: ${line.trim()}`).join("\n"),
    ).toEqual([]);
  });
});
