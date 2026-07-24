import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StickyAddToCartBar } from "./index";

/**
 * The sticky bar is the second consumer of the buy-state alongside the inline
 * AddToCartButton (GOL-760): both must render the label the buy-state computed,
 * never invent their own. GOL-782 fixed a hardcoded "Sold out" in the disabled
 * branch that contradicted a "Coming soon" inline label on coming-soon products.
 *
 * Asserted via server render (renderToStaticMarkup) rather than testing-library
 * because the label is pure output — no DOM interaction or act() needed — and
 * this keeps the check deterministic across environments.
 */
const btnText = (html: string) => html.match(/<button[^>]*>([^<]*)/)?.[1]?.trim() ?? "";
const ariaLabel = (html: string) => html.match(/aria-label="([^"]*)"/)?.[1] ?? "";
const render = (props: Partial<Parameters<typeof StickyAddToCartBar>[0]>) =>
  renderToStaticMarkup(
    <StickyAddToCartBar name="Honeycrisp Apple Tree" price={38} onAdd={() => {}} {...props} />,
  );

describe("<StickyAddToCartBar /> label", () => {
  it("renders the supplied idleLabel when enabled", () => {
    const html = render({ idleLabel: "Reserve" });
    expect(btnText(html)).toBe("Reserve");
    expect(ariaLabel(html)).toBe("Reserve: Honeycrisp Apple Tree");
  });

  it("renders the supplied idleLabel even when disabled (GOL-782: no hardcoded 'Sold out')", () => {
    const html = render({ idleLabel: "Coming soon", disabled: true });
    expect(btnText(html)).toBe("Coming soon");
    expect(ariaLabel(html)).toBe("Coming soon");
    expect(html).not.toContain("Sold out");
  });

  it("still passes 'Sold out' through when the buy-state supplies it", () => {
    expect(btnText(render({ idleLabel: "Sold out", disabled: true }))).toBe("Sold out");
  });

  it("falls back to state-appropriate defaults when no idleLabel is given", () => {
    // Keeps the design-sync SoldOut preview (disabled, no idleLabel) correct.
    expect(btnText(render({}))).toBe("Add to Cart");
    expect(btnText(render({ disabled: true }))).toBe("Sold out");
  });

  it("keeps the disabled button disabled so it cannot be tapped", () => {
    expect(render({ idleLabel: "Coming soon", disabled: true })).toContain("disabled");
  });
});
