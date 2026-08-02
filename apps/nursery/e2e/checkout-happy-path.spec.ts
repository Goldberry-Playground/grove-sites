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
  usd,
} from "./helpers";

/**
 * Spec 1 — Happy path (GOL-1074).
 *
 * All-in-stock cart → review shows the itemized goods + shipping + tax with
 * "Ships now" badges → Stripe test card 4242 succeeds → `/checkout/success` →
 * cart empty. Also asserts the itemized math is identical across the review
 * page and the session `line_items` (and the confirmation order total), which
 * is the GOL-1057 parity acceptance.
 *
 * @stripe — creates a real Stripe session; expected-red until GOL-899 wires
 * test keys onto the QA droplet.
 */
test.describe("checkout — happy path", { tag: "@stripe" }, () => {
  test("in-stock cart pays with 4242, lands on success, empties the cart", async ({
    page,
  }) => {
    const product = await findProductByCta(page, "Add to Cart");
    await page.goto(product.href);
    await addCurrentProductToCart(page, 2, "Add to Cart");

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body } = await submitAndCaptureSession(page);
    expect(status, "session should be created for an in-stock ship order").toBe(200);
    expect(body).not.toBeNull();
    const session = body!;

    // Review page: an all-in-stock order has no preorder, so the split shows a
    // single "Total due today" equal to the session's charged-today amount.
    await expectOnReview(page);
    expect(session.hasPreorder).toBe(false);
    await expect(page.locator(".grove-review__amount--today .grove-review__amount-value")).toHaveText(
      usd(session.amountDueToday, session.currency),
    );

    // Itemized parity: every session line renders on the review page with the
    // correct badge and the same per-line math the buyer will be charged.
    for (const line of session.lineItems ?? []) {
      const lineEl = page.locator(".grove-review__line", { hasText: line.name }).first();
      await expect(lineEl).toContainText(usd(line.unitAmount * line.quantity, session.currency));
      if (line.kind === "goods") await expect(lineEl).toContainText("Ships now");
    }
    // No in-stock line should ever be badged "Reserve".
    await expect(page.locator(".grove-review__badge--reserve")).toHaveCount(0);

    await payAtReview(page);
    await fillStripeCheckoutAndPay(page, STRIPE_TEST_CARD_OK);

    // Back on our confirmation page after a successful charge.
    await page.waitForURL(/\/checkout\/success(\?|$)/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Payment received" })).toBeVisible();
    // Confirmation order total reconciles with the session total (cart → review
    // → Stripe → confirmation identical math).
    await expect(page.getByText(usd(session.amountTotal, session.currency)).first()).toBeVisible();

    await expectCartEmpty(page);
  });
});
