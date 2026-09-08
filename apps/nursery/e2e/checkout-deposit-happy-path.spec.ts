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
import { shipsNowForBareroot } from "./qa-helpers";

/**
 * Leafed-season happy path — the DEPOSIT preorder flow (GOL-1906 / #190).
 *
 * Outside the nursery dormancy window (Nov 1 – Apr 15) bareroot never ships
 * now: an in-stock bareroot line is sold as a $10-per-tree deposit that
 * reserves the tree for the next dormant wave, with the balance charged at
 * ship time (GOL-2053). From 2026-09-08 this is what a September shopper
 * actually experiences, so it is the money path the release gate must prove
 * in this season — the classic ships-now happy path skips itself here and
 * runs in its place from Nov 1.
 *
 * Asserts, against the real session and the real Stripe TEST hosted page:
 *   - the session is a preorder (`hasPreorder`) whose charged-today lines are
 *     ALL `deposit` lines summing to `amountDueToday` (nothing else is charged
 *     now — no goods, no shipping, no tax on the deposit leg);
 *   - `amountDueToday` < `amountTotal` (a real balance remains for ship time);
 *   - the review page shows the due-today / due-later split, every line badged
 *     Reserve and none badged Ships now;
 *   - 4242 pays the deposit, lands on /checkout/success, and the cart empties.
 *
 * @stripe — real Stripe TEST session + payment on QA.
 */
test.describe("checkout — deposit happy path (leafed season)", { tag: "@stripe" }, () => {
  test("in-stock bareroot in leafed season pays a $10 deposit, lands on success, empties the cart", async ({
    page,
  }) => {
    // Deployed target + Stripe's hosted page + a real test payment: give it
    // room beyond the suite default so a slow Stripe render is a retry, not a
    // torn-down browser mid-poll.
    test.setTimeout(180_000);
    test.skip(
      await shipsNowForBareroot(page),
      "dormant season: bareroot ships now — the classic checkout-happy-path covers it",
    );

    // Must be a BAREROOT line: the potted E2E fixture is pickup-only and a ship
    // submit on it is a (correct) 400 — "Potted trees are available for farm
    // pickup only" — which is exactly the intermittent failure this guard
    // prevents. Walk the grid's Bareroot-named products first, then fall back
    // to any product with a live CTA (dormant-season data may differ).
    const bareroot = await findProductByCta(page, ["Add to Cart", "Reserve"], {
      nameMatch: /bareroot/i,
    }).catch(() => null);
    const product = bareroot ?? (await findProductByCta(page, ["Add to Cart", "Reserve"]));
    await page.goto(product.href);
    await addCurrentProductToCart(page, 2, product.buyLabel);

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body, errorBody } = await submitAndCaptureSession(page);
    expect(
      status,
      `a deposit session should be created for a leafed-season bareroot order${errorBody ? ` — server said: ${errorBody}` : ""}`,
    ).toBe(200);
    expect(body).not.toBeNull();
    const session = body!;

    // Preorder economics: only deposits are charged today, and a balance remains.
    expect(session.hasPreorder, "leafed-season bareroot must be a preorder").toBe(true);
    const lines = session.lineItems ?? [];
    expect(lines.length, "session must be itemized").toBeGreaterThan(0);
    expect(
      lines.map((l) => l.kind),
      "charged-today lines in leafed season must be deposits only",
    ).toEqual(lines.map(() => "deposit"));
    const chargedToday = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0);
    expect(Math.round(chargedToday * 100)).toBe(Math.round(session.amountDueToday * 100));
    expect(session.amountDueToday, "a balance must remain for ship time").toBeLessThan(session.amountTotal);
    expect(session.amountDueToday).toBeGreaterThan(0);

    // Review page mirrors the split and badges every line Reserve.
    await expectOnReview(page);
    await expect(page.getByText("Due today").first()).toBeVisible();
    await expect(page.getByText("Due when it ships").first()).toBeVisible();
    await expect(
      page.locator(".grove-review__amount--today .grove-review__amount-value"),
    ).toHaveText(usd(session.amountDueToday, session.currency));
    await expect(
      page.locator(".grove-review__amount--later .grove-review__amount-value"),
    ).toHaveText(usd(session.amountTotal - session.amountDueToday, session.currency));
    await expect(page.locator(".grove-review__badge--reserve").first()).toBeVisible();
    await expect(page.locator(".grove-review__badge--ship")).toHaveCount(0);

    // Pay the deposit on Stripe's hosted page and come home.
    await payAtReview(page);
    await fillStripeCheckoutAndPay(page, STRIPE_TEST_CARD_OK);
    await page.waitForURL(/\/checkout\/success(\?|$)/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /Payment received|Deposit received|Order confirmed/i })).toBeVisible();
    await expectCartEmpty(page);
  });
});
