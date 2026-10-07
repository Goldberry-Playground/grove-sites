// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider } from "@grove/checkout";
import { ProductView, type ViewVariant } from "./product-view";

/**
 * Farm pickup / Shipped gate (Josh 2026-10-07 hotfix). Prod template 4
 * (American Persimmon) offered "Potted" as a SHIPPED format: a potted tree ships
 * de-potted as peat and bagged, so Shipped must never show a Potted card, and a
 * potted tree chosen for pickup must be locked to pickup in the cart.
 */

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

// Prod template 4's seedling pair: Bareroot + Potted over one shared pool.
const VARIANTS: ViewVariant[] = [
  {
    id: 92,
    name: "American Persimmon (Seedling, Bareroot)",
    price: 12,
    available: true,
    qtyAvailable: 30,
    cultivar: "Seedling",
    format: "Bareroot",
    rootstock: null,
    shippingTier: "bareroot",
    imageUrl: "",
  },
  {
    id: 91,
    name: "American Persimmon (Seedling, Potted)",
    price: 12,
    available: true,
    qtyAvailable: 30,
    cultivar: "Seedling",
    format: "Potted",
    rootstock: null,
    shippingTier: "potted",
    imageUrl: "",
  },
];

// A potted-only listing with a Format axis (one Potted variant).
const POTTED_ONLY: ViewVariant[] = [{ ...VARIANTS[1], id: 131 }];

// Prod template 130 (White Oak) before its Format pair: one variant, no Format
// axis, potted tier.
const NO_FORMAT_POTTED: ViewVariant[] = [
  {
    id: 321,
    name: "White Oak",
    price: 12,
    available: true,
    qtyAvailable: 25,
    cultivar: null,
    format: null,
    rootstock: null,
    shippingTier: "potted",
    imageUrl: "",
  },
];

function renderPdp(variants: ViewVariant[] = VARIANTS, opts: { pickupOnly?: boolean } = {}) {
  return render(
    <CartProvider>
      <ProductView
        productId={4}
        name="American Persimmon"
        featured={false}
        heroImage=""
        images={[]}
        variants={variants}
        fallbackPrice={12}
        saleOk
        pickupOnly={opts.pickupOnly}
      />
    </CartProvider>,
  );
}

function methodButton(name: RegExp) {
  const group = screen.getByRole("group", { name: /how do you want it/i });
  return within(group).getByRole("button", { name }) as HTMLButtonElement;
}

async function addToCart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("button", { name: /add to cart/i })[0]);
}

function formatGroup() {
  return screen.getByText("Format").parentElement as HTMLElement;
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

function cartLines(): Array<{ variantId: number; pickupOnly?: boolean }> {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    const v = localStorage.getItem(k)!;
    if (v.startsWith("[")) return JSON.parse(v);
    if (v.startsWith("{") && v.includes("variantId")) {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed.items)) return parsed.items;
    }
  }
  return [];
}

describe("ProductView: Farm pickup / Shipped gate", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 7, 12))); // Oct 7, potted season
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the method choice before Format", () => {
    renderPdp();
    expect(screen.getByRole("button", { name: /farm pickup/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /shipped/i })).toBeTruthy();
  });

  it("Shipped never offers a Potted card", () => {
    renderPdp();
    const group = within(formatGroup());
    expect(group.queryByRole("button", { name: /potted/i })).toBeNull();
    expect(group.getByRole("button", { name: /bareroot/i })).toBeTruthy();
  });

  it("Farm pickup offers Potted in season, without a ship quote", async () => {
    const user = userEvent.setup();
    renderPdp();
    await user.click(screen.getByRole("button", { name: /farm pickup/i }));
    const group = within(formatGroup());
    const potted = group.getByRole("button", { name: /potted/i });
    expect(potted.textContent).not.toMatch(/ship/i);
    expect(group.queryByRole("button", { name: /bareroot/i })).toBeNull();
  });

  it("a potted tree added for Farm pickup is locked to pickup in the cart", async () => {
    const user = userEvent.setup();
    renderPdp();
    await user.click(screen.getByRole("button", { name: /farm pickup/i }));
    await user.click(
      screen.getAllByRole("button", { name: /add to cart/i })[0],
    );
    const line = cartLines().find((l) => l.variantId === 91);
    expect(line?.pickupOnly).toBe(true);
  });

  it("after Oct 15, Farm pickup offers the bareroot pre-order, not Potted", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 16, 12)));
    const user = userEvent.setup();
    renderPdp();
    await user.click(screen.getByRole("button", { name: /farm pickup/i }));
    const group = within(formatGroup());
    expect(group.queryByRole("button", { name: /potted/i })).toBeNull();
    expect(
      group.getByRole("button", { name: /bareroot pre-order/i }),
    ).toBeTruthy();
  });

  it("under Farm pickup, no Format card promises shipping", async () => {
    const user = userEvent.setup();
    renderPdp();
    await user.click(methodButton(/farm pickup/i));
    for (const card of within(formatGroup()).getAllByRole("button")) {
      expect(card.textContent).not.toMatch(/ship/i);
    }
  });

  it("after Oct 15, a potted-only listing opens on Farm pickup and carts pickup-only", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 16, 12)));
    const user = userEvent.setup();
    renderPdp(POTTED_ONLY);
    const pickup = methodButton(/farm pickup/i);
    expect(pickup.getAttribute("aria-pressed")).toBe("true");
    expect(pickup.disabled).toBe(false);
    expect(methodButton(/shipped/i).disabled).toBe(true);
    await addToCart(user);
    expect(cartLines().find((l) => l.variantId === 131)?.pickupOnly).toBe(true);
  });

  it("after Oct 15, a potted listing with no Format axis cannot be shipped", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 16, 12)));
    const user = userEvent.setup();
    renderPdp(NO_FORMAT_POTTED);
    expect(methodButton(/farm pickup/i).getAttribute("aria-pressed")).toBe("true");
    expect(methodButton(/shipped/i).disabled).toBe(true);
    await addToCart(user);
    const line = cartLines()[0];
    expect(line?.pickupOnly).toBe(true);
  });

  it("a pickup-only listing never offers Shipped, even in season", () => {
    renderPdp(VARIANTS, { pickupOnly: true });
    expect(methodButton(/farm pickup/i).getAttribute("aria-pressed")).toBe("true");
    expect(methodButton(/shipped/i).disabled).toBe(true);
  });

  it("a remembered Shipped preference does not override a pickup-only listing", () => {
    localStorage.setItem("grove:fulfillment-pref", "ship");
    renderPdp(VARIANTS, { pickupOnly: true });
    expect(methodButton(/farm pickup/i).getAttribute("aria-pressed")).toBe("true");
  });
});
