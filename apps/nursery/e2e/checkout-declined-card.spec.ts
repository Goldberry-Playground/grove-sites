import { expect, test } from "@playwright/test";
import {
  STRIPE_TEST_CARD_DECLINE,
  addCurrentProductToCart,
  expectCartNotEmpty,
  expectOnReview,
  fillCheckoutForm,
  fillStripeCheckoutAndPay,
  findProductByCta,
  payAtReview,
  submitAndCaptureSession,
} from "./helpers";

/**
 * Spec 5 — Declined card (GOL-1074).
 *
 * Stripe decline card 4000 0000 0000 0002 → the error surfaces on Stripe's
 * page, the buyer never reaches `/checkout/success`, the order is not marked
 * paid, and the cart is **retained** (a cancelled/failed payment must not clear
 * the cart — the inverse of the GOL-1039 cart-clear fix).
 *
 * @stripe — needs a real Stripe session; expected-red until GOL-899.
 */
test.describe("checkout — declined card", { tag: "@stripe" }, () => {
  test("a declined card surfaces an error and keeps the cart", async ({ page }) => {
    const product = await findProductByCta(page, "Add to Cart");
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Add to Cart");

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status } = await submitAndCaptureSession(page);
    expect(status).toBe(200);

    await expectOnReview(page);
    await payAtReview(page);
    await fillStripeCheckoutAndPay(page, STRIPE_TEST_CARD_DECLINE);

    // Stripe keeps the buyer on its page and shows a decline message.
    await expect(
      page.getByText(/declin|card was declined|try a different card|incorrect/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    // We never got a success confirmation.
    expect(page.url()).not.toMatch(/\/checkout\/success/);

    // Cart is retained — a failed payment must not empty it.
    await expectCartNotEmpty(page);
  });
});
