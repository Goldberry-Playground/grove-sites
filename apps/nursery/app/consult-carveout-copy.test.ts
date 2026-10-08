import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsultCarveOutNotice } from "./consult-carveout-notice";
import { SNAPSHOT_COMPLIANCE } from "../lib/plant-compliance";

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
 * 3. **The ratified strings, pinned verbatim.** The condition CMO-Sora cared
 *    most about on the final sign-off: "a delivery promise that any future
 *    refactor can silently reword is not signed off, it is signed off *once*."
 *    So the second block below renders the notice for Florida and for Indiana
 *    and compares whole sentences, not patterns. These assertions are supposed
 *    to be annoying to change: if one fails, the fix is a new CMO sign-off, not
 *    a new expected string.
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

/**
 * The ratified wording, verbatim (GOL-3054 sign-off condition 2).
 *
 * Rendered, not source-scanned: JSX wraps these sentences across lines and
 * interpolates the derived counts, so only the painted text can be compared to
 * what CMO-Sora actually signed. Florida is the three-exclusion case and
 * Indiana the one-exclusion case, which between them cover every string in the
 * component (the two closings differ only by `surface`).
 *
 * `renderToStaticMarkup` rather than Testing Library on purpose: this file also
 * reads its own sources off disk for the guards above, and a `happy-dom`
 * environment externalizes `node:fs`. Server rendering needs no DOM, so both
 * halves of the sign-off live in the one file Sora named.
 *
 * `aria-hidden` nodes are dropped before comparing. That is the assertion we
 * want anyway: it pins the words a screen reader reads out, and proves the
 * decorative bordered "i" carries no meaning (the notice must survive in
 * grayscale and with no icon at all).
 */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
};

/** Painted text of every <p> and <li>, in document order, aria-hidden stripped. */
function paintedText(markup: string): { paragraphs: string[]; bullets: string[] } {
  const visible = markup.replace(/<(\w+)[^>]*aria-hidden="true"[^>]*>.*?<\/\1>/g, "");
  const grab = (tag: string) =>
    Array.from(visible.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))).map(
      ([, inner]) =>
        inner
          .replace(/<[^>]+>/g, "")
          .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e)
          .replace(/\s+/g, " ")
          .trim(),
    );
  return { paragraphs: grab("p"), bullets: grab("li") };
}

function renderNotice(state: string, surface: "pdp" | "checkout") {
  return paintedText(
    renderToStaticMarkup(
      createElement(ConsultCarveOutNotice, {
        state,
        compliance: SNAPSHOT_COMPLIANCE,
        surface,
      }),
    ),
  );
}

describe("consult carve-out notice — ratified strings, pinned (GOL-3054)", () => {
  it("Florida: heading, body, label and the PDP closing read exactly as signed", () => {
    const { paragraphs, bullets } = renderNotice("FL", "pdp");
    expect(paragraphs).toEqual([
      "Your Florida mix: 14 of our 17 food-forest species",
      "We ship to Florida, which restricts chestnut and dogwood for plant-health reasons. So your list comes from the other 14. That\u2019s still a full food forest.",
      "Not for Florida:",
      "We confirm your exact list with you in the consult, cleared for Florida, before anything ships. Your shipping is quoted then too, once we know how many boxes your trees pack into.",
    ]);
    // The case that justifies the binomials: two chestnut lines would read as a
    // duplicate entry without them, and Florida restricts one of a dozen things
    // called dogwood.
    expect(bullets).toEqual([
      "American Chestnut (Castanea dentata)",
      "Chinese Chestnut (Castanea mollissima)",
      "Flowering Dogwood (Cornus florida)",
    ]);
  });

  it("Indiana: the one-line disclosure names the species, not the cultivar", () => {
    const { paragraphs, bullets } = renderNotice("IN", "pdp");
    expect(paragraphs[0]).toBe("Your Indiana mix: 16 of our 17 food-forest species");
    expect(paragraphs[1]).toBe(
      "We ship to Indiana, which restricts white mulberry for plant-health reasons. So your list comes from the other 16. That\u2019s still a full food forest.",
    );
    expect(paragraphs[2]).toBe("Not for Indiana:");
    // Redline C. `Morus alba 'Maple Leaf'` would imply only that cultivar is
    // restricted; the gate blocks the species, and this ONE line is the whole
    // disclosure for Indiana, Ohio and Wisconsin.
    expect(bullets).toEqual(["Mulberry (Morus alba)"]);
  });

  it("checkout closes on the deposit, not on the quote", () => {
    const { paragraphs } = renderNotice("FL", "checkout");
    expect(paragraphs[paragraphs.length - 1]).toBe(
      "Your deposit reserves the consult, not a fixed plant list. We confirm every plant with you, cleared for Florida, before anything ships.",
    );
  });

  it("stays silent where nothing we grow is restricted", () => {
    expect(renderNotice("WV", "pdp").paragraphs).toEqual([]);
  });
});
