import { test, expect } from "@playwright/test";

test.describe("hub → vendor checkout hand-off", () => {
  test("user can navigate home → marketplace → product → buy", async ({ page }) => {
    // 1. Home page renders the village manifesto + featured grid.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/village/i);

    // 2. Click into the marketplace.
    await page.getByRole("link", { name: /browse the village/i }).click();
    await expect(page).toHaveURL(/\/marketplace$/);

    // 3. Click the first featured product. (Order is hub-curated; stable for V0.)
    const firstProduct = page.locator(".product-card").first();
    await firstProduct.click();
    await expect(page).toHaveURL(/\/marketplace\/[a-z]+\/[a-z0-9-]+$/);

    // 4. Product detail shows the Buy form pointing at the vendor's Odoo.
    const buyButton = page.getByRole("button", { name: /Buy from/ });
    await expect(buyButton).toBeVisible();
    const form = page.locator("form").filter({ has: buyButton });
    const action = await form.getAttribute("action");
    expect(action).toMatch(/\/shop\/cart\/update/);

    // 5. The hidden inputs are correct.
    await expect(form.locator("input[name=product_id]")).toHaveAttribute("value", /^\d+$/);
    await expect(form.locator("input[name=add_qty]")).toHaveValue("1");
    await expect(form.locator("input[name=referrer]")).toHaveValue("grove-hub");
  });

  test("unknown product slug returns 404", async ({ page }) => {
    const response = await page.goto("/marketplace/goldberry/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
