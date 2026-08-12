// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CheckoutPage } from "./index";

// GOL-1314: the presentational kit must never bake a brand-specific claim in as
// a default. The trust strip used to default to the nursery set (including the
// live-plant "arrive-alive guarantee"), and the pickup fieldset hardcoded
// "our WV nursery" / "live trees … planting window". Any consumer that dropped
// the prop — a new surface, a hub reuse, a refactor — would then silently
// advertise a promise false for its products. These tests pin the safe
// defaults: no strip and no product-specific claim unless a brand opts in.

const items = [
  { variantId: 1, templateId: 1, name: "Test Item", price: 10, quantity: 1 },
];

describe("<CheckoutPage /> kit — truthful-by-default (GOL-1314)", () => {
  it("renders no trust strip when trustItems is omitted", () => {
    const { container } = render(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} />,
    );
    expect(container.querySelector(".grove-checkout__trust")).toBeNull();
    expect(
      screen.queryByText(/arrive-alive/i),
      "the kit must not default the nursery live-plant guarantee",
    ).toBeNull();
  });

  it("makes no live-tree / named-location pickup claim by default", () => {
    render(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {}}
        allowPickup
      />,
    );
    // Pickup is offered (brand-neutral copy) but with no false product claim.
    expect(screen.getByText(/local pickup/i)).toBeTruthy();
    expect(screen.queryByText(/live tree/i)).toBeNull();
    expect(screen.queryByText(/nursery/i)).toBeNull();
    expect(screen.queryByText(/west virginia/i)).toBeNull();
  });

  it("the ship-states note makes no live-tree claim by default", () => {
    render(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {}}
        shipStates={[
          { code: "WV", name: "West Virginia" },
          { code: "OH", name: "Ohio" },
        ]}
      />,
    );
    expect(screen.getByText(/we currently ship to 2 states/i)).toBeTruthy();
    expect(screen.queryByText(/live trees/i)).toBeNull();
  });

  it("renders brand-supplied pickup copy verbatim when provided", () => {
    render(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {}}
        allowPickup
        pickupCopy={{
          shipLabel: "Ship to me",
          pickupLabel: "Farm pickup — collect at our WV nursery ($0 shipping)",
          pickupNote: "Pick up at our West Virginia nursery.",
          shipNote: "We ship live trees to your address.",
        }}
      />,
    );
    expect(
      screen.getByText(/collect at our WV nursery/i),
    ).toBeTruthy();
    // The ship note is shown by default (ship is the default fulfillment).
    expect(screen.getByText(/we ship live trees/i)).toBeTruthy();
  });
});
