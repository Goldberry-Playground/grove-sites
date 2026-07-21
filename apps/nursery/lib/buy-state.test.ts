import { describe, it, expect } from "vitest";
import { buyStateFor } from "./buy-state";

describe("buyStateFor", () => {
  it("in stock → Add to Cart, enabled, exact count", () => {
    const s = buyStateFor({
      available: true,
      qtyAvailable: 4,
      shippingTier: "potted",
      format: "Potted",
    });
    expect(s.mode).toBe("in-stock");
    expect(s.ctaDisabled).toBe(false);
    expect(s.ctaLabel).toBe("Add to Cart");
    expect(s.stockLabel).toBe("4 in stock");
    expect(s.stockTone).toBe("in-stock");
    expect(s.showDepositNote).toBe(false);
  });

  it("in stock with unknown count → generic In stock", () => {
    const s = buyStateFor({
      available: true,
      qtyAvailable: null,
      shippingTier: "potted",
      format: "Potted",
    });
    expect(s.stockLabel).toBe("In stock");
  });

  it("sold-out bareroot → Reserve, still enabled, qualified line + deposit note", () => {
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "bareroot",
      format: "Bareroot",
    });
    expect(s.mode).toBe("reservable");
    expect(s.ctaDisabled).toBe(false); // the GOL-678 fix — reservable, not dead
    expect(s.ctaLabel).toBe("Reserve");
    expect(s.stockLabel).not.toBe("Sold out"); // never a bare "Sold out"
    expect(s.stockLabel.toLowerCase()).toContain("reserve for october");
    expect(s.stockTone).toBe("reserve");
    expect(s.showDepositNote).toBe(true);
  });

  it("infers reservable from the Format string when tier is missing", () => {
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: null,
      format: "Bareroot",
    });
    expect(s.mode).toBe("reservable");
    expect(s.ctaDisabled).toBe(false);
  });

  it("sold-out potted (not preorder) → disabled Sold out", () => {
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "potted",
      format: "Potted",
    });
    expect(s.mode).toBe("sold-out");
    expect(s.ctaDisabled).toBe(true);
    expect(s.ctaLabel).toBe("Sold out");
    expect(s.stockLabel).toBe("Sold out");
    expect(s.stockTone).toBe("sold-out");
    expect(s.showDepositNote).toBe(false);
  });
});
