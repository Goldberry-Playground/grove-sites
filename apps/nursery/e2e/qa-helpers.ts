import { expect, type Page, type Response } from "@playwright/test";

/**
 * QA release-gate helpers (2026-09-07 QA deploy → prod promotion).
 *
 * These back the `qa-*.spec.ts` gate specs that run against the deployed QA
 * nursery (`E2E_NURSERY_BASE_URL=https://nursery.qa.gatheringatthegrove.com`)
 * before a build is promoted to prod. They complement — never replace — the
 * GOL-1074 checkout acceptance helpers in `./helpers.ts`; import from there for
 * anything cart/checkout/Stripe related.
 *
 * Selector policy is the README's: role/text first, stable component class
 * second. Source of truth for the hooks used here:
 *   - photos:      apps/nursery/app/product-image.tsx  (`img.product-photo` vs
 *                  the branded `div.product-ph` "Photo coming soon" fallback)
 *   - shop grid:   apps/nursery/app/shop/page.tsx      (`a.var-card`, stock line
 *                  "In stock" / "Sold out" / "Coming soon")
 *   - buy box:     apps/nursery/lib/buy-state.ts        (CTA labels)
 *   - promo input: packages/grove-ui/src/CheckoutPage/index.tsx
 *                  (`#grove-checkout-promo`, label "Promo code")
 */

/** The two Playwright test-inventory fixtures seeded on QA by
 *  grove-odoo-modules `scripts/seed_e2e_test_inventory.py` (GOL-1148/1154).
 *  They deliberately carry NO photo, so photo-accuracy assertions must skip
 *  them — they are runner fixtures, not catalog. */
export const E2E_FIXTURE_NAME_RE = /^AAA QA E2E /;

/**
 * Odoo serves its own gray "no image" placeholder at HTTP 200 for imageless
 * records (a 512×512 PNG, 7,322 bytes on QA/prod as of 2026-09-07), so a 200
 * alone does not prove a real photo. Real product photos on this catalog are
 * WebP/JPEG at 100 KB+. Anything under this many bytes is treated as "not a
 * photo". Kept generous (not 7,323) so a genuinely tiny real image still passes
 * while the placeholder — and a truncated/broken fetch — cannot.
 */
export const MIN_REAL_PHOTO_BYTES = 20 * 1024;

/**
 * Collect server-side failures while a page is exercised: any 5xx response the
 * page itself triggered (documents, chunks, API calls, images) plus console
 * `error` entries. Attach BEFORE navigating, read `.failures` after.
 *
 * Why both: a backend 500 on `/api/cart` or `/grove/api/v1/*` surfaces as a
 * 5xx response, but a BFF that swallows an upstream failure surfaces only as a
 * console error. The gate wants "no major errors" on either side.
 */
export function collectFailures(page: Page): {
  failures: string[];
  responses5xx: Response[];
} {
  const failures: string[] = [];
  const responses5xx: Response[] = [];
  page.on("response", (r) => {
    if (r.status() >= 500) {
      responses5xx.push(r);
      failures.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      const text = m.text();
      // Next's hydration/dev-only noise is not a backend error; everything
      // else (failed fetch, uncaught exception, 5xx logged by the app) is.
      if (/hydrat|Download the React DevTools/i.test(text)) return;
      // Chromium logs "Failed to load resource: the server responded with a
      // status of 4xx" for EVERY 4xx fetch, including the validation / business
      // 400s the checkout is designed to return (off-list state, promo on a
      // deposit cart). Those are healthy responses, asserted on their own by
      // the specs; only a 5xx resource failure is a backend error here.
      if (/Failed to load resource: the server responded with a status of 4\d\d/.test(text)) return;
      failures.push(`console.error: ${text.slice(0, 300)}`);
    }
  });
  page.on("pageerror", (e) => failures.push(`pageerror: ${e.message.slice(0, 300)}`));
  return { failures, responses5xx };
}

export interface ShopCard {
  href: string;
  name: string;
  /** Stock line as rendered on the card: "In stock" | "Sold out" | "Coming soon". */
  stock: string;
}

/**
 * Read the whole `/shop` grid once: every product card's detail href, name and
 * rendered stock line. Cheaper than walking each PDP when a spec only needs to
 * pick cards by their grid state (photo checks, sold-out vs in-stock CTA
 * arbitration).
 */
export async function readShopGrid(page: Page): Promise<ShopCard[]> {
  await page.goto("/shop");
  // `.var-card` is the card container; its detail link is `a.var-card__link`
  // (GOL-2178 / #719 split them so the restock capture sits outside the link).
  const cards = page.locator(".var-card", { has: page.locator('a.var-card__link[href^="/shop/"]') });
  await cards.first().waitFor({ state: "visible", timeout: 15_000 });
  const raw = await cards.evaluateAll((els) =>
    els.map((el) => {
      const a = el.querySelector('a.var-card__link[href^="/shop/"]') as HTMLAnchorElement | null;
      const name = el.querySelector(".var-name")?.textContent?.trim() ?? "";
      const text = el.textContent ?? "";
      const stock = /Coming soon/.test(text)
        ? "Coming soon"
        : /Sold out/.test(text)
          ? "Sold out"
          : /In stock/.test(text)
            ? "In stock"
            : "";
      return { href: a?.getAttribute("href") ?? "", name, stock };
    }),
  );
  const seen = new Set<string>();
  return raw.filter((c) => /\/shop\/\d+/.test(c.href) && !seen.has(c.href) && seen.add(c.href));
}

/** Catalog cards only — the E2E runner fixtures excluded. */
export function catalogCards(cards: ShopCard[]): ShopCard[] {
  return cards.filter((c) => !E2E_FIXTURE_NAME_RE.test(c.name));
}

/**
 * Fetch an image URL through the test's request context and return its byte
 * size + content type. Used to tell a real photo from Odoo's HTTP-200 gray
 * placeholder (see MIN_REAL_PHOTO_BYTES) without depending on `onError`, which
 * the placeholder never triggers.
 */
export async function probeImage(
  page: Page,
  url: string,
): Promise<{ status: number; bytes: number; contentType: string }> {
  const res = await page.request.get(url, { timeout: 30_000 });
  const body = await res.body();
  return {
    status: res.status(),
    bytes: body.byteLength,
    contentType: res.headers()["content-type"] ?? "",
  };
}

/**
 * The rendered hero `<img>` on a product-detail page, or `null` when the page
 * fell back to the branded "Photo coming soon" placeholder. Waits for the photo
 * to actually decode (naturalWidth > 0) so a broken src can't pass as present.
 */
export async function heroPhoto(
  page: Page,
): Promise<{ src: string; alt: string; naturalWidth: number } | null> {
  const photo = page.locator("img.product-photo").first();
  const placeholder = page.locator(".product-ph").first();
  await Promise.race([
    photo.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {}),
    placeholder.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {}),
  ]);
  if ((await photo.count()) === 0) return null;
  await expect
    .poll(async () => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
      timeout: 20_000,
      message: "hero photo should decode (naturalWidth > 0)",
    })
    .toBeGreaterThan(0);
  return photo.evaluate((el) => {
    const img = el as HTMLImageElement;
    return { src: img.currentSrc || img.src, alt: img.alt, naturalWidth: img.naturalWidth };
  });
}

/** Type a promo code into the checkout form's "Promo code" field (GOL-2088).
 *  The input upper-cases on change, so the value is asserted case-insensitively. */
export async function fillPromoCode(page: Page, code: string): Promise<void> {
  const form = page.locator("form.grove-checkout__grid");
  const input = form.getByLabel("Promo code", { exact: true });
  await expect(input, "promo input should be offered on the nursery checkout").toBeVisible();
  await input.fill(code);
  await expect(input).toHaveValue(new RegExp(`^${code}$`, "i"));
}

/**
 * Navigation timing for the current document, in ms. `ttfb` is
 * responseStart, `domContentLoaded`/`load` are the classic event ends. Read
 * from the Navigation Timing L2 entry so it reflects the real network path
 * (CDN + App Platform + BFF), not a synthetic stopwatch.
 */
export async function navTiming(page: Page): Promise<{
  ttfb: number;
  domContentLoaded: number;
  load: number;
  transferBytes: number;
}> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!nav) return { ttfb: -1, domContentLoaded: -1, load: -1, transferBytes: -1 };
    return {
      ttfb: Math.round(nav.responseStart - nav.startTime),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      load: Math.round(nav.loadEventEnd - nav.startTime),
      transferBytes: nav.transferSize,
    };
  });
}

/**
 * Largest Contentful Paint for the current document, in ms, or -1 when the
 * browser reported none within `settleMs`. LCP is buffered, so observing after
 * load still yields the final candidate.
 */
export async function lcpMs(page: Page, settleMs = 3_000): Promise<number> {
  return page.evaluate(
    (settle) =>
      new Promise<number>((resolve) => {
        let last = -1;
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) last = Math.round(e.startTime);
        });
        try {
          po.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          resolve(-1);
          return;
        }
        setTimeout(() => {
          po.disconnect();
          resolve(last);
        }, settle);
      }),
    settleMs,
  );
}
