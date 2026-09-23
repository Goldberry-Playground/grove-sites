import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Mobile-layout guards for the cart (GOL-2440).
 *
 * Both regressions render fine at desktop and fail silently at 390px, so no
 * component test catches them:
 *
 *  1. A bare `1fr` grid track has a min-content floor — one long product name or
 *     the line controls push the whole page wider than the viewport. The tracks
 *     must be `minmax(0, …)` and the controls row must be allowed to wrap.
 *  2. The −/+ steps and Remove shrank to ~28px tap targets; WCAG 2.5.5 / our
 *     44px floor needs them at 2.75rem.
 */

const css = readFileSync(path.join(__dirname, "CartPage.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Declarations for `selector`, merged in source order; `media` scopes to that @media block. */
function decls(selector: string, media?: string): Record<string, string> {
  // Base rules only: drop every @media block (they sit at top level, closed by "\n}").
  let scope = css.replace(/@media[^{]*\{[\s\S]*?\n\}/g, "");
  if (media) {
    const start = css.indexOf(`@media ${media}`);
    expect(start, `@media ${media} block`).toBeGreaterThanOrEqual(0);
    scope = css.slice(start, css.indexOf("\n}", start));
  }
  const out: Record<string, string> = {};
  for (const [, sels, body] of scope.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    if (!sels.split(",").some((s) => s.trim() === selector)) continue;
    for (const d of body.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return out;
}

describe("CartPage.css mobile layout (GOL-2440)", () => {
  it("grid tracks can shrink below min-content", () => {
    expect(decls(".grove-cart__grid")["grid-template-columns"]).toBe("minmax(0, 1fr)");
    expect(decls(".grove-cart__grid", "(min-width: 1024px)")["grid-template-columns"]).toBe(
      "minmax(0, 2fr) minmax(0, 1fr)",
    );
  });

  it("long names break and the controls row wraps", () => {
    expect(decls(".grove-cart__line-name")["overflow-wrap"]).toBe("anywhere");
    expect(decls(".grove-cart__line-controls")["flex-wrap"]).toBe("wrap");
  });

  it.each([".grove-cart__step", ".grove-cart__remove"])("%s is a 44px tap target", (sel) => {
    const d = decls(sel);
    expect(d["min-width"]).toBe("2.75rem");
    expect(d["min-height"]).toBe("2.75rem");
  });

  it("qty input spans the stepper height (stepper stretches, no fixed vertical padding)", () => {
    expect(decls(".grove-cart__stepper")["align-items"]).toBeUndefined();
    expect(decls(".grove-cart__qty").width).toBe("2.75rem");
  });
});
