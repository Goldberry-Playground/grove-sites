// Seed pre-order copy shared by the PDP card, the cart and the checkout
// (GOL-3258, seed pre-orders spec). One module so "Reserved, fall 2026 harvest"
// reads the same everywhere. Plain sentences, no em dashes (listing style rules).

/** Flat per-order seed deposit in dollars (backend `SEED_DEPOSIT`). */
export const SEED_DEPOSIT = 1;

/**
 * The harvest a seed cart line reserves from, stamped on the line at add time
 * so the cart and checkout can say which harvest it is without re-reading the
 * product. The backend re-decides the harvest year at checkout; this is the
 * label the shopper saw when they added it.
 */
export interface CartSeedReservation {
  /** Harvest year ("fall 2026 harvest"). */
  year: number;
  /** True when this season had closed and the line reserves from next fall. */
  rolledOver: boolean;
  /** ISO `YYYY-MM-DD` ship window. */
  shipStart: string;
  shipEnd: string;
}

/** Refusal when an add would mix seeds with trees (either direction). */
export const SEED_MIXED_MESSAGE =
  "Seed reservations check out on their own. Check out or clear your cart first.";

/** Refusal when an add would put two harvest years in one seed cart. */
export const SEED_YEAR_MESSAGE =
  "Seed reservations check out on their own, one harvest year per order. Check out or clear your cart first.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-15" → "Oct 15". Parsed by hand so no time zone can shift the day. */
export function formatIsoMonthDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : iso;
}

/** "Oct 15 to Nov 15". */
export function seedShipWindow(s: Pick<CartSeedReservation, "shipStart" | "shipEnd">): string {
  return `${formatIsoMonthDay(s.shipStart)} to ${formatIsoMonthDay(s.shipEnd)}`;
}

/** "Reserved, fall 2026 harvest" in season; "Pre-ordered, ..." once rolled over. */
export function seedReservationLabel(s: Pick<CartSeedReservation, "year" | "rolledOver">): string {
  return `${s.rolledOver ? "Pre-ordered" : "Reserved"}, fall ${s.year} harvest`;
}

/** The cart line's sublines: which harvest, and when it ships. */
export function seedLineNotes(s: CartSeedReservation): string[] {
  return [seedReservationLabel(s), `Ships approx ${seedShipWindow(s)}`];
}

/** Dollars, two decimals ("$29.00"). */
export function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
