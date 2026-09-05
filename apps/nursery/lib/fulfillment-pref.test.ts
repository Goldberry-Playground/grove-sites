import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FULFILLMENT_PREF_KEY,
  formatForPref,
  readFulfillmentPref,
  writeFulfillmentPref,
} from "./fulfillment-pref";

// Minimal in-memory localStorage (the default vitest env is "node", no DOM).
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("read/writeFulfillmentPref", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a saved preference", () => {
    writeFulfillmentPref("ship");
    expect(readFulfillmentPref()).toBe("ship");
    writeFulfillmentPref("pickup");
    expect(readFulfillmentPref()).toBe("pickup");
  });

  it("returns null when nothing saved", () => {
    expect(readFulfillmentPref()).toBeNull();
  });

  it("ignores a malformed / stale stored value", () => {
    localStorage.setItem(FULFILLMENT_PREF_KEY, "bogus");
    expect(readFulfillmentPref()).toBeNull();
  });

  it("never throws when localStorage is unavailable (private mode)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => writeFulfillmentPref("ship")).not.toThrow();
    expect(readFulfillmentPref()).toBeNull();
  });
});

describe("formatForPref", () => {
  const formats = ["Potted", "Bareroot"];
  // Typical current inventory: Potted is pickup-only, Bareroot ships.
  const isPickupOnly = (f: string) => f === "Potted";
  const allPurchasable = () => true;

  it("picks the first shippable purchasable format for a ship preference", () => {
    expect(formatForPref(formats, "ship", allPurchasable, isPickupOnly)).toBe("Bareroot");
  });

  it("picks the first pickup-only purchasable format for a pickup preference", () => {
    expect(formatForPref(formats, "pickup", allPurchasable, isPickupOnly)).toBe("Potted");
  });

  it("never returns an unpurchasable format (GOL-1862 guard stays authoritative)", () => {
    // Bareroot is the only shippable format but it is sold out / unbuyable.
    const purchasable = (f: string) => f !== "Bareroot";
    expect(formatForPref(formats, "ship", purchasable, isPickupOnly)).toBeNull();
  });

  it("returns null when no format matches the wanted intent", () => {
    // All formats ship — a pickup preference has nothing to land on.
    expect(formatForPref(formats, "pickup", allPurchasable, () => false)).toBeNull();
  });

  it("stays generic across the GOL-2031 flip (potted shippable)", () => {
    // Once Potted ships too, a ship preference opens on the first shippable
    // format in display order — no tier is hard-coded.
    expect(formatForPref(formats, "ship", allPurchasable, () => false)).toBe("Potted");
  });

  it("preserves display order", () => {
    expect(formatForPref(["Bareroot", "Potted"], "ship", allPurchasable, isPickupOnly)).toBe(
      "Bareroot",
    );
  });
});
