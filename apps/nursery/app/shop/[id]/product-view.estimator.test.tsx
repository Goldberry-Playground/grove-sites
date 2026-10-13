// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider } from "@grove/checkout";
import { ProductView, type ViewVariant } from "./product-view";

/**
 * The state estimator quotes ONE line, for the selected Format, in that card's
 * own words (GOL-3286, Josh 2026-10-13). Seen live on the Fig PDP: the panel
 * listed "Potted · Ships now from $20" and "Peat & bagged · Ships in 5-10
 * business days from $17" under a Format row whose cards read "Peat & bagged"
 * and "Bareroot pre-order". "Potted" must never appear in a shipping estimate,
 * and the line has to follow the shopper from card to card.
 */

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

// Prod template 10 (Fig) shape: a Bareroot + Potted pair over one pool.
const FIG: ViewVariant[] = [
  {
    id: 1001,
    name: "Fig (Chicago Hardy, Potted)",
    price: 24,
    available: true,
    qtyAvailable: 12,
    cultivar: "Chicago Hardy",
    format: "Potted",
    rootstock: null,
    shippingTier: "potted",
    imageUrl: "",
  },
  {
    id: 1002,
    name: "Fig (Chicago Hardy, Bareroot)",
    price: 18,
    available: true,
    qtyAvailable: 12,
    cultivar: "Chicago Hardy",
    format: "Bareroot",
    rootstock: null,
    shippingTier: "bareroot",
    imageUrl: "",
  },
];

function renderPdp(variants: ViewVariant[] = FIG) {
  return render(
    <CartProvider>
      <ProductView
        productId={10}
        name="Fig"
        featured={false}
        heroImage=""
        images={[]}
        variants={variants}
        fallbackPrice={24}
        saleOk
        botanicalName="Ficus carica"
      />
    </CartProvider>,
  );
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

function panel() {
  return screen.getByRole("region", { name: /estimate shipping/i });
}

function lines() {
  return [...panel().querySelectorAll("[data-estimator-line]")] as HTMLElement[];
}

function formatGroup() {
  return screen.getByText("Format").parentElement as HTMLElement;
}

/** The card names in the Format row, in display order. */
function formatCardNames() {
  return [...formatGroup().querySelectorAll("button[aria-pressed]")]
    .map((b) => (b.textContent ?? "").match(/Peat & bagged|Bareroot pre-order|Potted/)?.[0])
    .filter((t): t is string => Boolean(t));
}

async function pickState(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.selectOptions(screen.getByRole("combobox", { name: /estimate shipping to your state/i }), code);
}

describe("ProductView: estimator quotes the selected Format only (GOL-3286)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Oct 7: potted season (May 1 to Oct 15) AND pre-orders open (Sep 1), so
    // the Fig row shows both cards, exactly the live shape Josh reported.
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 7, 12)));
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("Fig shape: Peat & bagged + Bareroot pre-order cards, one line, never 'Potted'", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPdp();
    expect(formatCardNames()).toEqual(["Peat & bagged", "Bareroot pre-order"]);

    await pickState(user, "RI");
    expect(panel().textContent).toMatch(/We ship to Rhode Island/);
    expect(lines()).toHaveLength(1);
    const line = lines()[0].textContent ?? "";
    // The selected (potted) card's words, not the tier's hard-coded label.
    expect(line).toMatch(/^Peat & bagged ·\sShips now/);
    expect(line).toMatch(/from \$\d+$/);
    expect(panel().textContent).not.toMatch(/Potted/);
    // The card echoes the same number the estimator quotes.
    const amount = line.match(/\$(\d+)/)![1];
    const peat = within(formatGroup()).getByRole("button", { name: /^Peat & bagged/ });
    expect(peat.textContent).toMatch(new RegExp(`ship \\$${amount} to RI`));
  });

  it("switching Format swaps the single line to the new card's words", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPdp();
    await pickState(user, "RI");
    expect(lines()[0].textContent).toMatch(/^Peat & bagged/);

    await user.click(within(formatGroup()).getByRole("button", { name: /^Bareroot pre-order/ }));
    expect(lines()).toHaveLength(1);
    let line = lines()[0].textContent ?? "";
    expect(line).toMatch(/^Bareroot pre-orderPre-order/); // label + the card's badge
    expect(line).toMatch(/from \$\d+$/);
    expect(line).not.toMatch(/Peat & bagged|Ships in \d|Ships now/);
    expect(panel().textContent).not.toMatch(/Potted/);

    // No zone yet, so the card shows no wave: the line invents no ship date.
    expect(line).not.toMatch(/wave/);
    await user.selectOptions(screen.getByLabelText(/your usda zone/i), "6");
    line = lines()[0].textContent ?? "";
    // The chip's own words and casing: "Fall wave" + "Approx Nov 9 to Nov 26".
    expect(line).toMatch(/·\sFall wave, approx [A-Z][a-z]{2} \d+ to [A-Z][a-z]{2} \d+/);
    const chip = within(formatGroup()).getByRole("group", { name: /pre-order wave/i });
    const window = line.match(/approx (.+?) to (.+?)(?:from|$)/)!;
    expect(chip.textContent).toMatch(`Approx ${window[1]} to ${window[2].trim()}`);

    // And back: the potted card's line returns, still without "Potted".
    await user.click(within(formatGroup()).getByRole("button", { name: /^Peat & bagged/ }));
    expect(lines()).toHaveLength(1);
    expect(lines()[0].textContent).toMatch(/^Peat & bagged ·\sShips now/);
    expect(panel().textContent).not.toMatch(/Potted/);
  });

  it("no estimator text contains 'Potted' under Shipped, for either card", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPdp();
    for (const state of ["RI", "WV", "FL"]) {
      await pickState(user, state);
      for (const card of [/^Bareroot pre-order/, /^Peat & bagged/]) {
        await user.click(within(formatGroup()).getByRole("button", { name: card }));
        expect(panel().textContent).not.toMatch(/Potted/);
        expect(lines().length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("the Farm pickup card still reads 'Potted', and the estimator is hidden there", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPdp();
    const group = screen.getByRole("group", { name: /how do you want it/i });
    await user.click(within(group).getByRole("button", { name: /farm pickup/i }));
    expect(formatCardNames()).toContain("Potted");
    expect(screen.queryByRole("region", { name: /estimate shipping/i })).toBeNull();
  });
});
