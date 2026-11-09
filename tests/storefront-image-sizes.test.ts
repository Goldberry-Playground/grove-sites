import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `sizes` tells the browser how wide an image will be before any CSS has run,
// so it has to agree with the layout. These pin the phone and tablet values to
// the breakpoints that actually change the layout.
const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
const firstBreakpoint = (sizes: string) => Number(/max-width: (\d+)px/.exec(sizes)?.[1]);
const sizesAttr = (source: string) => /sizes="([^"]+)"/.exec(source)?.[1] ?? "";

describe("nursery shop grid", () => {
  const source = read("apps/nursery/app/shop/product-grid.tsx");
  const constants = [...source.matchAll(/const CARD_SIZES_\w+ = "([^"]+)"/g)].map((m) => m[1]);

  it("has both card size lists", () => {
    expect(constants).toHaveLength(2);
  });

  it.each(constants)("switches at the two-column phone breakpoint: %s", (sizes) => {
    const css = read("apps/nursery/app/globals.css");
    const dense = /@media \(max-width: (\d+)px\) \{\s*\.var-grid--dense/.exec(css);
    expect(firstBreakpoint(sizes)).toBe(Number(dense?.[1]));
  });

  it.each(constants)("asks for half a phone screen, not a full one: %s", (sizes) => {
    expect(sizes).toMatch(/^\(max-width: \d+px\) 46vw/);
  });
});

describe("product page hero", () => {
  it("nursery stops growing at the gallery's largest width", () => {
    const sizes = sizesAttr(read("apps/nursery/app/shop/[slug]/product-gallery.tsx"));
    expect(firstBreakpoint(sizes)).toBe(767);
    expect(sizes).toContain("min(50vw, 560px)");
  });

  // Tailwind's md: starts at 768px, so 767px is the last single-column width.
  it.each(["goldberry", "ggg"])("%s switches where the page goes two-column", (app) => {
    const source = read(`apps/${app}/app/shop/[id]/page.tsx`);
    expect(source).toContain("md:grid-cols-2");
    expect(firstBreakpoint(sizesAttr(source))).toBe(767);
  });
});

describe("sticky add-to-cart thumbnail", () => {
  it("requests a 40px image to match its 40px slot", () => {
    const source = read("packages/grove-ui/src/StickyAddToCartBar/index.tsx");
    expect(source).toContain("width={40}");
    expect(source).toContain("height={40}");
  });
});
