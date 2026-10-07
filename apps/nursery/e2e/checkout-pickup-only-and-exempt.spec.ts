import { expect, test } from "@playwright/test";
import {
  addCurrentProductToCart,
  expectOnReview,
  fillCheckoutForm,
  findPairedProduct,
  findProductByCtaOrNull,
  fulfillmentToggle,
  pottedSeasonToday,
  submitAndCaptureSession,
  uniqueBuyerEmail,
} from "./helpers";

/**
 * Storefront half of the GOL-2587 P1 compliance hotfix (GOL-2588).
 *
 * Two product flags now ride the catalog payload, and each has to hold end to
 * end — the whole point of the P1 was a storefront that promised what checkout
 * then refused:
 *
 *   1. `compliance_exempt` — prod has ZERO mrp.bom records, so the GOL-2132
 *      carve-out gate could not tell a bundle from a standalone line and
 *      fail-safed every unparseable "Bundle: …" botanical into all 9 regulated
 *      states. OH is green AND regulated, so an exempt bundle bought to an Ohio
 *      address is the exact case that used to 400 after the buyer had filled the
 *      whole form. It must now reach Review & pay.
 *
 *   2. `pickup_only` — checkout rejects any SHIP order containing such a line,
 *      whatever its shipping tier. The PDP must say so before the buyer commits
 *      (no estimator, pickup CTA copy) and the checkout form must lock
 *      fulfillment to pickup rather than collect an address it will refuse.
 *
 * Both tests are data-conditional: the prod data flips (templates 22/132/133/134/
 * 135 exempt, 93 pickup-only) are Josh's, and QA may not carry the fixtures. An
 * absent fixture skips with a named reason — a data gap is not a storefront
 * regression. The FLAG PLUMBING itself is unit-tested (odoo-client normalizers,
 * `isPickupOnly`, `buyStateFor`, the kit's `forcePickup`), so this spec only
 * covers what unit tests cannot: that the flows actually complete.
 */
test.describe("GOL-2588 — compliance-exempt ships to OH, pickup-only locks fulfillment", () => {
  test("an exempt bundle with an Ohio address reaches Review & pay", async ({ page }) => {
    // Any shippable buy CTA: a bundle can be in stock or reservable, but it must
    // not be pickup-only (that is the other test's subject and a different gate).
    const product = await findProductByCtaOrNull(page, ["Add to Cart", "Reserve"], {
      nameMatch: /remembrance grove/i,
    });
    test.skip(
      product === null,
      'no shippable "Remembrance Grove" in the QA catalog — seed the bundle fixture ' +
        "(GOL-2589) and flip grove_compliance_exempt before this can run",
    );
    if (!product) return; // narrowing for TS; test.skip already stopped the run

    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, product.buyLabel);

    await page.goto("/checkout");
    // OH is on the green list, so it is selectable; before the hotfix the
    // per-line carve-out still refused it at the session route.
    await fillCheckoutForm(page, {
      state: "OH",
      city: "Columbus",
      zip: "43215",
      street: "500 Buckeye Row",
    });
    const { status, body, errorBody } = await submitAndCaptureSession(page);
    expect(
      status,
      `Ohio + ${product.name} must create a session; server said: ${errorBody ?? "(no body)"}`,
    ).toBe(200);
    expect(body?.orderId).toBeGreaterThan(0);
    await expectOnReview(page);
  });

  test("a pickup-only product says so on the PDP and locks checkout to pickup", async ({
    page,
  }) => {
    // The CTA copy IS the signal: `buyStateFor` only renders "Reserve for farm
    // pickup" once `isPickupOnly` resolved true, so matching on it finds a
    // pickup-only product without needing to know which template Josh flipped.
    const product = await findProductByCtaOrNull(page, "Reserve for farm pickup");
    test.skip(
      product === null,
      "no farm-pickup-only product in the QA catalog — flip grove_pickup_only on a " +
        "template (prod: 93) before this can run",
    );
    if (!product) return;

    await page.goto(product.href);

    // PDP: no state estimator (there is no rate to estimate, and a dead state
    // select would imply we might ship), and the pickup treatment is stated in
    // words, not by colour.
    await expect(page.locator('[aria-labelledby="ship-est-label"]')).toHaveCount(0);
    await expect(page.getByText("Farm pickup only.", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Ships to \d+ states/)).toHaveCount(0);

    await addCurrentProductToCart(page, 1, "Reserve for farm pickup");
    await page.goto("/checkout");

    const form = page.locator("form.grove-checkout__grid");
    await expect(form).toBeVisible();
    // Pickup is offered alone, selected and inert; shipping is not rendered as a
    // dead control; the ship-to address is gone. The reason is in WORDS, which is
    // the only signal a screen reader or a grayscale screen can use.
    await expect(form.locator('input[name="fulfillment"][value="ship"]')).toHaveCount(0);
    await expect(form.locator('input[name="fulfillment"][value="pickup"]')).toBeChecked();
    await expect(form.getByRole("group", { name: "Shipping Address" })).toHaveCount(0);
    await expect(form.getByText(/only release at the farm/i)).toBeVisible();

    // A pickup order passes the backend gate, so the flow still completes. Only
    // contact fields are collected here: the locked pickup collapses the whole
    // ship-to fieldset, which is the point, so `fillCheckoutForm` (which fills
    // Street/City/ZIP) does not apply.
    await form.getByLabel("Full name").fill("E2E Pickup Buyer");
    await form.getByLabel("Email").fill(uniqueBuyerEmail());
    await form.getByLabel("Phone").fill("3045551212");
    const { status, errorBody } = await submitAndCaptureSession(page);
    expect(
      status,
      `a pickup order for ${product.name} must be accepted; server said: ${errorBody ?? "(no body)"}`,
    ).toBe(200);
    await expectOnReview(page);
  });

  test("a potted tree chosen for Farm pickup locks checkout to pickup", async ({ page }) => {
    // Pickup-chosen potted lines are pickupOnly (2026-10-07 gate). The backend
    // validates the potted season on its real clock, so guard on the real date.
    test.skip(
      !pottedSeasonToday(),
      "real date is outside the potted season (May 1 to Oct 15); potted is not sellable",
    );
    const { product, scanned, listings } = await findPairedProduct(page, { needPotted: true });
    test.skip(
      product === null,
      `none of the ${scanned} scanned PDPs (of ${listings} listings) had both a potted format and the Bareroot pre-order card`,
    );
    if (!product) return;

    await page.goto(product.href);
    await fulfillmentToggle(page, "pickup").click();
    await page.getByRole("button", { name: /^Potted/ }).first().click();
    const anchor = page.locator("[data-add-to-cart-anchor]").first();
    await anchor.getByRole("button", { name: "Add to cart", exact: true }).first().click();
    await expect(
      anchor.getByRole("button", { name: "Added!", exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    await page.goto("/checkout");
    const form = page.locator("form.grove-checkout__grid");
    await expect(form).toBeVisible();
    await expect(form.locator('input[name="fulfillment"][value="ship"]')).toHaveCount(0);
    await expect(form.locator('input[name="fulfillment"][value="pickup"]')).toBeChecked();
  });
});
