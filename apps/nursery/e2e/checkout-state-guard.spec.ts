import { expect, test } from "@playwright/test";
import {
  addCurrentProductToCart,
  fillCheckoutForm,
  findProductByCta,
  submitCheckoutForm,
} from "./helpers";

/**
 * Spec 4 — Unparseable / missing state guard (GOL-1074).
 *
 * With the State `<select>` (GOL-1055) a missing/garbage state is now
 * un-submittable at the UI: the required select starts at its disabled
 * placeholder, so the native form guard blocks submit and no checkout-session
 * request is ever made. Pure client-side — needs no backend or Stripe.
 */
test.describe("checkout — missing-state guard", () => {
  test("required state select blocks submit and fires no session request", async ({ page }) => {
    const product = await findProductByCta(page, "Add to Cart");
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Add to Cart");

    // Watch for any checkout-session call; there must be none.
    let sessionRequested = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/checkout/session")) sessionRequested = true;
    });

    await page.goto("/checkout");
    // Fill everything EXCEPT the state select (left at its placeholder).
    await fillCheckoutForm(page, { state: undefined });
    await submitCheckoutForm(page);

    // The invalid required select keeps native submission from firing.
    const stateValid = await page
      .getByLabel("State")
      .evaluate((el) => (el as HTMLSelectElement).validity.valid);
    expect(stateValid, "empty required state select must be invalid").toBe(false);

    // Give any (erroneous) submit a moment to fire, then assert none did and we
    // never advanced to the review page.
    await page.waitForTimeout(1_000);
    expect(sessionRequested, "no session should be created without a state").toBe(false);
    await expect(page.getByRole("heading", { name: "Review & pay" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  });
});
