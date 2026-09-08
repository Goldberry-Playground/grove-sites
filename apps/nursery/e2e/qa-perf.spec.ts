import { expect, test } from "@playwright/test";
import { catalogCards, lcpMs, navTiming, readShopGrid } from "./qa-helpers";

/**
 * QA gate — no major slowdowns.
 *
 * This is a SMOKE budget on the deployed target, not the lab gate: the real
 * performance budget (LCP 2000 ms / CLS 0.05 / TBT 200 ms / 540 KB, mobile
 * Slow-4G) is enforced by `lighthouse-ci.yml` + `perf-budget.yml`
 * (perf-budget.config.json). Those measure a *build*; this measures the *live
 * path* — CDN, App Platform, the BFF's round-trip to Odoo, and the image
 * optimizer — on a desktop-class connection, so its thresholds are looser and
 * are meant to catch a regression class, not a millisecond drift:
 *
 *   - a page whose TTFB blows out because the BFF is waiting on a slow Odoo
 *   - a /shop or PDP whose LCP stalls because product images stopped optimizing
 *   - a checkout that hangs on hydration
 *
 * Thresholds are per-route medians of a single run against a warm CDN; a
 * flaky miss retries under CI's `retries: 2`.
 */
const BUDGET = {
  ttfbMs: 1_500, // BFF + Odoo round trip; QA baseline ≈ 300 ms (2026-09-07)
  domContentLoadedMs: 4_000,
  lcpMs: 4_000, // desktop, warm CDN; lab gate is 2 000 on mobile
  htmlTransferBytes: 600 * 1024, // document only, not assets
};

const ROUTES: Array<{ path: string; label: string; lcp: boolean }> = [
  { path: "/", label: "home", lcp: true },
  { path: "/shop", label: "shop grid", lcp: true },
  { path: "/cart", label: "cart", lcp: false },
  { path: "/checkout", label: "checkout", lcp: false },
];

test.describe("qa gate — performance smoke", () => {
  for (const route of ROUTES) {
    test(`${route.label} (${route.path}) loads within the smoke budget`, async ({ page }) => {
      const res = await page.goto(route.path, { waitUntil: "load" });
      expect(res?.status(), `${route.path} status`).toBeLessThan(400);

      const t = await navTiming(page);
      test.info().annotations.push({
        type: "timing",
        description: `${route.path}: ttfb=${t.ttfb}ms dcl=${t.domContentLoaded}ms load=${t.load}ms html=${t.transferBytes}B`,
      });
      expect(t.ttfb, `${route.path} TTFB`).toBeLessThan(BUDGET.ttfbMs);
      expect(t.domContentLoaded, `${route.path} DOMContentLoaded`).toBeLessThan(
        BUDGET.domContentLoadedMs,
      );
      if (t.transferBytes > 0) {
        expect(t.transferBytes, `${route.path} HTML transfer size`).toBeLessThan(
          BUDGET.htmlTransferBytes,
        );
      }
      if (route.lcp) {
        const lcp = await lcpMs(page);
        test.info().annotations.push({ type: "lcp", description: `${route.path}: lcp=${lcp}ms` });
        expect(lcp, `${route.path} should report an LCP candidate`).toBeGreaterThan(0);
        expect(lcp, `${route.path} LCP`).toBeLessThan(BUDGET.lcpMs);
      }
    });
  }

  test("a product-detail page (with hero photo) loads within the smoke budget", async ({
    page,
  }) => {
    const [first] = catalogCards(await readShopGrid(page));
    expect(first, "need a catalog product to time").toBeTruthy();
    await page.goto(first.href, { waitUntil: "load" });

    const t = await navTiming(page);
    const lcp = await lcpMs(page);
    test.info().annotations.push({
      type: "timing",
      description: `${first.href}: ttfb=${t.ttfb}ms dcl=${t.domContentLoaded}ms lcp=${lcp}ms`,
    });
    expect(t.ttfb, "PDP TTFB").toBeLessThan(BUDGET.ttfbMs);
    expect(t.domContentLoaded, "PDP DOMContentLoaded").toBeLessThan(BUDGET.domContentLoadedMs);
    expect(lcp, "PDP should report an LCP candidate").toBeGreaterThan(0);
    expect(lcp, "PDP LCP (hero photo)").toBeLessThan(BUDGET.lcpMs);
  });

  test("product images come back optimized (not the raw Odoo original)", async ({ page }) => {
    // The PDP hero goes through Next's optimizer (`/_next/image?...`), which
    // resizes + re-encodes. A raw 1024px Odoo original served straight through
    // would mean the optimizer is bypassed — the slowdown class GOL-2074 and the
    // GROVE_ASSETS incident were about. Assert the served hero is an optimized
    // request and finishes in a sane time.
    const [first] = catalogCards(await readShopGrid(page));
    expect(first).toBeTruthy();

    const heroReq = page.waitForResponse(
      (r) => r.url().includes("/_next/image") && r.request().resourceType() === "image",
      { timeout: 30_000 },
    );
    await page.goto(first.href);
    const res = await heroReq;
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/^image\//);
    const timing = res.request().timing();
    const totalMs = timing.responseEnd > 0 ? timing.responseEnd : -1;
    test.info().annotations.push({
      type: "image",
      description: `${res.url().slice(0, 120)}… ${totalMs}ms`,
    });
    if (totalMs > 0) expect(totalMs, "optimized hero image response time").toBeLessThan(5_000);
  });
});
