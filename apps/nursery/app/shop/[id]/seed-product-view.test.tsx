// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CartProvider } from "@grove/checkout";
import type { SeedSeason } from "@grove/odoo-client";
import { SeedProductView } from "./seed-product-view";
import type { ViewVariant } from "./product-view";
import { isSeedProduct } from "../../../lib/seed";

/**
 * GOL-3258: the seed-nut PDP. CTA and harvest badge switch on `rolledOver`, no
 * tree control renders, the pack picker binds the cart to the chosen variant,
 * and a cart holding trees refuses the seed add in the red slot.
 */

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

const pack = (id: number, packSize: string, price: number): ViewVariant => ({
  id,
  name: `Allegheny Chinquapin seed nuts (${packSize})`,
  price,
  available: false,
  qtyAvailable: 0,
  cultivar: null,
  format: null,
  rootstock: null,
  shippingTier: "seed",
  imageUrl: "",
  packSize,
});

// Deliberately out of price order: the card sorts cheapest first.
const PACKS = [pack(902, "Pack of 50", 30), pack(901, "Pack of 10", 20), pack(904, "1 lb", 180)];

const IN_SEASON: SeedSeason = {
  year: 2026,
  shipStart: "2026-10-15",
  shipEnd: "2026-11-15",
  orderBy: "2026-11-01",
  rolledOver: false,
  reason: null,
  open: true,
};
const ROLLED: SeedSeason = {
  ...IN_SEASON,
  year: 2027,
  shipStart: "2027-10-15",
  shipEnd: "2027-11-15",
  orderBy: "2027-11-01",
  rolledOver: true,
  reason: "order_by_passed",
};

function renderSeed(season: SeedSeason | null, saleOk = true) {
  return render(
    <CartProvider>
      <SeedProductView
        productId={300}
        name="Allegheny Chinquapin seed nuts"
        featured={false}
        heroImage=""
        images={[]}
        variants={PACKS}
        fallbackPrice={20}
        saleOk={saleOk}
        seedSeason={season}
      />
    </CartProvider>,
  );
}

const cta = () => screen.getAllByRole("button", { name: /reserve|pre-order|not taking/i })[0];
const cart = () => JSON.parse(window.localStorage.getItem("grove-cart-v1") ?? "[]");

describe("<SeedProductView />", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("in season: green harvest badge, ship line and Reserve for $1", () => {
    const { container } = renderSeed(IN_SEASON);
    expect(container.querySelector("[data-harvest-badge]")?.getAttribute("data-harvest-badge")).toBe("in-season");
    expect(screen.getAllByText(/Fall 2026 harvest/).length).toBeGreaterThan(0);
    expect(screen.getByText("Ships approx Oct 15 to Nov 15 · order by Nov 1")).toBeTruthy();
    expect(cta().textContent).toContain("Reserve for $1");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("rolled over: amber badge, closed-season banner and the fall YYYY CTA", () => {
    const { container } = renderSeed(ROLLED);
    expect(container.querySelector("[data-harvest-badge]")?.getAttribute("data-harvest-badge")).toBe("rolled-over");
    expect(screen.getByRole("status").textContent).toBe(
      "This season’s pre-orders have closed. You’re reserving from the fall 2027 harvest, shipping approx Oct 15 to Nov 15.",
    );
    expect(cta().textContent).toContain("Pre-order for fall 2027, $1");
  });

  it("cap reached says the harvest is fully reserved", () => {
    renderSeed({ ...ROLLED, reason: "cap_reached" });
    expect(screen.getByRole("status").textContent).toMatch(/^This season’s harvest is fully reserved\./);
  });

  it("renders no tree control: method, zone, Format, wave or estimator", () => {
    renderSeed(IN_SEASON);
    expect(screen.queryByText("How do you want it?")).toBeNull();
    expect(screen.queryByLabelText("Your USDA zone")).toBeNull();
    expect(screen.queryByText("Format")).toBeNull();
    expect(screen.queryByRole("group", { name: "Pre-order wave" })).toBeNull();
    expect(screen.queryByText(/Ship to/i)).toBeNull();
    expect(screen.queryByText(/\$10/)).toBeNull();
  });

  it("pack picker selects the right variant and reserves it with the harvest", () => {
    renderSeed(IN_SEASON);
    // Cheapest pack opens selected.
    expect(screen.getByRole("button", { name: /Pack of 10/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Pack of 50/ }));
    expect(screen.getByRole("button", { name: /Pack of 50/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Pack of 10/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(cta());
    const lines = cart();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      variantId: 902,
      price: 30,
      seed: { year: 2026, rolledOver: false, shipStart: "2026-10-15", shipEnd: "2026-11-15" },
    });
    expect(lines[0].wave).toBeUndefined();
  });

  it("refuses the seed add in the red slot when the cart holds trees", () => {
    window.localStorage.setItem(
      "grove-cart-v1",
      JSON.stringify([{ variantId: 1, templateId: 1, name: "Tree", price: 12, imageUrl: "", quantity: 1 }]),
    );
    renderSeed(IN_SEASON);
    fireEvent.click(cta());
    expect(screen.getAllByRole("alert")[0].textContent).toBe(
      "Seed reservations check out on their own. Check out or clear your cart first.",
    );
    expect(cart()).toHaveLength(1);
  });

  it("locks the box when the season is closed or missing", () => {
    renderSeed({ ...IN_SEASON, open: false });
    expect(screen.getByText("Not taking reservations right now.")).toBeTruthy();
    expect((cta() as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    renderSeed(null);
    expect((cta() as HTMLButtonElement).disabled).toBe(true);
  });

  it("copy carries no em dash (listing style rules)", () => {
    const { container } = renderSeed(ROLLED);
    expect(container.textContent).not.toContain("—");
  });
});

describe("isSeedProduct", () => {
  it("keys on a season or a seed-tier variant", () => {
    expect(isSeedProduct({ seedSeason: IN_SEASON, variants: [] })).toBe(true);
    expect(isSeedProduct({ variants: [{ shippingTier: "seed" }] })).toBe(true);
    expect(isSeedProduct({ seedSeason: null, variants: [{ shippingTier: "bareroot" }] })).toBe(false);
  });
});
