// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { CheckoutPage } from "./index";

// GOL-1314: the presentational kit must never bake a brand-specific claim in as
// a default. The trust strip used to default to the nursery set (including the
// live-plant "arrive-alive guarantee"), and the pickup fieldset hardcoded
// "our WV nursery" / "live trees … planting window". Any consumer that dropped
// the prop — a new surface, a hub reuse, a refactor — would then silently
// advertise a promise false for its products. These tests pin the safe
// defaults: no strip and no product-specific claim unless a brand opts in.

const items = [
  { variantId: 1, templateId: 1, name: "Test Item", price: 10, quantity: 1 },
];

describe("<CheckoutPage /> kit — truthful-by-default (GOL-1314)", () => {
  it("renders no trust strip when trustItems is omitted", () => {
    const { container } = render(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} />,
    );
    expect(container.querySelector(".grove-checkout__trust")).toBeNull();
    expect(
      screen.queryByText(/arrive-alive/i),
      "the kit must not default the nursery live-plant guarantee",
    ).toBeNull();
  });

  it("makes no live-tree / named-location pickup claim by default", () => {
    render(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {}}
        allowPickup
      />,
    );
    // Pickup is offered (brand-neutral copy) but with no false product claim.
    expect(screen.getByText(/local pickup/i)).toBeTruthy();
    expect(screen.queryByText(/live tree/i)).toBeNull();
    expect(screen.queryByText(/nursery/i)).toBeNull();
    expect(screen.queryByText(/west virginia/i)).toBeNull();
  });

  it("the ship-states note makes no live-tree claim by default", () => {
    render(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {}}
        shipStates={[
          { code: "WV", name: "West Virginia" },
          { code: "OH", name: "Ohio" },
        ]}
      />,
    );
    expect(screen.getByText(/we currently ship to 2 states/i)).toBeTruthy();
    expect(screen.queryByText(/live trees/i)).toBeNull();
  });

  it("renders brand-supplied pickup copy verbatim when provided", () => {
    render(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {}}
        allowPickup
        pickupCopy={{
          shipLabel: "Ship to me",
          pickupLabel: "Farm pickup — collect at our WV nursery ($0 shipping)",
          pickupNote: "Pick up at our West Virginia nursery.",
          shipNote: "We ship live trees to your address.",
        }}
      />,
    );
    expect(
      screen.getByText(/collect at our WV nursery/i),
    ).toBeTruthy();
    // The ship note is shown by default (ship is the default fulfillment).
    expect(screen.getByText(/we ship live trees/i)).toBeTruthy();
  });
});

// GOL-1823: the form's order summary omitted shipping entirely and labelled its
// number "Total", so the figure the buyer saw here read *below* the amount the
// server actually charges once the box engine prices shipping — the pay-review
// and Stripe pages then jumped up by the shipping fee. The summary must (a) list
// shipping as a line and (b) not present its pre-shipping figure as the final
// "Total". These pin that so the divergence can't silently return.
//
// Rendered via renderToStaticMarkup (not testing-library) on purpose: this is a
// pure presentational assertion over the ship-fulfillment default state, so it
// needs no DOM/act and stays green independent of the React-act test harness.
describe("<CheckoutPage /> summary — shipping honesty (GOL-1823)", () => {
  it("lists shipping + tax lines and labels the figure 'Subtotal' for a ship order", () => {
    const html = renderToStaticMarkup(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} />,
    );
    // Shipping is a visible line — priced at the payment step, not omitted.
    expect(html).toContain("<dt>Shipping</dt>");
    expect(html).toContain("<dt>Sales tax</dt>");
    expect(html).toContain("On the next step");
    // The pre-shipping figure must not masquerade as the final total, and the
    // form never estimates tax itself (Josh, 2026-09-22).
    expect(html).toContain("<dt>Subtotal</dt>");
    expect(html).not.toContain("Tax (estimated)");
    expect(html).not.toMatch(/<dt>Total<\/dt>/);
    // The banner headline number is flagged as pre-shipping, not a hard total.
    expect(html).toContain("before shipping &amp; tax");
    // And the buyer is told the full total is confirmed before any charge.
    expect(html).toMatch(/confirm the full total before you.+re charged/);
  });

  it("keeps the shipping line when pickup is offered (ship is the default)", () => {
    const html = renderToStaticMarkup(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {}}
        allowPickup
      />,
    );
    // Even with pickup available, the form opens on ship — the buggy path — so
    // the shipping line and estimated-total caveat must still be present.
    expect(html).toContain("<dt>Shipping</dt>");
    expect(html).toContain("On the next step");
    expect(html).toContain("<dt>Subtotal</dt>");
  });
});

// GOL-2588: a cart holding a farm-pickup-only line cannot be shipped at all —
// grove_headless rejects such a SHIP order with a plain 400 (GOL-2587 P1). The
// form therefore locks fulfillment to pickup instead of collecting a whole address
// and then refusing it. The ship option is not rendered at all (a disabled radio
// is a dead control), so `forcePickupNote` is the ONLY thing telling the buyer
// where shipping went — which makes it load-bearing, not decoration, and gives
// screen readers, grayscale screens and colour-blind readers the same answer.
//
// renderToStaticMarkup for the same reason as the block above: pure presentational
// assertions, independent of the React-act harness. React emits boolean attributes
// before `value`, so the ordered patterns below match that, not the JSX order.
describe("<CheckoutPage /> kit — pickup-only cart locks fulfillment (GOL-2588)", () => {
  const lockedProps = {
    items,
    subtotal: 10,
    onPlaceOrder: () => {},
    allowPickup: true,
    forcePickup: true,
    forcePickupNote: "Your cart has a tree we only release at the farm.",
  } as const;

  it("offers pickup alone and selected — no dead ship control", () => {
    const html = renderToStaticMarkup(<CheckoutPage {...lockedProps} />);
    expect(html).not.toContain('value="ship"');
    expect(html).toMatch(/checked=""[^>]*value="pickup"/);
    // Not disabled: the one remaining option must stay focusable so the bound
    // note is announced in forms mode.
    expect(html).not.toContain("disabled");
  });

  it("binds the reason to the radiogroup so it is announced, not just readable", () => {
    const html = renderToStaticMarkup(<CheckoutPage {...lockedProps} />);
    const described = /aria-describedby="([^"]+)"/.exec(html);
    expect(described, "locked group must describe itself").not.toBeNull();
    expect(html).toContain(`id="${described![1]}"`);
  });

  it("does not describe the group when the buyer still has a real choice", () => {
    const html = renderToStaticMarkup(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} allowPickup />,
    );
    expect(html).not.toContain("aria-describedby");
  });

  it("states the reason in words instead of the ship/pickup note", () => {
    const html = renderToStaticMarkup(<CheckoutPage {...lockedProps} />);
    expect(html).toContain("we only release at the farm");
    expect(html).not.toContain("ship your order to the address above");
  });

  it("collapses the ship-to address and prices shipping free, like a chosen pickup", () => {
    const html = renderToStaticMarkup(<CheckoutPage {...lockedProps} />);
    expect(html).not.toContain("Shipping Address");
    expect(html).toContain("<dd>Free (pickup)</dd>");
    expect(html).not.toContain("before shipping &amp; tax");
  });

  it("falls back to the pickup note when no reason is supplied", () => {
    const html = renderToStaticMarkup(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {}}
        allowPickup
        forcePickup
        pickupCopy={{
          shipLabel: "Ship to me",
          pickupLabel: "Farm pickup",
          pickupNote: "Pick up at our nursery.",
          shipNote: "We ship to your address.",
        }}
      />,
    );
    expect(html).toContain("Pick up at our nursery.");
    expect(html).not.toContain("We ship to your address.");
  });

  it("is inert without allowPickup (a brand with no pickup point has nothing to lock to)", () => {
    const html = renderToStaticMarkup(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} forcePickup />,
    );
    expect(html).toContain("Shipping Address");
    expect(html).not.toContain("<dd>Free (pickup)</dd>");
  });

  it("leaves an ordinary shippable cart on the ship default, with both options live", () => {
    const html = renderToStaticMarkup(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} allowPickup />,
    );
    expect(html).toMatch(/checked=""[^>]*value="ship"/);
    expect(html).toContain('value="pickup"');
    expect(html).not.toContain("disabled");
    expect(html).toContain("Shipping Address");
  });
});

describe("<CheckoutPage /> contact — phone is required (2026-09-30)", () => {
  it("marks the phone field required, like name and email", () => {
    render(<CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} />);
    const phone = screen.getByLabelText(/phone/i) as HTMLInputElement;
    expect(phone.type).toBe("tel");
    expect(phone.required).toBe(true);
  });

  it("refuses a whitespace-only phone without placing the order", async () => {
    let placed = false;
    const { container } = render(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => { placed = true; }} />,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "   " } });
    fireEvent.submit(form);
    expect(placed).toBe(false);
    expect(await screen.findByText(/add a phone number/i)).toBeTruthy();
  });

  // GOL-2789: the alert renders in the summary rail, ~300px (desktop) to
  // ~3000px (mobile) below the field it names. Without these two the buyer is
  // told what is wrong and then left to hunt for it.
  it("focuses the phone input and marks it invalid when the guard fires", async () => {
    const { container } = render(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} />,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const phone = screen.getByLabelText(/phone/i) as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");

    fireEvent.change(phone, { target: { value: "   " } });
    fireEvent.submit(form);

    expect(document.activeElement).toBe(phone);
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    // The field points at the alert it belongs to, so a screen reader reads the
    // reason on focus instead of only where the message happens to render.
    const alert = await screen.findByText(/add a phone number/i);
    expect(phone.getAttribute("aria-describedby")).toBe(alert.id);
    expect(alert.getAttribute("role")).toBe("alert");
  });

  // Focusing the input scrolls the summary rail off screen (the two sit ~1700px
  // apart at 390px wide), so a message left down there would trade "message
  // without field" for "field without message". Exactly one alert, at the field.
  it("renders the phone message at the field, not in the summary rail", async () => {
    const { container } = render(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} />,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const phone = screen.getByLabelText(/phone/i) as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");

    fireEvent.change(phone, { target: { value: "   " } });
    fireEvent.submit(form);

    expect(screen.getAllByText(/add a phone number/i)).toHaveLength(1);
    const alert = await screen.findByText(/add a phone number/i);
    expect(phone.closest("fieldset")?.contains(alert)).toBe(true);
  });

  // A declined card or a network failure has no field to point at, so it keeps
  // its place beside the CTA that triggered it.
  it("leaves a place-order failure in the summary rail", async () => {
    const { container } = render(
      <CheckoutPage
        items={items}
        subtotal={10}
        onPlaceOrder={() => {
          throw new Error("Your card was declined.");
        }}
      />,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const phone = screen.getByLabelText(/phone/i) as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");

    fireEvent.change(phone, { target: { value: "304-555-0142" } });
    fireEvent.submit(form);

    const alert = await screen.findByText(/card was declined/i);
    expect(phone.closest("fieldset")?.contains(alert)).toBe(false);
    expect(phone.getAttribute("aria-invalid")).toBe(null);
    expect(phone.getAttribute("aria-describedby")).toBe(null);
  });

  it("drops the invalid mark and the message as soon as a real number is typed", async () => {
    const { container } = render(
      <CheckoutPage items={items} subtotal={10} onPlaceOrder={() => {}} />,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const phone = screen.getByLabelText(/phone/i) as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");

    fireEvent.change(phone, { target: { value: "   " } });
    fireEvent.submit(form);
    expect(phone.getAttribute("aria-invalid")).toBe("true");

    // Another space is still invalid — no false all-clear.
    fireEvent.change(phone, { target: { value: "    " } });
    expect(phone.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(phone, { target: { value: "304-555-0142" } });
    expect(phone.getAttribute("aria-invalid")).toBe(null);
    expect(phone.getAttribute("aria-describedby")).toBe(null);
    expect(screen.queryByText(/add a phone number/i)).toBe(null);
  });
});

