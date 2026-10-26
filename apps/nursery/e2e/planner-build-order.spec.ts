import { expect, test } from "@playwright/test";

/**
 * Order builder acceptance (order-builder spec §C.5, GOL-3383): a West
 * Virginia ZIP, open ground, food forest at 20 trees, mixed timing, Build my
 * order, and the cart holds the planned lines.
 *
 * Runs against a target with `PLANNER_ENABLED=1` in its runtime env (the §F
 * kill switch, GOL-3527; QA sets it, prod leaves it unset); on a target with
 * the flag off `/plan` is a 404 and the spec skips rather than fails, so the
 * prod gate stays green until Josh flips it.
 */

const MOBILE = { width: 390, height: 844 };

test.describe("Order builder", () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.goto("/plan");
    test.skip(res?.status() === 404, "PLANNER_ENABLED is off on this target");
  });

  test("WV ZIP, open ground, food forest 20, mixed → Build my order → cart has the lines", async ({ page }) => {
    await page.getByLabel("ZIP code").fill("26501");
    await expect(page.getByText(/ZIP 26501 is in USDA zone \d+/)).toBeVisible();

    // The radios are visually hidden inside their label cards, so click the
    // card text (what a customer does) rather than `check()` on the input.
    await page.getByText("Open ground", { exact: true }).click();
    await page.getByText("Grow food for my family", { exact: true }).click();
    await page.getByText("Homestead", { exact: true }).click();
    // Question 4 shows with its default already chosen; the plan renders on ask.
    await expect(page.getByLabel(/^Mixed/)).toBeChecked();
    await page.getByTestId("plan-see").click();

    // Every answer lives in the URL.
    await expect(page).toHaveURL(/zip=26501/);
    await expect(page).toHaveURL(/site=open/);
    await expect(page).toHaveURL(/track=food/);
    await expect(page).toHaveURL(/size=20/);
    await expect(page).toHaveURL(/timing=mixed/);

    const heading = page.getByRole("heading", { level: 2, name: /20-tree food forest/ });
    await expect(heading).toBeVisible({ timeout: 30_000 });
    const lines = page.getByTestId("plan-line");
    const lineCount = await lines.count();
    expect(lineCount).toBeGreaterThan(0);

    // A plan with mushroom spawn (winter beta) is two orders, potted spawn
    // and bareroot trees; pre-orders check out on their own, so build the
    // tree group and check those lines reached the cart.
    const bareroot = page.getByTestId("plan-build-bareroot");
    const buildsBareroot = (await bareroot.count()) > 0;
    const group = buildsBareroot ? page.locator("[data-testid='plan-line'][data-tier='bareroot']") : lines;
    const names = await group.locator("a[href^='/shop/']").allTextContents();
    expect(names.length).toBeGreaterThan(0);

    await (buildsBareroot ? bareroot : page.getByRole("button", { name: /Build my/ }).first()).click();
    await expect(page.getByRole("status").filter({ hasText: /Added \d+/ })).toContainText(/Added \d+ (trees?|spawn)/);

    // The mini cart opens with the lines; the cart page lists each planned plant.
    await page.goto("/cart");
    for (const name of names) {
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    }
  });

  test("phone: the quiz and the result fit the viewport", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/plan?zip=26501&site=open&track=food&size=20&timing=mixed");
    await expect(page.getByRole("heading", { level: 2, name: /20-tree food forest/ })).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
