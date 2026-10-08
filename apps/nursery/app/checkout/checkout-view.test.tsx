// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, type CartItem } from "@grove/checkout";
import { cartStorageKey } from "@grove/checkout";
import { NurseryCheckoutView } from "./checkout-view";
import { SNAPSHOT_COMPLIANCE } from "../../lib/plant-compliance";

/**
 * GOL-3028: a consult-built mix in the cart must disclose the per-state species
 * constraint BEFORE the deposit is charged. The two failures that matter are
 * symmetric: disclosing nothing (the customer learns at the consult, after
 * paying), and disclosing it on a cart that has no consult-built line (noise
 * that trains people to ignore the notice).
 */

const CONSULT_LINE: CartItem = {
  variantId: 134,
  templateId: 134,
  name: "Centennial Food Forest (100 Trees)",
  price: 400,
  imageUrl: "",
  quantity: 1,
  consultBuilt: true,
};

const PLAIN_LINE: CartItem = {
  variantId: 3,
  templateId: 3,
  name: "Apple",
  price: 35,
  imageUrl: "",
  quantity: 1,
};

function mount(items: CartItem[]) {
  // The store reads NEXT_PUBLIC_TENANT_ID at module load, so seed the key it
  // actually resolved rather than guessing the tenant slug.
  localStorage.setItem(
    cartStorageKey(process.env.NEXT_PUBLIC_TENANT_ID),
    JSON.stringify(items),
  );
  return render(
    <CartProvider>
      <NurseryCheckoutView compliance={SNAPSHOT_COMPLIANCE} />
    </CartProvider>,
  );
}

async function chooseState(code: string) {
  await userEvent.selectOptions(await screen.findByLabelText(/^State/i), code);
}

describe("nursery checkout — consult-built carve-out disclosure (GOL-3028)", () => {
  it("names the constraint for a consult-built cart before payment", async () => {
    mount([CONSULT_LINE]);
    await chooseState("FL");
    const notice = await screen.findByTestId("consult-carveout-notice");
    expect(notice.textContent).toMatch(
      /Your Florida mix: 14 of our 17 food-forest species/,
    );
    expect(notice.textContent).toMatch(/American Chestnut/);
    expect(notice.textContent).toMatch(/Flowering Dogwood/);
    // Checkout wording, not PDP wording: the deposit is the thing in front of
    // them, so say what it does and does not lock in.
    expect(notice.textContent).toMatch(/Your deposit reserves the consult/);
  });

  it("stays silent on a cart with no consult-built line", async () => {
    mount([PLAIN_LINE]);
    await chooseState("FL");
    expect(screen.queryByTestId("consult-carveout-notice")).toBeNull();
  });

  it("stays silent for a destination that restricts nothing we grow", async () => {
    mount([CONSULT_LINE]);
    await chooseState("WV");
    expect(screen.queryByTestId("consult-carveout-notice")).toBeNull();
  });

  it("discloses before any state is picked? No — there is nothing true to say yet", async () => {
    mount([CONSULT_LINE]);
    expect(await screen.findByLabelText(/^State/i)).toBeTruthy();
    expect(screen.queryByTestId("consult-carveout-notice")).toBeNull();
  });
});
