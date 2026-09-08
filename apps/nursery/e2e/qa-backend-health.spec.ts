import { expect, test } from "@playwright/test";
import { addCurrentProductToCart, fillCheckoutForm, findProductByCta, submitCheckoutForm } from "./helpers";
import { catalogCards, collectFailures, readShopGrid } from "./qa-helpers";

/**
 * QA gate — backend has no major errors.
 *
 * Drives the routes a shopper hits (home → shop → PDP → cart → checkout form
 * → session request) with a failure collector attached, and requires ZERO
 * server-side failures: no 5xx from the BFF or from Odoo behind it, no
 * uncaught page errors, no console.error the app logged for a failed fetch.
 *
 * Also probes the backend surface the storefront depends on directly (through
 * the same request context, so the same network path):
 *   - grove_headless `/grove/api/v1/health` → {"status":"ok"}
 *   - the product feed the grid renders from is non-empty
 *   - the BFF `/api/checkout` (order create) returns a JSON contract, never an
 *     edge error page — this is the exact failure that caused the 2026-09-06
 *     "We couldn't start secure checkout" incident (a 500 in Odoo became a
 *     gateway 504 with an HTML body the frontend could not explain).
 *
 * The Odoo base URL is discovered from the page itself (the optimizer URLs the
 * grid emits point at `<odoo>/web/image/...`) so the spec has no per-env
 * config and can't drift from what the deployed frontend actually talks to.
 */
test.describe("qa gate — backend health", () => {
  test("shopper journey produces no 5xx, page errors, or console errors", async ({ page }) => {
    const { failures } = collectFailures(page);

    await page.goto("/");
    const cards = catalogCards(await readShopGrid(page));
    expect(cards.length, "shop grid should list catalog products").toBeGreaterThan(0);
    await page.goto(cards[0].href);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.goto("/cart");
    await page.goto("/checkout");

    expect(failures, "server/console failures during the shopper journey").toEqual([]);
  });

  test("grove_headless health endpoint answers ok through the storefront's Odoo base", async ({
    page,
  }) => {
    await page.goto("/shop");
    // Discover the Odoo origin the deployed frontend is wired to.
    const odooOrigin = await page.evaluate(() => {
      const img = Array.from(document.images).find((i) =>
        /web%2Fimage|\/web\/image\//.test(i.currentSrc || i.src),
      );
      if (!img) return null;
      const src = img.currentSrc || img.src;
      const inner = new URL(src, location.href).searchParams.get("url") ?? src;
      return new URL(inner, location.href).origin;
    });
    expect(odooOrigin, "could not discover the Odoo origin from grid image URLs").toBeTruthy();
    test.info().annotations.push({ type: "odoo", description: odooOrigin! });

    const health = await page.request.get(`${odooOrigin}/grove/api/v1/health`, {
      timeout: 20_000,
    });
    expect(health.status(), "health endpoint status").toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const products = await page.request.get(`${odooOrigin}/grove/api/v1/products?limit=50`, {
      headers: { "X-Grove-Tenant": "nursery" },
      timeout: 30_000,
    });
    expect(products.status(), "product feed status").toBe(200);
    const feed = (await products.json()) as { results?: unknown[]; count?: number };
    expect(feed.results?.length ?? 0, "product feed should not be empty").toBeGreaterThan(0);
  });

  test("checkout order-create answers with the JSON contract, never an edge error page", async ({
    page,
  }) => {
    // Reach the checkout form with any purchasable line, submit, and inspect
    // the BFF's response shape. Both a created order and a validation 400 are
    // healthy; a non-JSON body or a 5xx is the incident signature.
    const { failures } = collectFailures(page);
    const product = await findProductByCta(page, ["Add to Cart", "Reserve"]);
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, product.buyLabel);
    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });

    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/checkout(\/session)?$/.test(new URL(r.url()).pathname)),
      submitCheckoutForm(page),
    ]);
    expect(resp.status(), "checkout must not 5xx").toBeLessThan(500);
    expect(
      resp.headers()["content-type"] ?? "",
      "checkout must answer JSON (an HTML body means an edge/gateway error page)",
    ).toMatch(/application\/json/);
    const body = (await resp.json()) as Record<string, unknown>;
    if (resp.ok()) {
      expect(body).toHaveProperty("orderId");
      expect(body).toHaveProperty("checkoutUrl");
    } else {
      expect(typeof body.error, "non-2xx checkout must carry a string error").toBe("string");
    }
    expect(failures, "server/console failures during checkout submit").toEqual([]);
  });
});
