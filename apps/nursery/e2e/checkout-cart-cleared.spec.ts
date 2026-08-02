import { expect, test } from "@playwright/test";
import {
  STRIPE_TEST_CARD_OK,
  addCurrentProductToCart,
  expectCartEmpty,
  expectOnReview,
  fillCheckoutForm,
  fillStripeCheckoutAndPay,
  findProductByCta,
  payAtReview,
  submitAndCaptureSession,
} from "./helpers";

/**
 * Spec 6 — Cart cleared after success, across BOTH success routes (GOL-1074).
 *
 * This is the in-browser proof of GOL-1039 item 1: `CheckoutSuccessEffects`
 * empties the cart *after* CartProvider rehydrates, on both confirmation routes:
 *
 *   - `/checkout/success`      (Stripe return — createCheckoutSuccessPage)
 *   - `/checkout/success/[id]` (order confirmation — createOrderSuccessPage)
 *
 * The old bug: clear() ran before rehydration and the provider then repopulated
 * the cart from localStorage, so the cart survived a completed payment.
 *
 * @stripe — both routes require a real session (Stripe keys); expected-red
 * until GOL-899.
 */
test.describe("checkout — cart cleared after success", { tag: "@stripe" }, () => {
  test("Stripe return route (/checkout/success) empties the cart", async ({ page }) => {
    const product = await findProductByCta(page, "Add to Cart");
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Add to Cart");

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status } = await submitAndCaptureSession(page);
    expect(status).toBe(200);

    await expectOnReview(page);
    await payAtReview(page);
    await fillStripeCheckoutAndPay(page, STRIPE_TEST_CARD_OK);

    await page.waitForURL(/\/checkout\/success(\?|$)/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Payment received" })).toBeVisible();

    await expectCartEmpty(page);
  });

  test("order confirmation route (/checkout/success/[id]) empties the cart", async ({ page }) => {
    // Populate the cart via the real UI so localStorage genuinely holds a line —
    // the exact state that used to survive the buggy clear().
    const product = await findProductByCta(page, "Add to Cart");
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Add to Cart");

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body } = await submitAndCaptureSession(page);
    expect(status).toBe(200);
    expect(body).not.toBeNull();
    const session = body!;

    // Drive the id-based confirmation route directly with the real order id +
    // access token from the session (no need for the pickup UI to exist yet):
    // this is exactly the route a pickup/pay-later order lands on, and it mounts
    // the same CheckoutSuccessEffects.
    await page.goto(`/checkout/success/${session.orderId}?token=${session.accessToken}`);
    await expect(page.getByRole("heading", { name: "Order Confirmed" })).toBeVisible();

    await expectCartEmpty(page);
  });
});
