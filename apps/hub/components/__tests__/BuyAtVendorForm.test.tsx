// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuyAtVendorForm } from "../BuyAtVendorForm";
import type { Vendor } from "../../data/marketplace";

const goldberry: Vendor = {
  slug: "goldberry",
  name: "Goldberry Grove Farm",
  tagline: "test",
  story: "test",
  brandColor: "#5A2A4B",
  homepageUrl: "https://goldberrygrove.farm",
  odoo: { apiUrl: "http://x", tenantSlug: "goldberry" },
};

describe("BuyAtVendorForm", () => {
  it("renders a POST form targeting the vendor's cart endpoint", () => {
    const { container } = render(
      <BuyAtVendorForm vendor={goldberry} productId={42} />,
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form?.method).toBe("post");
    expect(form?.action).toBe(
      "https://goldberrygrove.farm/shop/cart/update?product_id=42&add_qty=1",
    );
  });

  it("includes product_id, add_qty, and referrer hidden inputs", () => {
    render(<BuyAtVendorForm vendor={goldberry} productId={42} />);
    expect(
      (screen.getByTestId("hidden-product-id") as HTMLInputElement).value,
    ).toBe("42");
    expect(
      (screen.getByTestId("hidden-add-qty") as HTMLInputElement).value,
    ).toBe("1");
    expect(
      (screen.getByTestId("hidden-referrer") as HTMLInputElement).value,
    ).toBe("grove-hub");
  });

  it("renders the vendor name in the button label", () => {
    render(<BuyAtVendorForm vendor={goldberry} productId={42} />);
    // getByRole throws if no match, so reaching .toBeDefined() proves
    // the button exists with the expected accessible name.
    expect(
      screen.getByRole("button", { name: /Buy from Goldberry Grove Farm/i }),
    ).toBeDefined();
  });
});
