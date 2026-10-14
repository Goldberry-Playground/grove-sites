// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createCheckoutSuccessPage } from "./createCheckoutSuccessPage";

/**
 * Printed-to-order confirmation note (GOL-3315, gom printify spec Storefront
 * §5). The farm passes it; the nursery and woodworking pages pass nothing and
 * render exactly as before.
 */

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
// Client-side effects (cart clear, purchase analytics) need the cart store and
// the browser; they are not what this test is about.
vi.mock("./CheckoutSuccessEffects", () => ({ CheckoutSuccessEffects: () => null }));
vi.mock("./PurchaseTracker", () => ({ PurchaseTracker: () => null }));

const NOTE =
  "Your shirt is printed to order and usually ships in 3 to 7 business days. We'll email tracking when it's on the way.";

function odooStub() {
  return { orders: { get: vi.fn().mockRejectedValue(new Error("no handoff")) } } as never;
}

describe("createCheckoutSuccessPage — fulfillmentNote", () => {
  it("renders the note under the confirmation when given", async () => {
    const Page = createCheckoutSuccessPage({ odoo: odooStub(), fulfillmentNote: NOTE });
    const html = renderToStaticMarkup((await Page({ searchParams: Promise.resolve({}) })) as never);
    expect(html).toContain("Payment received");
    expect(html).toContain("Your shirt is printed to order");
    expect(html).toContain("grove-checkout-success__note");
  });

  it("omits it by default", async () => {
    const Page = createCheckoutSuccessPage({ odoo: odooStub() });
    const html = renderToStaticMarkup((await Page({ searchParams: Promise.resolve({}) })) as never);
    expect(html).toContain("Payment received");
    expect(html).not.toContain("printed to order");
    expect(html).not.toContain("grove-checkout-success__note");
  });
});
