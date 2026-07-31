// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { CHECKOUT_HANDOFF_COOKIE } from "../checkout-handoff";

// GOL-1039 — the cart-survives-payment defect.
//
// CheckoutSuccessEffects renders *inside* CartProvider, so on mount React
// flushes this child's effect before the provider's own rehydrate effect
// (`setItems(loadFromStorage())`). The old code cleared unconditionally, so on
// the Stripe full-page return the provider re-loaded the just-ordered cart from
// localStorage right after the clear — the cart survived payment.
//
// The fix gates the clear on `hydrated`, which the provider flips true only
// AFTER it has rehydrated. These tests pin that gate directly (mocking useCart)
// because the browser hydration-commit ordering that triggers the race is not
// reproducible under happy-dom's client-only render — the end-to-end proof of
// "cart empty after the Stripe return" lives in the Playwright acceptance suite.
const mockCart = vi.hoisted(() => ({ clear: vi.fn(), hydrated: false }));
vi.mock("../cart-store", () => ({ useCart: () => mockCart }));

// Imported after the mock is registered.
import { CheckoutSuccessEffects } from "./CheckoutSuccessEffects";

beforeEach(() => {
  mockCart.clear.mockClear();
  mockCart.hydrated = false;
  // The hand-off cookie is scoped to `path=/checkout`; land the document there
  // so it is both readable and expirable under happy-dom's cookie store.
  window.location.href = "http://localhost/checkout/success";
  document.cookie = `${CHECKOUT_HANDOFF_COOKIE}=seeded; path=/checkout`;
});

afterEach(() => {
  document.cookie = `${CHECKOUT_HANDOFF_COOKIE}=; path=/checkout; max-age=0`;
});

describe("CheckoutSuccessEffects", () => {
  it("does NOT clear the cart before the provider has hydrated", async () => {
    render(<CheckoutSuccessEffects />);
    // Give effects a chance to flush; the clear must still be held back.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockCart.clear).not.toHaveBeenCalled();
    // The one-shot cookie must also survive until we actually clear.
    expect(document.cookie).toContain(`${CHECKOUT_HANDOFF_COOKIE}=seeded`);
  });

  it("clears the cart and expires the hand-off cookie once hydrated", async () => {
    mockCart.hydrated = true;
    render(<CheckoutSuccessEffects />);

    await waitFor(() => {
      expect(mockCart.clear).toHaveBeenCalledTimes(1);
    });
    expect(document.cookie).not.toContain(`${CHECKOUT_HANDOFF_COOKIE}=seeded`);
  });

  it("clears exactly once even across re-renders", async () => {
    mockCart.hydrated = true;
    const { rerender } = render(<CheckoutSuccessEffects />);
    await waitFor(() => expect(mockCart.clear).toHaveBeenCalledTimes(1));
    rerender(<CheckoutSuccessEffects />);
    rerender(<CheckoutSuccessEffects />);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockCart.clear).toHaveBeenCalledTimes(1);
  });
});
