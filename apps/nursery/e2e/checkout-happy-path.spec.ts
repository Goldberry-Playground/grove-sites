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

    // GOL-1823 regression: a shipped order MUST carry shipping as its own line
    // item, and the itemized lines MUST sum to the charged total. The original
    // bug shipped a session whose review omitted the shipping line and whose
    // form-screen "Total" fell below the amount finally charged — the fee lived
    // in amountTotal but not in the visible breakdown, so pay-review ≠ checkout
    // screen. Assert the shipping line exists, renders, and reconciles.
    const lines = session.lineItems ?? [];
    expect(lines.length, "a GOL-1057 session must be itemized").toBeGreaterThan(0);
    const shipping = lines.filter((l) => l.kind === "shipping");
    expect(
      shipping.length,
      "a shipped order must itemize shipping as its own line (GOL-1823)",
    ).toBeGreaterThan(0);
    for (const s of shipping) {
      const feeEl = page
        .locator(".grove-review__line", { hasText: s.name })
        .first();
      await expect(feeEl).toContainText(usd(s.unitAmount * s.quantity, session.currency));
    }
    // The visible breakdown reconciles to the amount Stripe charges — no line is
    // hidden from the buyer, so the review total can never sit below the charge.
    const itemizedTotal = lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);
    expect(
      Math.round(itemizedTotal * 100),
      "itemized lines (incl. shipping) must sum to the charged amountTotal (GOL-1823)",
    ).toBe(Math.round(session.amountTotal * 100));

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
