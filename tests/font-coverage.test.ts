import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  uncoveredGlyphs,
  characterRefOffenders,
  explain,
  stripComments,
  KNOWN_TOFU,
  hex,
} from "./font-coverage";

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
  // GOL-3123 — the shared cart and checkout, plus the wrapper that supplies the
  // CTA label that actually ships and the icon module the three of them draw.
  "packages/grove-ui/src/CartPage/index.tsx",
  "packages/grove-ui/src/CheckoutPage/index.tsx",
  "packages/checkout/src/components/CheckoutPage.tsx",
  "packages/grove-ui/src/GlyphIcon.tsx",
  // GOL-2797 — the rest of GOL-3123's follow-up list outside the goldberry and
  // ggg route trees: the order review step, the mini-cart, the hub vendor
  // surfaces, the sibling strip and shop sub-header marks (component CSS and
  // the generated ds-theme bundles they feed), the checkout cancel page, and
  // every nursery route that still typed or referenced an arrow.
  "packages/grove-ui/src/CheckoutReview/index.tsx",
  "packages/grove-ui/src/MiniCartDrawer/index.tsx",
  "packages/grove-ui/src/BuyAtVendorForm/index.tsx",
  "packages/grove-ui/src/VendorCard/index.tsx",
  "packages/grove-ui/src/SiblingStrip/index.tsx",
  "packages/grove-ui/src/SiblingStrip/SiblingStrip.css",
  "packages/grove-ui/src/ShopSubHeader/ShopSubHeader.css",
  "packages/grove-ui/ds-theme.nursery.css",
  "packages/grove-ui/ds-theme.hub.css",
  "packages/grove-ui/ds-theme.ggg.css",
  "packages/grove-ui/ds-theme.goldberry.css",
  "packages/checkout/src/components/CheckoutCancelPage.tsx",
  "apps/nursery/app/page.tsx",
  "apps/nursery/app/featured-lead-sellers.tsx",
  "apps/nursery/app/notify/page.tsx",
  "apps/nursery/app/wholesale/page.tsx",
  "apps/nursery/app/shipping-warranty/page.tsx",
] as const;

/**
 * Still NOT listed, and deliberately so. GOL-3123 swept the shared cart and
 * checkout packages plus all three storefront route trees and found 49
 * uncovered marks across 25 files outside its two. GOL-2797 cleared every one
 * of those in the shared packages and the nursery routes (listed above). What
 * remains is the goldberry and ggg route trees, tracked on their own follow-up
 * rather than claimed here. Listing a file here is a claim that someone
 * rendered it in a symbol-font-less stack; none of these have been.
 *
 *   apps/goldberry                       → x17, ← x4            (worst offender)
 *   apps/ggg                             → x4, ⌂, &larr;
 *
 * Deliberately NOT on that list, having been checked rather than assumed: the
 * cart stepper's `&minus;`, the ggg homepage's seven `№`, and the nursery PDP's
 * two `›`. All three codepoints are carried by all three faces.
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
    // #883 (GOL-2734) landed the marks: a filled check for in-range and a
    // warning triangle for out-of-range, each its own aria-hidden SVG.
    expect(src).toContain('d="M6.2 12.4 2 8.2l1.5-1.5 2.7 2.7 6.3-6.3L14 4.6l-7.8 7.8Z"');
    expect(src).toContain('d="M8 1.3 15.3 14H.7L8 1.3Z');
    expect(src).toMatch(/<CheckMark \/>[\s\S]*<CautionMark \/>/);
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

describe("the cart and checkout draw their marks instead of typing them", () => {
  const cart = stripComments(read("packages/grove-ui/src/CartPage/index.tsx"));
  const checkout = stripComments(read("packages/grove-ui/src/CheckoutPage/index.tsx"));
  const wrapper = stripComments(read("packages/checkout/src/components/CheckoutPage.tsx"));
  const glyphIcon = read("packages/grove-ui/src/GlyphIcon.tsx");

  it("sees a character reference as the character it paints", () => {
    // The hole: an entity is ASCII in the source, so the literal-character scan
    // never sees it. Eight `&rarr;`/`&larr;`/`&darr;` sit in the app routes.
    const hidden = characterRefOffenders("<a>Browse the catalog &rarr;</a>");
    expect(hidden).toHaveLength(1);
    expect(hidden[0].cp).toBe(0x2192);
    expect(hidden[0].ref).toBe("&rarr;");
    // Numeric references resolve too, decimal and hex alike.
    expect(characterRefOffenders("&#8594; &#x2190;").map((o) => o.cp)).toEqual([0x2192, 0x2190]);
    // ...and it does not cry wolf over references the faces do cover. `&minus;`
    // is here on purpose: all three carry U+2212 (see COVERED_ABOVE_LATIN1).
    expect(characterRefOffenders("Wesley&rsquo;s &mdash; &amp; &hellip; &minus;")).toEqual([]);
    // A comment may name one while explaining the fix.
    expect(characterRefOffenders("/* this was &rarr; */")).toEqual([]);
  });

  it("leaves the stepper signs alone, because all three faces carry them", () => {
    // GOL-3123 opened believing `&minus;` here was tofu. The cmap read says it
    // is not, so this is the one site the ticket named that must NOT change —
    // a drawn mark would be aria-hidden and strictly worse than a real sign.
    expect(cart).toContain("&minus;");
    expect(cart).not.toContain('GlyphIcon name="minus"');
  });

  it("keeps the forward arrow out of the CTA label string", () => {
    // A `string` prop holding `→` is retypable at every call site, and the
    // `@grove/checkout` wrapper did retype it — so the default was never what
    // shipped. The button owns the arrow now; the label is words only.
    expect(checkout).toContain('submitLabel = "Place Order"');
    expect(checkout).toContain('{submitLabel} <GlyphIcon name="arrow-right" />');
    expect(wrapper).toContain('submitLabel="Continue to payment"');
    for (const src of [cart, checkout, wrapper]) expect(uncoveredGlyphs(src)).toEqual([]);
  });

  it("keeps the discount sign a real character, because it is part of the number", () => {
    // The arrows and warnings on these surfaces became geometry. This one must
    // not: a drawn minus is aria-hidden, so the amount would be announced and
    // copied without its sign — and U+2212 needs no rescue, every loaded face
    // carries it. Both halves of that matter, so assert both.
    expect(checkout).toContain("<dd>\u2212{formatPrice(discount)}</dd>");
    expect(uncoveredGlyphs("\u2212")).toEqual([]);
  });

  it("never lets a mark be the only thing saying what state it is", () => {
    // The three warning marks sit on error states. Each is aria-hidden with the
    // message text beside it, so the mark is never the signal (WCAG 1.4.1).
    const warnings = [...checkout.matchAll(/<GlyphIcon name="warning" \/>/g)];
    expect(warnings).toHaveLength(3);
    for (const m of checkout.matchAll(/<span([^>]*)className="grove-checkout__error-icon"/g))
      expect(m[1]).toContain('aria-hidden="true"');
    expect(glyphIcon).toContain('aria-hidden="true"');
    expect(uncoveredGlyphs(glyphIcon)).toEqual([]);
  });
});

describe("GlyphIcon draws every mark it declares (GOL-2797)", () => {
  const glyphIcon = read("packages/grove-ui/src/GlyphIcon.tsx");
  const NAMES = (() => {
    const decl = glyphIcon.match(/export type GroveGlyphIconName\s*=([^;]+);/)?.[1] ?? "";
    return [...stripComments(decl).matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  })();

  it("declares the GOL-3123 marks plus the GOL-2797 additions", () => {
    expect(NAMES).toEqual(
      expect.arrayContaining([
        "arrow-right",
        "arrow-left",
        "warning",
        "arrow-down",
        "caret-down",
        "undo",
        "dot",
        "clock",
      ]),
    );
  });

  it("has geometry for every declared name", () => {
    for (const name of NAMES) {
      const key = /^[a-z]+$/.test(name) ? name : `"${name}"`;
      expect(glyphIcon, `GlyphIcon has no geometry for ${name}`).toContain(`${key}:`);
    }
  });

  it("keeps the arrow out of the VendorCard default label", () => {
    // A string default is retypable at every call site; the card owns the mark.
    const card = stripComments(read("packages/grove-ui/src/VendorCard/index.tsx"));
    expect(card).toContain('cta = "Visit the shop"');
    expect(card).toContain('{cta} <GlyphIcon name="arrow-right" />');
  });

  it("draws the sibling-strip and sub-header half-circles in CSS", () => {
    for (const rel of [
      "packages/grove-ui/src/SiblingStrip/SiblingStrip.css",
      "packages/grove-ui/src/ShopSubHeader/ShopSubHeader.css",
    ]) {
      const css = stripComments(read(rel));
      expect(css, rel).toMatch(/::before\s*\{[^}]*content:\s*(['"])\1;[^}]*border-radius:\s*50%/);
      expect(css, rel).toMatch(/linear-gradient\(to right, .*50%, transparent 50%\)/);
    }
  });
});
