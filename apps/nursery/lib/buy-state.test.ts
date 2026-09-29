import { describe, it, expect } from "vitest";
import { buyStateFor, PICKUP_CTA_LABEL } from "./buy-state";

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

  it("not for sale (sale_ok=False) → Coming soon, disabled, even for a preorder Bareroot", () => {
    // A published "coming soon" placeholder (GOL-760): qty 0 + Bareroot would
    // otherwise be reservable, but sale_ok=False must lock the box first so the
    // page never offers a live Reserve deposit on unstocked, not-for-sale stock.
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "bareroot",
      format: "Bareroot",
      saleOk: false,
    });
    expect(s.mode).toBe("coming-soon");
    expect(s.ctaDisabled).toBe(true);
    expect(s.ctaLabel).toBe("Coming soon");
    expect(s.stockLabel).toBe("Coming soon");
    expect(s.showDepositNote).toBe(false); // never a deposit on a not-for-sale product
  });

  it("saleOk true / omitted keeps the existing stock+preorder behaviour", () => {
    const reservable = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "bareroot",
      format: "Bareroot",
      saleOk: true,
    });
    expect(reservable.mode).toBe("reservable"); // sale_ok=True → unchanged
    const omitted = buyStateFor({
      available: true,
      qtyAvailable: 3,
      shippingTier: "potted",
      format: "Potted",
    });
    expect(omitted.mode).toBe("in-stock"); // saleOk absent → purchasable as before
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

  // Preorder cap reached (GOL-2171): the per-product reservation cap has been
  // crossed, so even a preorder (Bareroot) format is a hard sell-out.
  it("capReached forces a preorder (Bareroot) format to sold-out, not reservable", () => {
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "bareroot",
      format: "Bareroot",
      capReached: true,
    });
    expect(s.mode).toBe("sold-out"); // would be "reservable" without capReached
    expect(s.ctaDisabled).toBe(true);
    expect(s.ctaLabel).toBe("Sold out");
    expect(s.showDepositNote).toBe(false); // no reservation left to deposit against
  });

  it("capReached does not override real on-hand stock (cap gates only the preorder path)", () => {
    const s = buyStateFor({
      available: true,
      qtyAvailable: 4,
      shippingTier: "bareroot",
      format: "Bareroot",
      capReached: true,
    });
    expect(s.mode).toBe("in-stock"); // on-hand inventory still sells
  });

  it("capReached omitted / false keeps the reservable preorder behaviour", () => {
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "bareroot",
      format: "Bareroot",
      capReached: false,
    });
    expect(s.mode).toBe("reservable");
  });

  it("coming-soon (saleOk=false) outranks capReached", () => {
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "bareroot",
      format: "Bareroot",
      saleOk: false,
      capReached: true,
    });
    expect(s.mode).toBe("coming-soon");
  });
});

/**
 * GOL-2588: a farm-pickup-only line is not a shipment, so the button says so.
 * The relabel applies to the two purchasable modes only — a sold-out or
 * coming-soon box has nothing to reserve, and overwriting "Sold out" with
 * "Reserve for farm pickup" on a dead CTA would be a false promise.
 */
describe("buyStateFor — pickup-only CTA copy (GOL-2588)", () => {
  it('in-stock pickup-only reads "Reserve for farm pickup", still enabled', () => {
    const s = buyStateFor({
      available: true,
      qtyAvailable: 3,
      shippingTier: "potted",
      format: "Potted",
      pickupOnly: true,
    });
    expect(s.mode).toBe("in-stock");
    expect(s.ctaDisabled).toBe(false);
    expect(s.ctaLabel).toBe(PICKUP_CTA_LABEL);
    expect(s.ctaLabel).toBe("Reserve for farm pickup");
  });

  it("a reservable (sold-out bareroot) pickup-only line reserves for pickup too", () => {
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "bareroot",
      format: "Bareroot",
      pickupOnly: true,
    });
    expect(s.mode).toBe("reservable");
    expect(s.ctaLabel).toBe(PICKUP_CTA_LABEL);
    expect(s.showDepositNote).toBe(true); // the deposit rule is a separate axis
  });

  it("leaves a sold-out CTA alone (nothing to reserve)", () => {
    const s = buyStateFor({
      available: false,
      qtyAvailable: 0,
      shippingTier: "potted",
      format: "Potted",
      pickupOnly: true,
    });
    expect(s.mode).toBe("sold-out");
    expect(s.ctaLabel).toBe("Sold out");
    expect(s.ctaDisabled).toBe(true);
  });

  it("leaves a coming-soon CTA alone", () => {
    const s = buyStateFor({
      available: true,
      qtyAvailable: 5,
      shippingTier: "potted",
      format: "Potted",
      saleOk: false,
      pickupOnly: true,
    });
    expect(s.mode).toBe("coming-soon");
    expect(s.ctaLabel).toBe("Coming soon");
  });

  it("omitted / false keeps the existing shippable copy", () => {
    expect(
      buyStateFor({
        available: true,
        qtyAvailable: 1,
        shippingTier: "bareroot",
        format: "Bareroot",
      }).ctaLabel,
    ).toBe("Add to Cart");
    expect(
      buyStateFor({
        available: false,
        qtyAvailable: 0,
        shippingTier: "bareroot",
        format: "Bareroot",
        pickupOnly: false,
      }).ctaLabel,
    ).toBe("Reserve");
  });

  it("carries no em dash (Grove voice rule, GOL-589)", () => {
    expect(PICKUP_CTA_LABEL).not.toContain("—");
  });
});
