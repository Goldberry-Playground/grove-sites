import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";

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
  /** `discount` = a promo reward line (negative amount; GOL-2088 / #700). */
  kind: "goods" | "deposit" | "shipping" | "tax" | "discount";
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
  // The nursery shop grid renders each product as a `.var-card` container whose
  // detail link is `a.var-card__link` (apps/nursery/app/shop/page.tsx) — NOT the
  // shared `ProductCard` (.product-card). GOL-2178 (#719) moved the card from a
  // single `a.var-card` to a `div.var-card > a.var-card__link` so the restock
  // capture can sit outside the link; the selector must follow the link.
  const cards = page.locator('.var-card a.var-card__link[href^="/shop/"]');
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
  {
    limit = 24,
    skipHref,
    nameMatch,
  }: {
    limit?: number;
    skipHref?: string;
    /** When set, only products whose grid card name matches are considered
     *  (e.g. /bareroot/i to avoid the pickup-only potted fixture on a ship flow). */
    nameMatch?: RegExp;
  } = {},
): Promise<FoundProduct> {
  const labels = Array.isArray(label) ? label : [label];
  let hrefs = (await collectProductHrefs(page)).filter((h) => h !== skipHref);
  if (nameMatch) {
    // Card names live next to the links on the grid we just loaded.
    const named = await page
      .locator(".var-card")
      .evaluateAll((els) =>
        els.map((el) => ({
          href: (el.querySelector('a.var-card__link[href^="/shop/"]') as HTMLAnchorElement | null)?.getAttribute("href") ?? "",
          name: el.querySelector(".var-name")?.textContent?.trim() ?? "",
        })),
      );
    const keep = new Set(named.filter((c) => nameMatch.test(c.name)).map((c) => c.href));
    hrefs = hrefs.filter((h) => keep.has(h));
  }
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
  /** The server's `error` string on a non-2xx, so a failing assertion can say WHY. */
  errorBody: string | null;
}> {
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/checkout/session")),
    submitCheckoutForm(page),
  ]);
  if (resp.ok()) return { status: resp.status(), body: (await resp.json()) as CheckoutSessionBody, errorBody: null };
  let errorBody: string | null = null;
  try {
    const raw = await resp.text();
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };
      errorBody = typeof parsed.error === "string" ? parsed.error : raw.slice(0, 300);
    } catch {
      errorBody = raw.slice(0, 300);
    }
  } catch {
    errorBody = null;
  }
  return { status: resp.status(), body: null, errorBody };
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
  // Stripe has shipped the accordion under more than one DOM: the title-id
  // form (GOL-1149) and, on the 2026-09-08 deposit sessions, a plain
  // `radio "Card"` with no such id. Try the id, then the accessible radio, and
  // only then wait for the card number field — never rely on one shape.
  const cardRadio = page.locator("#payment-method-accordion-item-title-card");
  if (await cardRadio.count()) await cardRadio.check({ force: true });

  // Stripe has shipped the hosted page under two DOMs:
  //   (legacy, GOL-1149) the card fields (#cardNumber …) live in the main
  //   frame once the accordion title is checked;
  //   (2026-09, seen on QA deposit sessions) the accordion rows are custom
  //   controls whose hidden radio ignores check(); each row carries a
  //   "Pay with card" / "Pay with Cash App" … button that is the real
  //   selector, and the card inputs then render as accessible textboxes —
  //   possibly inside a Stripe iframe, which a main-frame locator can't see.
  // Resolve the card-number field in ANY frame, clicking the new-layout
  // button first when the legacy field isn't already there.
  type Scope = Page | FrameLocator;
  const findCardNumber = async (): Promise<{ scope: Scope; loc: Locator } | null> => {
    const main = page.locator("#cardNumber").or(page.getByRole("textbox", { name: /card number/i })).first();
    if (await main.isVisible().catch(() => false)) return { scope: page, loc: main };
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      const inFrame = frame.locator("#cardNumber").or(frame.getByRole("textbox", { name: /card number/i })).first();
      if (await inFrame.isVisible().catch(() => false)) {
        const url = frame.url();
        const fl = page.frameLocator(`iframe[src="${url}"]`);
        return { scope: fl, loc: fl.locator("#cardNumber").or(fl.getByRole("textbox", { name: /card number/i })).first() };
      }
    }
    return null;
  };
  let card = await findCardNumber();
  if (!card) {
    // Verified headless on 2026-09-08 (QA deposit session, Playwright probes):
    // the accordion row is covered by an overlay
    // `<button data-testid="card-accordion-item-button" aria-label="Pay with card"
    // class="AccordionButton … expandedClickArea">` that intercepts every
    // pointer event on the row, yet is itself visually hidden with a box that
    // sits outside the viewport — so locator.click() on the label is refused
    // ("subtree intercepts pointer events") and locator.click() on the button
    // is refused too ("outside of the viewport"), force or not. What works is
    // what a person does: a raw mouse click at the VISIBLE "Card" label's
    // coordinates, which the overlay receives and expands the row; the card
    // fields then render in the main frame as accessible textboxes.
    // The list renders a few seconds after the page URL lands, so wait for the
    // label and keep re-clicking inside the poll — a click fired before the
    // list exists selects nothing. Fallback: a synthetic click event on the
    // overlay button (no hit-testing involved).
    const cardLabel = page.getByText("Card", { exact: true }).filter({ visible: true }).first();
    await cardLabel.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    const selectCard = async () => {
      const box = await cardLabel.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
        return;
      }
      const overlay = page.getByTestId("card-accordion-item-button").first();
      if (await overlay.count()) await overlay.dispatchEvent("click").catch(() => {});
    };
    await selectCard();
    await expect
      .poll(
        async () => {
          card = await findCardNumber();
          if (!card) await selectCard();
          return card ? "found" : "missing";
        },
        {
          timeout: 20_000,
          intervals: [500, 1_000, 2_000],
          message: "card number field should render after selecting the Card payment method",
        },
      )
      .toBe("found");
  }
  const scope: Scope = card!.scope;

  const fillIfPresent = async (selector: string, value: string) => {
    const el = page.locator(selector);
    if (await el.count()) await el.first().fill(value);
  };
  /** Fill by id when present, else by accessible textbox name, in the frame
   *  the card field lives in. */
  const fillField = async (selector: string, name: RegExp, value: string) => {
    const byId = scope.locator(selector);
    if (await byId.count()) return byId.first().fill(value);
    const byRole = scope.getByRole("textbox", { name });
    if (await byRole.count()) await byRole.first().fill(value);
  };
  await fillIfPresent("#email", "e2e@goldberrygrove.farm");
  await fillField("#cardNumber", /card number/i, cardNumber);
  await fillField("#cardExpiry", /expir/i, "12 / 34");
  await fillField("#cardCvc", /cvc|security code/i, "123");
  await fillField("#billingName", /name on card|cardholder/i, "E2E Test Buyer");
  await fillField("#billingPostalCode", /^zip$|postal/i, "26651");
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
