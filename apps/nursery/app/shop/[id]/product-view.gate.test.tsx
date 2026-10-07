// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider } from "@grove/checkout";
import { ProductView, type ViewVariant } from "./product-view";

/**
 * Farm pickup / Shipped gate + Fall/Spring pre-order waves (Josh 2026-10-07).
 * Prod template 4 (American Persimmon) is a Bareroot + Potted pair. In the
 * potted season the potted variant is the immediate buy ("Potted" picked up,
 * "Peat & bagged" shipped); the bareroot variant is the "Bareroot pre-order"
 * card from Sep 1, and the only card after Oct 15. A potted tree chosen for
 * pickup is locked to pickup in the cart; a pre-order carries its wave.
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

// Prod #91 PawPaw: one bareroot variant, no Format axis.
const PAWPAW: ViewVariant[] = [
  {
    id: 191,
    name: "PawPaw",
    price: 15,
    available: true,
    qtyAvailable: 20,
    cultivar: null,
    format: null,
    rootstock: null,
    shippingTier: "bareroot",
    imageUrl: "",
  },
];

// Prod #130 White Oak: one potted variant, no Format axis.
const WHITE_OAK: ViewVariant[] = [
  {
    id: 230,
    name: "White Oak",
    price: 18,
    available: true,
    qtyAvailable: 12,
    cultivar: null,
    format: null,
    rootstock: null,
    shippingTier: "potted",
    imageUrl: "",
  },
];

function renderPdp(variants: ViewVariant[] = VARIANTS, productId = 4) {
  return render(
    <CartProvider>
      <ProductView
        productId={productId}
        name="American Persimmon"
        featured={false}
        heroImage=""
        images={[]}
        variants={variants}
        fallbackPrice={12}
        saleOk
      />
    </CartProvider>,
  );
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

function cartLines(): Array<{ variantId: number; pickupOnly?: boolean; wave?: string }> {
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

  it("Oct 7 Shipped: Peat & bagged + Bareroot pre-order, both waves open for zone 8", async () => {
    const user = userEvent.setup();
    renderPdp();
    const group = within(formatGroup());
    expect(group.getByRole("button", { name: /peat & bagged/i })).toBeTruthy();
    expect(group.queryByRole("button", { name: /^potted/i })).toBeNull();
    expect(group.getByRole("button", { name: /bareroot pre-order/i })).toBeTruthy();
    // Shipped keeps the price in front of the deposit line.
    expect(
      group.getByRole("button", { name: /bareroot pre-order/i }).querySelector("span.block.text-xs")?.textContent,
    ).toMatch(/^\$\d+\.\d{2} · \$10 deposit today · balance when it ships$/);
    await user.selectOptions(screen.getByLabelText("Your USDA zone"), "8");
    const fall = group.getByRole("button", { name: /fall wave/i });
    const spring = group.getByRole("button", { name: /spring wave/i });
    expect(fall.getAttribute("aria-disabled")).toBe("false");
    expect(spring.getAttribute("aria-disabled")).toBe("false");
    expect(fall.textContent).toContain("Approx Nov 9 to Dec 12");
    expect(fall.textContent).toContain("Order by Nov 21");
    expect(localStorage.getItem("grove:usda-zone")).toBe("8");
  });

  it("Oct 7 Farm pickup: Potted + Bareroot pre-order, without a ship quote", async () => {
    const user = userEvent.setup();
    renderPdp();
    await user.click(screen.getByRole("button", { name: /farm pickup/i }));
    expect(screen.queryByLabelText("Your USDA zone")).toBeNull();
    const group = within(formatGroup());
    const potted = group.getByRole("button", { name: /^potted/i });
    expect(potted.textContent).not.toMatch(/ship \$|ships from/);
    const pickupCard = group.getByRole("button", { name: /bareroot pre-order/i });
    // Exactly the pickup subline, no price prefix (M4).
    expect(pickupCard.querySelector("span.block.text-xs")?.textContent).toBe(
      "$10 deposit today · pick up, we will call you to schedule",
    );
    expect(group.getByRole("button", { name: /fall pickup/i })).toBeTruthy();
    expect(group.getByRole("button", { name: /spring pickup/i })).toBeTruthy();
  });

  it("states that pre-orders check out on their own", () => {
    renderPdp();
    expect(
      screen.getByText("Pre-orders check out on their own, one wave per order."),
    ).toBeTruthy();
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
    expect(line?.wave).toBeUndefined();
  });

  it("adding the pre-order passes the chosen wave to the cart line", async () => {
    const user = userEvent.setup();
    renderPdp();
    await user.selectOptions(screen.getByLabelText("Your USDA zone"), "8");
    await user.click(screen.getByRole("button", { name: /spring wave/i }));
    await user.click(screen.getAllByRole("button", { name: /pre-order for \$10/i })[0]);
    const line = cartLines().find((l) => l.variantId === 92);
    expect(line?.wave).toBe("spring");
  });

  it("the pre-order CTA waits for a zone when shipped", async () => {
    const user = userEvent.setup();
    renderPdp();
    await user.click(
      within(formatGroup()).getByRole("button", { name: /bareroot pre-order/i }),
    );
    expect(screen.getByText(/choose your usda zone above/i)).toBeTruthy();
    const cta = screen.getAllByRole("button", { name: /pre-order for \$10/i })[0];
    expect((cta as HTMLButtonElement).disabled).toBe(true);
  });

  it("after Oct 15 both methods offer only the bareroot pre-order", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 16, 12)));
    const user = userEvent.setup();
    renderPdp();
    for (const m of [/shipped/i, /farm pickup/i]) {
      await user.click(screen.getByRole("button", { name: m }));
      const group = within(formatGroup());
      expect(group.queryByRole("button", { name: /potted|peat & bagged/i })).toBeNull();
      expect(group.getByRole("button", { name: /bareroot pre-order/i })).toBeTruthy();
    }
  });

  it("Nov 22 zone 8: fall greyed with Order-by passed, spring selectable", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 22, 12)));
    localStorage.setItem("grove:usda-zone", "8");
    const user = userEvent.setup();
    renderPdp();
    const group = within(formatGroup());
    const fall = group.getByRole("button", { name: /fall wave/i });
    expect(fall.getAttribute("aria-disabled")).toBe("true");
    expect(fall.textContent).toContain("Order-by passed");
    const spring = group.getByRole("button", { name: /spring wave/i });
    expect(spring.getAttribute("aria-disabled")).toBe("false");
    await user.click(fall);
    expect(fall.getAttribute("aria-pressed")).toBe("false");
    expect(spring.getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getAllByRole("button", { name: /pre-order for \$10/i })[0]);
    expect(cartLines().find((l) => l.variantId === 92)?.wave).toBe("spring");
  });

  it("Aug 31: no pre-order card yet", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 7, 31, 12)));
    renderPdp();
    const group = within(formatGroup());
    expect(group.queryByRole("button", { name: /bareroot pre-order/i })).toBeNull();
    expect(group.getByRole("button", { name: /peat & bagged/i })).toBeTruthy();
  });

  it("Oct 7 Shipped, formatless bareroot (#91): zone select + pre-order card, adds with wave", async () => {
    const user = userEvent.setup();
    renderPdp(PAWPAW, 91);
    expect(screen.getByRole("button", { name: /bareroot pre-order/i })).toBeTruthy();
    expect(
      screen.getByText("Pre-orders check out on their own, one wave per order."),
    ).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Your USDA zone"), "8");
    const fall = screen.getByRole("button", { name: /fall wave/i });
    expect(fall.getAttribute("aria-disabled")).toBe("false");
    expect(screen.getByRole("button", { name: /spring wave/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /spring wave/i }));
    await user.click(screen.getAllByRole("button", { name: /pre-order for \$10/i })[0]);
    expect(cartLines().find((l) => l.variantId === 191)?.wave).toBe("spring");
  });

  it("Oct 7 Farm pickup, formatless bareroot (#91): pickup waves shown", async () => {
    const user = userEvent.setup();
    renderPdp(PAWPAW, 91);
    await user.click(screen.getByRole("button", { name: /farm pickup/i }));
    expect(screen.getByRole("button", { name: /fall pickup/i })).toBeTruthy();
  });

  it("Oct 7 Shipped, formatless potted (#130): Peat & bagged, add enabled", () => {
    renderPdp(WHITE_OAK, 130);
    expect(screen.getByText("Peat & bagged")).toBeTruthy();
    const add = screen.getAllByRole("button", { name: /add to cart/i })[0] as HTMLButtonElement;
    expect(add.disabled).toBe(false);
  });

  it("Oct 16, formatless potted (#130): no enabled add-to-cart", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 16, 12)));
    renderPdp(WHITE_OAK, 130);
    for (const b of screen.queryAllByRole("button", { name: /add to cart|pre-order/i })) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByText("Potted trees are sold May 1 to Oct 15.")).toBeTruthy();
    expect(screen.getAllByText("Not available right now").length).toBeGreaterThan(0);
  });
});
