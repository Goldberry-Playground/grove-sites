/**
 * Shopper's remembered ship-vs-pickup intent (GOL-2089). A PDP recomputes its
 * opening Format from scratch on every `/shop/[id]` visit (`defaultFormat`), so
 * with inventory that is almost all Potted (pickup-only under Box Engine v2) a
 * shopper who wants shipped trees has to re-select "shipped" on every page. We
 * persist a single lightweight preference — the *intent*, not a tier — so the
 * next PDP can open on a format that matches it.
 *
 * Kept generic (ship vs pickup) rather than tier-specific so it survives the
 * GOL-2031 flip that makes Potted shippable: "ship" always means "prefer a
 * format I can have delivered", whatever tier that ends up being.
 *
 * Framework-free and side-effect-guarded so the selection rules stay unit
 * tested independently of the React component, mirroring `variant-select`.
 */
export type FulfillmentPref = "ship" | "pickup";

/** localStorage key, same namespace convention as `grove:ship-state`. */
export const FULFILLMENT_PREF_KEY = "grove:fulfillment-pref";

/**
 * Read the saved preference, or null when unset / unreadable / malformed.
 * Never throws — localStorage can be unavailable (private mode) and the stored
 * value is untrusted, so anything other than the two known tokens is ignored.
 */
export function readFulfillmentPref(): FulfillmentPref | null {
  try {
    const v = localStorage.getItem(FULFILLMENT_PREF_KEY);
    return v === "ship" || v === "pickup" ? v : null;
  } catch {
    return null;
  }
}

/** Persist the shopper's intent. No-op when localStorage is unavailable. */
export function writeFulfillmentPref(pref: FulfillmentPref): void {
  try {
    localStorage.setItem(FULFILLMENT_PREF_KEY, pref);
  } catch {
    /* localStorage unavailable (private mode) — no-op */
  }
}

/**
 * First format (in display order) that matches the shopper's remembered intent:
 * for `ship`, the first *purchasable* format that is NOT pickup-only; for
 * `pickup`, the first purchasable pickup-only format. Returns null when no
 * format satisfies both — the caller then keeps its neutral default.
 *
 * `isPurchasable` is required, never advisory: the GOL-1862 buy-state guard
 * stays authoritative, so a remembered preference can never open the PDP on an
 * unbuyable variant.
 */
export function formatForPref(
  formats: string[],
  pref: FulfillmentPref,
  isPurchasable: (format: string) => boolean,
  isPickupOnly: (format: string) => boolean,
): string | null {
  const wantPickup = pref === "pickup";
  return formats.find((f) => isPurchasable(f) && isPickupOnly(f) === wantPickup) ?? null;
}
