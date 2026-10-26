import { expect, test as base, type Locator, type Page, type Response } from "@playwright/test";

/**
 * A `test` that watches the storefront while a spec drives it (2026-10-26, the
 * WV "can't check out" reports). The checkout refuses a cart through `/api/*`
 * 4xx bodies the shopper may never see, and nothing on the storefront logs them,
 * so these specs record every API refusal and fail on the two kinds that are
 * always bugs:
 *
 *   - any `/api/*` 5xx (the backend broke, not the cart);
 *   - an uncaught page error (a crashed client component leaves a dead button).
 *
 * A 4xx is a legitimate refusal (closed wave, unsupported state), so it is only
 * recorded and attached to the report; specs assert that the refusal is SHOWN
 * with {@link expectRefusalVisible}.
 */

export interface ApiCall {
  method: string;
  path: string;
  status: number;
  /** The `error` string of a JSON refusal body, when there is one. */
  error: string | null;
}

export const test = base.extend<{ apiCalls: ApiCall[] }>({
  apiCalls: [
    async ({ page }, use, testInfo) => {
      const calls: ApiCall[] = [];
      const pageErrors: string[] = [];
      const onResponse = async (res: Response) => {
        const url = new URL(res.url());
        if (!url.pathname.startsWith("/api/")) return;
        let error: string | null = null;
        if (res.status() >= 400) {
          const body = await res.json().catch(() => null);
          error = typeof body?.error === "string" ? body.error : null;
        }
        calls.push({ method: res.request().method(), path: url.pathname, status: res.status(), error });
      };
      page.on("response", onResponse);
      page.on("pageerror", (err) => {
        // WebKit (iPhone, Mac Safari) reports a fetch that a navigation cancelled
        // as "... due to access control checks."; Chromium stays silent. It is
        // the spec's own page.goto aborting an in-flight quote, not a CORS fault.
        if (/due to access control checks\.$/.test(err.message)) return;
        pageErrors.push(err.message);
      });

      await use(calls);

      page.off("response", onResponse);
      if (calls.length > 0) {
        await testInfo.attach("api-calls.json", {
          body: JSON.stringify(calls, null, 2),
          contentType: "application/json",
        });
      }
      const serverErrors = calls.filter((c) => c.status >= 500);
      expect(serverErrors, "storefront /api returned a 5xx during the flow").toEqual([]);
      expect(pageErrors, "uncaught error in the page during the flow").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** The refusal text of the most recent `/api/cart/quote` call, or null when it
 *  succeeded (or none was made). */
export function lastQuoteRefusal(calls: readonly ApiCall[]): string | null {
  const quotes = calls.filter((c) => c.path === "/api/cart/quote");
  return quotes[quotes.length - 1]?.error ?? null;
}

/** Whether any part of `locator` is inside the current viewport. */
export async function isInViewport(page: Page, locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return false;
  return box.y + box.height > 0 && box.y < viewport.height && box.x + box.width > 0 && box.x < viewport.width;
}

/**
 * A checkout refusal must reach the shopper where they are looking: an alert in
 * the viewport, not one rendered off-screen above the field they just changed.
 * This is the bug behind the 10-26 reports: choosing farm pickup on a fall-wave
 * cart rendered "closed on Oct 15. Choose spring." at the top of the page while
 * the shopper sat at the Fulfillment radios, and the submit button greyed out
 * with no reason beside it. On a phone that looks like a dead checkout.
 */
export async function expectRefusalVisible(page: Page, message: string | RegExp): Promise<void> {
  const alert = page.getByRole("alert").filter({ hasText: message }).first();
  await expect(alert, "the refusal is rendered as an alert").toBeVisible();
  await expect
    .poll(() => isInViewport(page, alert), {
      message: "the refusal is on screen where the shopper is, not scrolled out of view",
      timeout: 5_000,
    })
    .toBe(true);
}
