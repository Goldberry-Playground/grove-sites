import { expect, test } from "@playwright/test";
import {
  addCurrentProductToCart,
  expectOnReview,
  fillCheckoutForm,
  findProductByCta,
  submitAndCaptureSession,
  usd,
} from "./helpers";

/**
 * Spec 2 — Mixed cart (GOL-1074).
 *
 * In-stock + reserve (bareroot preorder) items → review shows goods lines
 * ("Ships now") and per-unit **Deposit** lines ("Reserve"); the due-today vs
 * due-later split reconciles against the session `line_items` — each tagged by
 * `kind`, summing to `amount_due_today`.
 *
 * @stripe — creates a real Stripe session; expected-red until GOL-899.
 */
test.describe("checkout — mixed cart", { tag: "@stripe" }, () => {
  test("in-stock + reserve shows both badges and reconciles the due-today split", async ({
    page,
  }) => {
    const inStock = await findProductByCta(page, "Add to Cart");
    await page.goto(inStock.href);
    await addCurrentProductToCart(page, 1, "Add to Cart");

    const reserve = await findProductByCta(page, "Reserve", { skipHref: inStock.href });
    await page.goto(reserve.href);
    await addCurrentProductToCart(page, 1, "Reserve");

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body } = await submitAndCaptureSession(page);
    expect(status).toBe(200);
    expect(body).not.toBeNull();
    const session = body!;

    await expectOnReview(page);

    // A mixed cart carries a preorder → the review shows the two-part split.
    expect(session.hasPreorder).toBe(true);
    await expect(page.getByText("Due today").first()).toBeVisible();
    await expect(page.getByText("Due when it ships").first()).toBeVisible();

    // Both fulfillment badges are present.
    await expect(page.locator(".grove-review__badge--ship").first()).toBeVisible();
    await expect(page.locator(".grove-review__badge--reserve").first()).toBeVisible();

    // Split amounts match the session.
    const dueLater = Math.max(0, session.amountTotal - session.amountDueToday);
    await expect(
      page.locator(".grove-review__amount--today .grove-review__amount-value"),
    ).toHaveText(usd(session.amountDueToday, session.currency));
    await expect(
      page.locator(".grove-review__amount--later .grove-review__amount-value"),
    ).toHaveText(usd(dueLater, session.currency));

    // Reconcile: the itemized charged-today lines sum to amount_due_today.
    const lines = session.lineItems ?? [];
    expect(lines.length, "session must be itemized for a GOL-1057 build").toBeGreaterThan(0);
    const chargedToday = lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);
    expect(Math.round(chargedToday * 100)).toBe(Math.round(session.amountDueToday * 100));

    // The mixed cart must carry at least one deposit (reserve) line and one
    // goods (ships-now) line.
    expect(lines.some((l) => l.kind === "deposit")).toBe(true);
    expect(lines.some((l) => l.kind === "goods")).toBe(true);
  });
});
