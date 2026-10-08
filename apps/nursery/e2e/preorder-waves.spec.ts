import { expect, test, type Page } from "@playwright/test";
import {
  expectOnReview,
  findPairedProduct,
  fillCheckoutForm,
  fulfillmentToggle,
  pottedSeasonToday,
  submitAndCaptureSession,
} from "./helpers";

/**
 * Fall / spring bareroot pre-order waves (hotfix 2026-10-07, Josh's rulings).
 *
 * Like the rest of this suite these run against the deployed QA storefront +
 * backend (no local backend; CI runs them on the preview droplet). The backend
 * validates season and waves on its real clock, which a browser-side
 * `page.clock` cannot move, so specs hold on the REAL date: the potted-dependent
 * one skips (with a reason) outside May 1 to Oct 15, and neither pins the clock.
 */

async function clickAddToCart(page: Page, label: string) {
  const anchor = page.locator("[data-add-to-cart-anchor]").first();
  await anchor.getByRole("button", { name: label, exact: true }).first().click();
  return anchor;
}

test.describe("pre-order waves", () => {
  test("a shipped zone 8 spring pre-order sends shipWave spring and a $10 deposit", async ({
    page,
  }) => {
    const { product, scanned, listings } = await findPairedProduct(page, { needPotted: false });
    test.skip(
      product === null,
      `none of the ${scanned} scanned PDPs (of ${listings} listings) carried the Bareroot pre-order card`,
    );
    if (!product) return;

    await page.goto(product.href);
    await fulfillmentToggle(page, "ship").click();
    await page.locator("#usda-zone").selectOption("8");
    await page.getByRole("button", { name: /^Bareroot pre-order/ }).first().click();
    const spring = page.getByRole("button", { name: /^Spring wave/ });
    test.skip(
      (await spring.count()) === 0,
      `${product.name} shows no Spring wave button for zone 8`,
    );
    await expect(spring).toBeVisible();
    test.skip(
      (await spring.getAttribute("aria-disabled")) === "true",
      "the zone 8 spring wave is closed today (past its order-by or before Sep 1)",
    );
    await spring.click();
    await expect(spring).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText("Pre-orders check out on their own, one wave per order."),
    ).toBeVisible();

    const anchor = await clickAddToCart(page, "Pre-order for $10");
    await expect(
      anchor.getByRole("button", { name: "Added!", exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    await page.goto("/checkout");
    await expect(page.getByTestId("order-type")).toHaveText(
      "Pre-order · spring wave · $10 deposit today, balance when your trees ship",
    );

    // Georgia is green-list; ZIP 30303 maps to zone 8 in gom grove_headless/data/zip_usda_zone.csv
    // (30301 is absent from that matrix and would 400 with no planting zone).
    await fillCheckoutForm(page, {
      state: "GA",
      city: "Atlanta",
      zip: "30303",
      street: "100 Peachtree St",
    });
    const sessionBodies: unknown[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/checkout/session") && req.method() === "POST") {
        sessionBodies.push(JSON.parse(req.postData() ?? "{}"));
      }
    });
    const { status, body, errorBody } = await submitAndCaptureSession(page);
    expect(status, `session must be created; server said: ${errorBody ?? "(no body)"}`).toBe(200);
    expect(sessionBodies).toHaveLength(1);
    expect(sessionBodies[0]).toMatchObject({ shipWave: "spring" });
    const deposit = (body?.lineItems ?? []).filter((l) => l.kind === "deposit");
    expect(deposit).toHaveLength(1);
    expect(deposit[0].unitAmount * deposit[0].quantity).toBe(10);
    expect(body?.amountDueToday).toBe(10);
    await expectOnReview(page);
  });

  test("a zone 8 fall pre-order shipped to a ZIP whose fall wave closed switches to spring", async ({
    page,
  }) => {
    const { product, scanned, listings } = await findPairedProduct(page, { needPotted: false });
    test.skip(
      product === null,
      `none of the ${scanned} scanned PDPs (of ${listings} listings) carried the Bareroot pre-order card`,
    );
    if (!product) return;

    await page.goto(product.href);
    await fulfillmentToggle(page, "ship").click();
    await page.locator("#usda-zone").selectOption("8");
    await page.getByRole("button", { name: /^Bareroot pre-order/ }).first().click();
    const fall = page.getByRole("button", { name: /^Fall wave/ });
    test.skip((await fall.count()) === 0, `${product.name} shows no Fall wave button for zone 8`);
    test.skip(
      (await fall.getAttribute("aria-disabled")) === "true",
      "the zone 8 fall wave is closed today, so the PDP cannot start a fall pre-order",
    );
    await fall.click();
    const anchor = await clickAddToCart(page, "Pre-order for $10");
    await expect(
      anchor.getByRole("button", { name: "Added!", exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // The backend judges waves on its real clock, and every fall order-by is in
    // November, so no real ZIP refuses fall before Nov 12. Stand in for the
    // backend's refusal of the FALL quote for this destination (the exact shape
    // /api/cart/quote returns once the backend confirms spring); every other
    // quote, including the spring re-quote and the session, hits QA for real.
    const ZIP = "30303"; // GA, zone 8 in the gom ZIP matrix; spring is open for it
    const CLOSED = "The fall pre-order for zone 8 closed on Nov 21. Choose spring.";
    const quoteBodies: Record<string, unknown>[] = [];
    await page.route("**/api/cart/quote", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      quoteBodies.push(body);
      if (body.shipWave === "fall" && body.zip === ZIP) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: CLOSED, alternateWave: "spring" }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/checkout");
    await expect(page.getByTestId("order-type")).toHaveText(
      "Pre-order · fall wave · $10 deposit today, balance when your trees ship",
    );
    await fillCheckoutForm(page, {
      state: "GA",
      city: "Atlanta",
      zip: ZIP,
      street: "100 Peachtree St",
    });

    // The ZIP reaches the quote, and the refusal shows BEFORE "Continue to payment".
    await expect(page.getByRole("alert").filter({ hasText: CLOSED })).toBeVisible();
    expect(quoteBodies.some((b) => b.shipWave === "fall" && b.zip === ZIP)).toBe(true);
    await expect(page.locator(".grove-checkout__submit")).toBeDisabled();

    await page.getByRole("button", { name: "Switch this order to the spring wave" }).click();
    await expect(page.getByTestId("order-type")).toHaveText(
      "Pre-order · spring wave · $10 deposit today, balance when your trees ship",
    );
    await expect(page.getByRole("alert").filter({ hasText: CLOSED })).toHaveCount(0);
    await expect(page.locator(".grove-checkout__submit")).toBeEnabled({ timeout: 10_000 });
    expect(quoteBodies.at(-1)).toMatchObject({ shipWave: "spring", zip: ZIP });

    const sessionBodies: unknown[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/checkout/session") && req.method() === "POST") {
        sessionBodies.push(JSON.parse(req.postData() ?? "{}"));
      }
    });
    const { status, errorBody } = await submitAndCaptureSession(page);
    expect(status, `session must be created; server said: ${errorBody ?? "(no body)"}`).toBe(200);
    expect(sessionBodies[0]).toMatchObject({ shipWave: "spring" });
    await expectOnReview(page);
  });

  test("adding a pre-order to a cart that holds a potted line is refused", async ({ page }) => {
    test.skip(
      !pottedSeasonToday(),
      "real date is outside the potted season (May 1 to Oct 15); no immediate line to conflict with",
    );
    const { product, scanned, listings } = await findPairedProduct(page, { needPotted: true });
    test.skip(
      product === null,
      `none of the ${scanned} scanned PDPs (of ${listings} listings) had both a potted format and the Bareroot pre-order card`,
    );
    if (!product) return;

    // Immediate line first: potted for Farm pickup.
    await page.goto(product.href);
    await fulfillmentToggle(page, "pickup").click();
    await page.getByRole("button", { name: /^Potted/ }).first().click();
    const anchor = await clickAddToCart(page, "Add to cart");
    await expect(
      anchor.getByRole("button", { name: "Added!", exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Now a pre-order on the same listing: the cart is immediate, so it must refuse.
    await page.reload();
    await fulfillmentToggle(page, "pickup").click();
    await page.getByRole("button", { name: /^Bareroot pre-order/ }).first().click();
    const openWave = page
      .getByRole("group", { name: "Pre-order wave" })
      .getByRole("button")
      .and(page.locator('[aria-disabled="false"]'))
      .first();
    await expect(openWave, "an open farm-zone pickup wave is needed").toBeVisible();
    await openWave.click();
    await clickAddToCart(page, "Pre-order for $10");
    await expect(
      page.getByText("Pre-orders check out on their own. Check out or clear your cart first."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Added!", exact: true })).toHaveCount(0);
  });
});
