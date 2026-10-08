// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CartProvider } from "@grove/checkout";
import type { GrowingFacts } from "@grove/odoo-client";
import { ProductView, type ViewVariant } from "./product-view";

/**
 * GOL-2734: the "Plant two" hint's only action is "Set quantity to 2", so it
 * must not render beside a buy box that cannot add (sold out, out of season).
 */

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

const FACTS: GrowingFacts = {
  botanicalName: null,
  zoneMin: 4,
  zoneMax: 8,
  layer: null,
  sun: null,
  matureSize: null,
  spacing: null,
  soil: null,
  growthRate: null,
  bloomSeason: null,
  harvestSeason: null,
  watering: null,
  wildlife: null,
  matureSpread: null,
  chillHours: null,
  pollination: "Needs a pollination partner",
  yearsToFruit: null,
};

// Formatless potted listing (prod #130 shape).
const POTTED: ViewVariant = {
  id: 230,
  name: "Persimmon",
  price: 18,
  available: true,
  qtyAvailable: 12,
  cultivar: null,
  format: null,
  rootstock: null,
  shippingTier: "potted",
  imageUrl: "",
};

function renderPdp(variant: ViewVariant) {
  return render(
    <CartProvider>
      <ProductView
        productId={130}
        name="Persimmon"
        featured={false}
        heroImage=""
        images={[]}
        variants={[variant]}
        fallbackPrice={18}
        saleOk
        facts={FACTS}
      />
    </CartProvider>,
  );
}

const plantTwo = () => screen.queryByRole("button", { name: /^Set quantity to 2$/ });

describe("ProductView: plant-two hint follows the buy state", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 7, 12))); // Oct 7, potted season
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders when the tree can be added", () => {
    renderPdp(POTTED);
    expect(plantTwo()).not.toBeNull();
  });

  it("is hidden when the tree is sold out", () => {
    renderPdp({ ...POTTED, available: false, qtyAvailable: 0 });
    expect(plantTwo()).toBeNull();
  });

  it("is hidden out of season, when nothing can be added", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 16, 12))); // Oct 16
    renderPdp(POTTED);
    expect(plantTwo()).toBeNull();
  });
});
