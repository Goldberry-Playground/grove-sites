import { expect, test } from "@playwright/test";
import {
  STRIPE_TEST_CARD_OK,
  addCurrentProductToCart,
  expectCartEmpty,
  expectOnReview,
  fillCheckoutForm,
  fillStripeCheckoutAndPay,
  findProductByCtaOrNull,
  payAtReview,
  submitAndCaptureSession,
} from "./helpers";
import { NO_FULL_CHARGE_PRODUCT_REASON } from "./qa-helpers";

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
 * The two full-charge routes run whenever an "Add to cart" (ships-now) line is
 * offered and skip on product availability otherwise; a third test proves the
 * id-route cart-clear on a $10-DEPOSIT success, which is the confirmation path
 * that IS live after the GOL-2233 season cutover (GOL-3787). Before GOL-3787
 * both routes `test.skip`-ped on the date, leaving the cart-clear invariant
 * ungated from Oct 16 to spring.
 *
 * @stripe — all routes require a real session (Stripe keys); expected-red
 * until GOL-899.
 */
const ZONE = 6; // ZIP 26651, the fillCheckoutForm default

test.describe("checkout — cart cleared after success", { tag: "@stripe" }, () => {
  test("Stripe return route (/checkout/success) empties the cart", async ({ page }) => {
    // Full-charge success route; runs when an "Add to cart" line is offered and
    // skips on product availability after the GOL-2233 cutover (not the date).
    // The deposit /checkout/success cart-clear is covered by
    // checkout-deposit-happy-path.
    const product = await findProductByCtaOrNull(page, "Add to cart");
    test.skip(product === null, NO_FULL_CHARGE_PRODUCT_REASON);
    if (!product) return;
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Add to cart");

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
    // Full-charge success route; runs when an "Add to cart" line is offered and
    // skips on product availability after the GOL-2233 cutover. The deposit
    // variant below carries the id-route cart-clear year-round.
    const product = await findProductByCtaOrNull(page, "Add to cart");
    test.skip(product === null, NO_FULL_CHARGE_PRODUCT_REASON);
    if (!product) return;
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Add to cart");

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

  test("id route (/checkout/success/[id]) empties the cart after a DEPOSIT success", async ({
    page,
  }) => {
    // The id-route cart-clear on the path that is live AFTER the GOL-2233 season
    // cutover (GOL-3787): a $10-deposit pre-order. checkout-deposit-happy-path
    // proves the Stripe-return route on a deposit; this proves the id route,
    // which a pickup/pay-later deposit order lands on. Skips when no open zone 6
    // wave exists today (real date), a product-availability reason.
    test.setTimeout(180_000);

    const product = await findProductByCtaOrNull(page, "Pre-order for $10", {
      preorder: { method: "ship", zone: ZONE },
    });
    test.skip(
      product === null,
      `no bareroot listing with an open zone ${ZONE} pre-order wave on this target today (real date)`,
    );
    if (!product) return;
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Pre-order for $10", {
      method: "ship",
      zone: ZONE,
      wave: product.wave,
    });

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body } = await submitAndCaptureSession(page);
    expect(status, "a deposit session should be created for a wave pre-order").toBe(200);
    expect(body).not.toBeNull();
    const session = body!;
    expect(session.hasPreorder, "the session under test is a deposit pre-order").toBe(true);

    await page.goto(`/checkout/success/${session.orderId}?token=${session.accessToken}`);
    await expect(page.getByRole("heading", { name: "Order Confirmed" })).toBeVisible();

    await expectCartEmpty(page);
  });
});
