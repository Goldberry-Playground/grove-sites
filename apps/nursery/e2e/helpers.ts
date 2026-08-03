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

/**
 * A buyer email that is unique per test run. Stripe's hosted checkout activates
 * **Link** (link.com) whenever the prefilled email matches a known Link account;
 * once a test email has completed one payment, Stripe registers it as a Link
 * account, so a *reused* address makes the next run land on Link's "Confirm it's
 * you" OTP screen — which replaces the card form and hangs the suite waiting for
 * `#cardNumber` (GOL-1157). A fresh address per run keeps the hosted page on the
 * plain card form. Uniqueness comes from the wall clock + a counter so two calls
 * in the same millisecond still differ. Gmail-style `+tag` addressing keeps every
 * variant routing to the same real inbox.
 */
let _emailSeq = 0;
export function uniqueBuyerEmail(): string {
  const stamp = `${Date.now().toString(36)}${(_emailSeq++).toString(36)}`;
  return `e2e+${stamp}@goldberrygrove.farm`;
}

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
  // The nursery shop grid renders each product-detail link as `a.var-card`
  // (apps/nursery/app/shop/page.tsx), NOT the shared `ProductCard` (.product-card).
  const cards = page.locator('a.var-card[href^="/shop/"]');
  await cards.first().waitFor({ state: "visible", timeout: 15_000 });
  const hrefs = (await cards.evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute("href")),
  )).filter((h): h is string => !!h && /\/shop\/\d+/.test(h));
  return [...new Set(hrefs)];
}

/** The two enabled inline buy CTAs the shop grid can render (see `buyStateFor`):
 *  "Add to Cart" for an in-stock item, "Reserve" for a bareroot preorder. */
export type BuyLabel = "Add to Cart" | "Reserve";

export interface FoundProduct {
  href: string;
  name: string;
  /** Which enabled CTA matched — pass this back to `addCurrentProductToCart`. */
  buyLabel: BuyLabel;
}

/**
 * Walk the shop grid and return the first product whose inline buy button is an
 * *enabled* CTA with one of the given labels, in preference order. Pass a single
 * label ("Add to Cart") when the flow must complete payment; pass a fallback
 * list (`["Add to Cart", "Reserve"]`) for specs that only need *a* product in
 * the cart to reach the checkout form + ship-to-state gate (specs 3/4), so they
 * stay green against Reserve-only QA data. Skips sold-out / coming-soon
 * (disabled) products. Throws a diagnostic if none is found, since that means QA
 * inventory isn't seeded (a GOL-899 / preview blocker, not a checkout
 * regression). The returned `buyLabel` is whichever CTA matched.
 */
export async function findProductByCta(
  page: Page,
  label: BuyLabel | BuyLabel[],
  { limit = 24, skipHref }: { limit?: number; skipHref?: string } = {},
): Promise<FoundProduct> {
  const labels = Array.isArray(label) ? label : [label];
  const hrefs = (await collectProductHrefs(page)).filter((h) => h !== skipHref);
  for (const href of hrefs.slice(0, limit)) {
    await page.goto(href);
    const anchor = page.locator("[data-add-to-cart-anchor]");
    for (const buyLabel of labels) {
      const cta = anchor.getByRole("button", { name: buyLabel, exact: true });
      if ((await cta.count()) > 0 && (await cta.first().isEnabled())) {
        const name = (await page.locator("h1").first().innerText()).trim();
        return { href, name, buyLabel };
      }
    }
  }
  throw new Error(
    `No product with an enabled ${labels.map((l) => `"${l}"`).join(" / ")} buy ` +
      `button in the first ${limit} shop ` +
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
  label: BuyLabel = "Add to Cart",
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
  // Scope every field lookup to the checkout form itself: the page also renders
  // a newsletter capture form whose email input carries an "Email" label, so an
  // unscoped getByLabel("Email") is a strict-mode collision (GOL-1149).
  const form = page.locator("form.grove-checkout__grid");
  await form.getByLabel("Full name").fill(input.name ?? "E2E Test Buyer");
  // Default to a per-run unique address so Stripe's Link never recognises it and
  // hijacks the hosted page with an OTP challenge (GOL-1157). Callers can still
  // pin an explicit email.
  await form.getByLabel("Email").fill(input.email ?? uniqueBuyerEmail());
  await form.getByLabel("Street").fill(input.street ?? "123 Orchard Ln");
  await form.getByLabel("City").fill(input.city ?? "Summersville");
  if (input.state) {
    // Anchor to the start of the label: an unanchored "State" also matches the
    // Country select, whose selected option "United States" contains "State".
    await form.getByLabel(/^State\b/).selectOption(input.state);
  }
  await form.getByLabel("ZIP").fill(input.zip ?? "26651");
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
 * `checkout.stripe.com` page, whose DOM is owned by Stripe. Selectors validated
 * against a real test session (GOL-1149): the hosted page renders a
 * payment-method accordion whose card fields (`#cardNumber` etc.) are NOT in the
 * DOM until the "card" item is selected, so we must select it first — the radio
 * is visually hidden, hence the forced check. There is no `#email` field here
 * (email is captured on our own checkout form; Stripe collects only phone). Kept
 * tolerant: each field is filled only if present.
 */
export async function fillStripeCheckoutAndPay(
  page: Page,
  cardNumber: string,
): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

  // Escape Stripe **Link**: if the prefilled email is a known Link account the
  // hosted page opens on a "Confirm it's you" OTP screen that hides the card
  // form. A unique buyer email (see `uniqueBuyerEmail`) normally avoids this, but
  // Stripe can register an address mid-suite, so defensively click "Pay without
  // Link" whenever it is offered to fall back to the manual card form (GOL-1157).
  const payWithoutLink = page.getByRole("button", { name: /pay without link/i });
  if (await payWithoutLink.count()) {
    await payWithoutLink.first().click().catch(() => {});
  }

  // Select the card payment method so its fields render (validated GOL-1149).
  const cardRadio = page.locator("#payment-method-accordion-item-title-card");
  if (await cardRadio.count()) await cardRadio.check({ force: true });
  await page.locator("#cardNumber").waitFor({ state: "visible", timeout: 15_000 });

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
  // This session enables Stripe phone-number collection; the required phone
  // field otherwise blocks Pay (validated GOL-1149).
  await fillIfPresent("#phoneNumber", "2015550123");

  const submitById = page.getByTestId("hosted-payment-submit-button");
  if (await submitById.count()) await submitById.click();
  else await page.getByRole("button", { name: /pay/i }).first().click();
}

/**
 * Assert the cart is empty. Callers land here on a `/checkout/success[/id]` page,
 * where the cart is cleared *client-side after hydration* — `CheckoutSuccessEffects`
 * flips `clear()` only once `hydrated` is true, which then persists `[]` to
 * localStorage. The "Payment received" / "Order Confirmed" heading paints from
 * SSR *before* that hydration, so navigating straight to /cart races the persist
 * and can read a stale cart (GOL-1157). Gate on the header cart badge first: wait
 * until no cart link still advertises "N items in cart", which only happens once
 * the clear has hydrated and written through. Then confirm on /cart itself.
 */
export async function expectCartEmpty(page: Page): Promise<void> {
  await expect(page.getByRole("link", { name: /items in cart/ })).toHaveCount(0, {
    timeout: 15_000,
  });
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
}

/** Assert the cart still has at least one line by visiting /cart. */
export async function expectCartNotEmpty(page: Page): Promise<void> {
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toHaveCount(0);
  await expect(page.locator(".grove-cart__line").first()).toBeVisible();
}
