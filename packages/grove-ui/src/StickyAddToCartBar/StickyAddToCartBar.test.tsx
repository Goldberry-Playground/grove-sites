// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StickyAddToCartBar } from "./index";

// The bar is CSS-hidden and reveal-gated by an IntersectionObserver that
// happy-dom doesn't implement; stub it so the button always renders and we can
// assert its label text (the reveal behaviour is DOM plumbing, not label logic).
function stubIntersectionObserver() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

describe("<StickyAddToCartBar /> label (GOL-782 buy-state 2-consumer invariant)", () => {
  it("renders idleLabel when enabled", () => {
    stubIntersectionObserver();
    render(<StickyAddToCartBar name="Fig" price={24} idleLabel="Reserve" onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: /Reserve: Fig/, hidden: true }).textContent).toContain("Reserve");
  });

  it("defaults to Add to Cart when enabled with no idleLabel", () => {
    stubIntersectionObserver();
    render(<StickyAddToCartBar name="Fig" price={24} onAdd={() => {}} />);
    expect(screen.getByRole("button", { hidden: true }).textContent).toContain("Add to Cart");
  });

  it("shows the disabled idleLabel verbatim — 'Coming soon' must NOT read as 'Sold out'", () => {
    stubIntersectionObserver();
    render(
      <StickyAddToCartBar name="Pawpaw" price={30} disabled idleLabel="Coming soon" onAdd={() => {}} />,
    );
    const btn = screen.getByRole("button", { hidden: true });
    expect(btn.textContent).toContain("Coming soon");
    expect(btn.textContent).not.toContain("Sold out");
    expect(btn.getAttribute("aria-label")).toBe("Coming soon");
  });

  it("falls back to 'Sold out' when disabled with no idleLabel (ggg/goldberry)", () => {
    stubIntersectionObserver();
    render(<StickyAddToCartBar name="Apple" price={20} disabled onAdd={() => {}} />);
    expect(screen.getByRole("button", { hidden: true }).textContent).toContain("Sold out");
  });

  it("shows 'Sold out' when the disabled label IS 'Sold out' (nursery sold-out state)", () => {
    stubIntersectionObserver();
    render(
      <StickyAddToCartBar name="Apple" price={20} disabled idleLabel="Sold out" onAdd={() => {}} />,
    );
    expect(screen.getByRole("button", { hidden: true }).textContent).toContain("Sold out");
  });
});
