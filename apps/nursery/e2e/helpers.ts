import { expect, type Page } from "@playwright/test";

/**
 * Shared page-object helpers for the nursery checkout acceptance suite
 * (GOL-1074, Ada). These wrap the storefront flow the six specs share —
 * finding a buyable product, adding it to the cart, filling the checkout form,
 * creating a session, and driving the Stripe hosted page — behind role/text
 * selectors sourced from the real components:
 *
 *   - buy box:    packages/grove-ui/src/AddToCartButton/index.tsx
 *   - cart:       packages/grove-ui/src/CartPage/index.tsx
 *   - form:       packages/grove-ui/src/CheckoutPage/index.tsx
 *   - review:     packages/grove-ui/src/CheckoutReview/index.tsx
 *   - success:    packages/checkout/src/components/create{Checkout,Order}SuccessPage.tsx
 *
 * Selector policy (README): prefer role/text; fall back to the stable component
 * BEM class only where a role is genuinely ambiguous (the form renders two
 * identically-labelled submit buttons — banner + summary — so we target the
 * summary submit by `.grove-checkout__submit`).
 */

/** Stripe test cards (test mode only). */
export const STRIPE_TEST_CARD_OK = "4242 4242 4242 4242";
export const STRIPE_TEST_CARD_DECLINE = "4000 0000 0000 0002";

/** Format a minor-unit-free amount the SAME way every UI surface does, so spec
 *  assertions are byte-identical to what the buyer sees. Mirrors `formatPrice`
 *  in the UI components (`toLocaleString("en-US", { style: "currency" })`). */
export function usd(amount: number, currency = "USD"): string {
  return amount.toLocaleString("en-US", { style: "currency", currency });
}

/** The itemized charged-today line as it comes back from `/api/checkout/session`
 *  (mirror of `CheckoutReviewItemizedLine` in @grove/ui-kit). */
export interface SessionLineItem {
  name: string;
  kind: "goods" | "deposit" | "shipping" | "tax";
  unitAmount: number;
  quantity: number;
}

/** The subset of the CheckoutSession the specs assert against. */
export interface CheckoutSessionBody {
  orderId: number;
  accessToken: string;
  checkoutUrl: string;
  amountDueToday: number;
  amountTotal: number;
  hasPreorder: boolean;
  currency?: string;
  lineItems?: SessionLineItem[];
}

/** Every `/shop/<id>` product-detail href on the shop grid, de-duplicated. */
export async function collectProductHrefs(page: Page): Promise<string[]> {
  await page.goto("/shop");
  const cards = page.locator("a.product-card");
  await cards.first().waitFor({ state: "visible", timeout: 15_000 });
  const hrefs = (await cards.evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute("href")),
  )).filter((h): h is string => !!h && /\/shop\/\d+/.test(h));
  return [...new Set(hrefs)];
}

export interface FoundProduct {
  href: string;
  name: string;
}

/**
 * Walk the shop grid and return the first product whose inline buy button is an
 * *enabled* CTA with the given label — "Add to Cart" for an in-stock item,
 * "Reserve" for a bareroot preorder (see `buyStateFor`). Skips sold-out /
 * coming-soon (disabled) products. Throws a diagnostic if none is found, since
 * that means QA inventory isn't seeded (a GOL-899 / preview blocker, not a
 * checkout regression).
 */
export async function findProductByCta(
  page: Page,
  label: "Add to Cart" | "Reserve",
  { limit = 24, skipHref }: { limit?: number; skipHref?: string } = {},
): Promise<FoundProduct> {
  const hrefs = (await collectProductHrefs(page)).filter((h) => h !== skipHref);
  for (const href of hrefs.slice(0, limit)) {
    await page.goto(href);
    const cta = page
      .locator("[data-add-to-cart-anchor]")
      .getByRole("button", { name: label, exact: true });
    if ((await cta.count()) > 0 && (await cta.first().isEnabled())) {
      const name = (await page.locator("h1").first().innerText()).trim();
      return { href, name };
    }
  }
  throw new Error(
    `No product with an enabled "${label}" buy button in the first ${limit} shop ` +
      `items — is QA inventory seeded? (GOL-899 / preview blockers, see e2e/README.md)`,
  );
}

/**
 * On a product-detail page, set the quantity (via the typed input, not the
 * steppers) and click the buy CTA. Waits for the "Added!" flash so we know the
 * cart mutation actually fired before moving on.
 */
export async function addCurrentProductToCart(
  page: Page,
  quantity = 1,
  label: "Add to Cart" | "Reserve" = "Add to Cart",
): Promise<void> {
  const anchor = page.locator("[data-add-to-cart-anchor]");
  if (quantity !== 1) {
    const qty = anchor.getByLabel("Quantity", { exact: true });
    await qty.fill(String(quantity));
    await qty.blur();
  }
  await anchor.getByRole("button", { name: label, exact: true }).click();
  await expect(
    anchor.getByRole("button", { name: "Added!", exact: true }),
  ).toBeVisible({ timeout: 5_000 });
}

export interface CheckoutFormInput {
  /** 2-letter state code to select (e.g. "WV"). Omit to leave the select unset. */
  state?: string;
  name?: string;
  email?: string;
  street?: string;
  city?: string;
  zip?: string;
}

/**
 * Fill the checkout contact + shipping form. State/Country are `<select>`s
 * (GOL-1055) so state is chosen by option value (the 2-letter code). Pass no
 * `state` to leave the required select at its placeholder (the guard case).
 */
export async function fillCheckoutForm(
  page: Page,
  input: CheckoutFormInput = {},
): Promise<void> {
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await page.getByLabel("Full name").fill(input.name ?? "E2E Test Buyer");
  await page.getByLabel("Email").fill(input.email ?? "e2e@goldberrygrove.farm");
  await page.getByLabel("Street", { exact: true }).fill(input.street ?? "123 Orchard Ln");
  await page.getByLabel("City").fill(input.city ?? "Summersville");
  if (input.state) {
    await page.getByLabel("State").selectOption(input.state);
  }
  await page.getByLabel("ZIP").fill(input.zip ?? "26651");
  // Country defaults to US (only selectable option); no action needed.
}

/** Click the summary submit ("Continue to payment →"). Two buttons carry that
 *  label (banner CTA is `type=button`, summary is `type=submit`); target the
 *  summary submit unambiguously. */
export async function submitCheckoutForm(page: Page): Promise<void> {
  await page.locator(".grove-checkout__submit").click();
}

/**
 * Submit the checkout form and capture the `/api/checkout/session` response.
 * Returns the HTTP status and (on 2xx) the parsed session body.
 */
export async function submitAndCaptureSession(page: Page): Promise<{
  status: number;
  body: CheckoutSessionBody | null;
}> {
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/checkout/session")),
    submitCheckoutForm(page),
  ]);
  const body = resp.ok() ? ((await resp.json()) as CheckoutSessionBody) : null;
  return { status: resp.status(), body };
}

/** Assert the review ("Review & pay") page is showing. */
export async function expectOnReview(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Review & pay" })).toBeVisible();
}

/** Click "Pay … with card →" on the review page to hand off to Stripe. */
export async function payAtReview(page: Page): Promise<void> {
  await page.locator(".grove-review__pay").click();
}

/**
 * Fill Stripe's hosted checkout page and submit. This drives the external
 * `checkout.stripe.com` page, whose DOM is owned by Stripe — the selectors here
 * are best-effort and are the single most likely thing to need a touch-up on
 * the first real (GOL-899-unblocked) run. Kept tolerant: each field is filled
 * only if present.
 */
export async function fillStripeCheckoutAndPay(
  page: Page,
  cardNumber: string,
): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  const fillIfPresent = async (selector: string, value: string) => {
    const el = page.locator(selector);
    if (await el.count()) await el.first().fill(value);
  };
  await fillIfPresent("#email", "e2e@goldberrygrove.farm");
  await fillIfPresent("#cardNumber", cardNumber);
  await fillIfPresent("#cardExpiry", "12 / 34");
  await fillIfPresent("#cardCvc", "123");
  await fillIfPresent("#billingName", "E2E Test Buyer");
  await fillIfPresent("#billingPostalCode", "26651");

  const submitById = page.getByTestId("hosted-payment-submit-button");
  if (await submitById.count()) await submitById.click();
  else await page.getByRole("button", { name: /pay/i }).first().click();
}

/** Assert the cart is empty by visiting /cart. */
export async function expectCartEmpty(page: Page): Promise<void> {
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
}

/** Assert the cart still has at least one line by visiting /cart. */
export async function expectCartNotEmpty(page: Page): Promise<void> {
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toHaveCount(0);
  await expect(page.locator(".grove-cart__line").first()).toBeVisible();
}
