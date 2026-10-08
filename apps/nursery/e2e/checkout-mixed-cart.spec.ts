import { expect, test } from "@playwright/test";
import {
  addCurrentProductToCart,
  findProductByCtaOrNull,
  pottedSeasonToday,
  prepareWavePreorder,
} from "./helpers";

/**
 * Mixed cart: refused (hotfix 2026-10-07, Josh's rulings; was GOL-1074's
 * whole-order deposit collapse).
 *
 * One wave per order, and pre-orders never mix with trees that ship now. The
 * PDP refuses to add a "Pre-order for $10" line to a cart that already holds an
 * immediate ("Add to cart") line, says why, and leaves the cart unchanged; the
 * backend refuses the same mix (400) if a stale cart ever reaches checkout.
 *
 * Runs against the deployed QA storefront + backend on the REAL date (the
 * backend's clock cannot be moved from the browser): an immediate line needs
 * something to sell now and the pre-order needs an open wave, so each missing
 * precondition skips with a named reason. No Stripe session is created.
 */
const REFUSAL = "Pre-orders check out on their own. Check out or clear your cart first.";

test.describe("checkout — mixed cart", () => {
  test("adding a pre-order to a cart holding an in-stock line is refused", async ({ page }) => {
    test.skip(
      !pottedSeasonToday(),
      "real date (UTC) is outside the potted season (May 1 to Oct 15); no immediate line to mix with",
    );

    const inStock = await findProductByCtaOrNull(page, "Add to cart");
    test.skip(inStock === null, 'no enabled "Add to cart" product on this target right now');
    if (!inStock) return;
    const preorder = await findProductByCtaOrNull(page, "Pre-order for $10", { skipHref: inStock.href });
    test.skip(
      preorder === null,
      "no bareroot listing with an open zone 6 pre-order wave on this target today (real date)",
    );
    if (!preorder) return;

    await page.goto(inStock.href);
    await addCurrentProductToCart(page, 1, "Add to cart");

    await page.goto(preorder.href);
    const wave = await prepareWavePreorder(page);
    expect(wave, "the pre-order wave found by the scan should still be open").not.toBeNull();
    const anchor = page.locator("[data-add-to-cart-anchor]").first();
    await anchor.getByRole("button", { name: "Pre-order for $10", exact: true }).first().click();

    await expect(page.getByText(REFUSAL)).toBeVisible();
    await expect(page.getByRole("button", { name: "Added!", exact: true })).toHaveCount(0);

    // The cart still holds only the immediate line.
    await page.goto("/cart");
    await expect(page.locator(".grove-cart__line")).toHaveCount(1);
    await expect(page.getByTestId("order-type")).toHaveText(
      "Ships now or ready for pickup · charged in full",
    );
  });
});
