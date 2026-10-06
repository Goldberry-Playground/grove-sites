import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { uncoveredGlyphs, explain, stripComments, KNOWN_TOFU, hex } from "./font-coverage";

/**
 * Repo-wide guard for the GOL-3112 / GOL-3117 defect: a decorative glyph typed
 * as a character from a Unicode block that none of the three loaded faces
 * (Fraunces / Newsreader / IBM Plex Mono) cover, which therefore paints as an
 * empty .notdef box on any client with no symbol font.
 *
 * Scoped to the surfaces that have actually been audited and cleaned. This is a
 * guard against regression on known-good files, not a repo-wide sweep — adding a
 * file here is a claim that someone rendered it in a symbol-font-less stack.
 *
 * `shipping-estimator.tsx` is listed even though GOL-3112 (#990, now merged)
 * ships its own `shipping-estimator.glyphs.test.ts`. The overlap is deliberate
 * and cheap: that test pins two characters, this one rejects every character
 * outside the covered set and names all nine known offenders, so the stricter
 * guard travels with the file.
 */
const ROOT = path.join(__dirname, "..");

const AUDITED = [
  // GOL-3112
  "apps/nursery/app/shop/[id]/shipping-estimator.tsx",
  // GOL-3117
  "apps/nursery/app/shop/[id]/zone-check.tsx",
  "apps/nursery/app/globals.css",
  "packages/checkout/src/brand-trust.ts",
  "packages/checkout/src/components/createCheckoutSuccessPage.tsx",
  "packages/grove-ui/src/TrustIcon.tsx",
] as const;

/**
 * NOT yet listed, and deliberately so: `grove-ui/src/CartPage/index.tsx` and
 * `grove-ui/src/CheckoutPage/index.tsx`. Adding the trust-strip render call here
 * surfaced eight more uncovered characters in those two files, all of them
 * outside this ticket's four surfaces and all on checkout, which GOL-3117 says
 * wants its own review:
 *
 *   CheckoutPage  L177 U+2192 →  "Place Order →"            (primary CTA copy)
 *                 L478 U+26A0 ⚠  validation summary
 *                 L665 U+2212 −  "−{formatPrice(discount)}" (money line!)
 *                 L780 U+26A0 ⚠  payment error
 *                 L798 U+26A0 ⚠  payment error
 *   CartPage      L121 U+2192 →  "Checkout Now →"           (primary CTA copy)
 *                 L143 U+2190 ←  "← Keep shopping"
 *                 L218 U+2192 →  "Proceed to Checkout →"    (primary CTA copy)
 *
 * The minus sign is the sharp one: a tofu'd U+2212 makes a discount line read as
 * a positive charge. The arrows sit inside button copy, so removing them is a
 * CTA design call rather than a swap. Tracked separately — see the child issue
 * on GOL-3117. Listing these files before they are fixed would be a false claim
 * that they were audited.
 */

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("audited surfaces render only glyphs the loaded fonts cover", () => {
  it.each(AUDITED)("%s", (rel) => {
    const offending = uncoveredGlyphs(read(rel));
    expect(offending, explain(offending)).toEqual([]);
  });

  it("does not reintroduce any of the nine characters this bug was made of", () => {
    const found: string[] = [];
    for (const rel of AUDITED) {
      const offending = uncoveredGlyphs(read(rel));
      for (const [char, label] of KNOWN_TOFU) {
        if (offending.some((o) => o.char === char)) found.push(`${rel}: ${label}`);
      }
    }
    expect(found, `tofu glyph(s) back in rendered output:\n  ${found.join("\n  ")}`).toEqual([]);
  });
});

describe("zone-check.tsx states its answer in tokens and shapes, not raw colour", () => {
  // Comments stripped throughout: the rule-why notes in this file name the
  // classes and codepoints they replaced, and prose must not trip the guard.
  const src = stripComments(read("apps/nursery/app/shop/[id]/zone-check.tsx"));

  it("uses no raw Tailwind palette colour for the answer pair", () => {
    // text-green-700 / text-amber-700 do not follow a retheme, and amber-700
    // measured 3.93:1 on --paper-deep (GOL-678). Tokens only. — GOL-3117
    const raw = src.match(/\btext-(?:green|amber|red|emerald|lime|rose|orange)-\d{3}\b/g) ?? [];
    expect(raw, `raw Tailwind colour(s) in zone-check: ${raw.join(", ")}`).toEqual([]);
  });

  it("gives the hardy and not-hardy answers distinct shapes", () => {
    // The yes/no result must not ride on hue alone (WCAG 1.4.1) — it has to
    // survive greyscale and all three CVD simulations. The check path is the
    // GOL-3112 geometry; the barred circle is the out-of-range mark.
    expect(src).toContain('d="M1.75 6.4 4.6 9.25 10.25 2.9"');
    expect(src).toContain('d="M3.5 6h5"');
  });

  it("keeps every decorative mark out of the announced sentence", () => {
    // The old `✓ Yes — …` was inside the copy string, so a screen reader
    // announced the tofu as well as painting it. Every svg here is aria-hidden.
    const svgs = src.match(/<svg[\s\S]*?>/g) ?? [];
    expect(svgs.length).toBeGreaterThan(0);
    for (const tag of svgs) expect(tag).toContain('aria-hidden="true"');
  });
});

describe("the trust strip names its shapes instead of typing them", () => {
  // Read as source, like the other repo-wide guards in this directory: the root
  // tsconfig does not map the `@grove/*` workspace aliases (they are vitest-only),
  // so importing the package here would add a TS2307 to the typecheck.
  const brandTrust = stripComments(read("packages/checkout/src/brand-trust.ts"));
  const trustIcon = read("packages/grove-ui/src/TrustIcon.tsx");

  /** The union in trust-items.ts, read rather than duplicated. */
  const SHAPES = (() => {
    const types = read("packages/grove-ui/src/trust-items.ts");
    const decl = types.match(/export type GroveTrustIconName\s*=([^;]+);/)?.[1] ?? "";
    return [...decl.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  })();

  it("declares a non-empty shape union", () => {
    expect(SHAPES.length).toBeGreaterThan(0);
  });

  it("every BRAND_TRUST icon is a declared shape name, not a character", () => {
    const icons = [...brandTrust.matchAll(/\bicon:\s*"([^"]*)"/g)].map((m) => m[1]);
    // Three brands x (4 cart + 3 checkout) badges.
    expect(icons.length).toBe(21);
    for (const icon of icons) {
      expect(
        SHAPES.includes(icon),
        `icon ${JSON.stringify(icon)} is not one of ${SHAPES.join(" | ")}. A literal ` +
          "glyph here tofus on a client with no symbol font (GOL-3117).",
      ).toBe(true);
      expect([...icon].every((c) => c.codePointAt(0)! <= 0x7f)).toBe(true);
    }
  });

  it("TrustIcon draws every declared shape, and draws them as SVG", () => {
    for (const shape of SHAPES) {
      const key = /^[a-z]+$/.test(shape) ? shape : `"${shape}"`;
      expect(trustIcon, `TrustIcon has no geometry for ${shape}`).toContain(`${key}:`);
    }
    // The point of the whole exercise: geometry, not characters.
    expect(trustIcon).toContain("<svg");
    expect(trustIcon).toContain('aria-hidden="true"');
    expect(uncoveredGlyphs(trustIcon)).toEqual([]);
  });
});

describe("globals.css draws its eyebrow marks rather than typing them", () => {
  const css = stripComments(read("apps/nursery/app/globals.css"));

  it("has no CSS content: declaration holding an uncovered character", () => {
    const bad = (css.match(/content:\s*(['"])(.*?)\1/g) ?? []).filter((d) =>
      [...d].some((c) => c.codePointAt(0)! > 0xff),
    );
    expect(
      bad,
      "a content: glyph outside the loaded faces — draw it in CSS or mask an " +
        `SVG instead (GOL-682, GOL-3117): ${bad.join(" / ")}`,
    ).toEqual([]);
  });

  it("still draws both eyebrow marks in the brand orange", () => {
    // The hero mark was U+25D0 and the field-notes mark U+2726. Replacing them
    // must not quietly drop the accent: GOL-685 has brand sign-off on the
    // orange, measured at 3.68:1 on the darkest scrim band.
    expect(css).toMatch(/\.pano-eyebrow::before\s*\{[^}]*--orange/);
    expect(css).toMatch(/\.field-notes-eyebrow::before\s*\{[^}]*currentColor/);
    expect(css).toMatch(/--sparkle-mask:\s*url\("data:image\/svg\+xml/);
  });
});

describe("the known-tofu list is self-consistent", () => {
  it("every character in KNOWN_TOFU really is above Latin-1", () => {
    for (const [char, label] of KNOWN_TOFU)
      expect(char.codePointAt(0)!, `${hex(char.codePointAt(0)!)} ${label}`).toBeGreaterThan(0xff);
  });
});
