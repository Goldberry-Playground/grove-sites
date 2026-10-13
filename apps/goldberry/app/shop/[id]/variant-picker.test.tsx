// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Farm PDP Color then Size picker (GOL-3315, gom printify spec Storefront §3).
 * The cart-connected AddToCartButton is mocked so the assertions are about
 * WHICH variant id the picker hands it and when it is enabled.
 */

const added = vi.fn();
vi.mock("@grove/checkout", () => ({
  AddToCartButton: (props: { variantId: number; disabled?: boolean; name: string; price: number }) => (
    <button
      type="button"
      disabled={props.disabled}
      data-name={props.name}
      data-price={props.price}
      onClick={() => added(props.variantId)}
    >
      Add to cart
    </button>
  ),
}));

import { VariantPicker } from "./variant-picker";

const v = (id: number, color: string, size: string, price = 28) => ({
  id,
  name: `Grove Tee (${color}, ${size})`,
  sku: null,
  price,
  available: true,
  imageUrl: "",
  color,
  size,
});
const product = {
  id: 7,
  name: "Grove Tee",
  price: 28,
  available: true,
  fulfillmentRoute: "printify",
  leadTime: "3 to 7 business days",
  variants: [v(1, "Natural", "M"), v(2, "Natural", "2XL", 30), v(3, "Sage", "M")],
} as never;

const addButton = () => screen.getByRole("button", { name: "Add to cart" }) as HTMLButtonElement;

describe("VariantPicker", () => {
  beforeEach(() => {
    added.mockReset();
  });

  it("adds the exact chosen variant with its own price", async () => {
    render(<VariantPicker product={product} imageUrl="" />);
    await userEvent.click(screen.getByRole("button", { name: "Natural" }));
    await userEvent.click(screen.getByRole("button", { name: "2XL" }));
    expect(addButton().dataset.price).toBe("30");
    await userEvent.click(addButton());
    expect(added).toHaveBeenCalledWith(2);
  });

  it("does not offer a size missing for the chosen color", async () => {
    render(<VariantPicker product={product} imageUrl="" />);
    await userEvent.click(screen.getByRole("button", { name: "Sage" }));
    expect(screen.queryByRole("button", { name: "2XL" })).toBeNull();
    expect(screen.getByRole("button", { name: "M" })).toBeTruthy();
  });

  it("clears a size that the newly chosen color does not carry", async () => {
    render(<VariantPicker product={product} imageUrl="" />);
    await userEvent.click(screen.getByRole("button", { name: "Natural" }));
    await userEvent.click(screen.getByRole("button", { name: "2XL" }));
    expect(addButton().disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Sage" }));
    expect(addButton().disabled).toBe(true);
    expect(screen.getByRole("button", { name: "M" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("blocks add to cart until both a color and a size are chosen", async () => {
    render(<VariantPicker product={product} imageUrl="" />);
    expect(addButton().disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Natural" }));
    expect(addButton().disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "M" }));
    expect(addButton().disabled).toBe(false);
  });

  it("marks the chosen option with aria-pressed", async () => {
    render(<VariantPicker product={product} imageUrl="" />);
    const natural = screen.getByRole("button", { name: "Natural" });
    expect(natural.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(natural);
    expect(natural.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("group", { name: "Color" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Size" })).toBeTruthy();
  });

  it("hides pickers for a single-variant product and adds that variant", async () => {
    const single = { ...(product as object), variants: [v(9, "Natural", "M")] } as never;
    render(<VariantPicker product={single} imageUrl="" />);
    expect(screen.queryByRole("group", { name: "Color" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Size" })).toBeNull();
    expect(addButton().disabled).toBe(false);
    await userEvent.click(addButton());
    expect(added).toHaveBeenCalledWith(9);
  });

  it("falls back to the template for a product with no variants", async () => {
    const bare = { ...(product as object), variants: [] } as never;
    render(<VariantPicker product={bare} imageUrl="" />);
    await userEvent.click(addButton());
    expect(added).toHaveBeenCalledWith(7);
    expect(addButton().dataset.name).toBe("Grove Tee");
  });

  it("keeps add to cart off for an unavailable product", () => {
    const gone = { ...(product as object), available: false, variants: [v(9, "Natural", "M")] } as never;
    render(<VariantPicker product={gone} imageUrl="" />);
    expect(addButton().disabled).toBe(true);
  });

  it("shows the printed-to-order line and the sizing note", () => {
    render(<VariantPicker product={product} imageUrl="" />);
    expect(screen.getByText("Printed to order, ships in 3 to 7 business days.")).toBeTruthy();
    expect(screen.getByText("Unisex sizing. If you're between sizes, size up.")).toBeTruthy();
  });

  it("omits the printed-to-order line without a lead time", () => {
    const noLead = { ...(product as object), leadTime: null } as never;
    render(<VariantPicker product={noLead} imageUrl="" />);
    expect(screen.queryByText(/Printed to order/)).toBeNull();
  });
});
