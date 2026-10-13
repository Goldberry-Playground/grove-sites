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
  /**
   * The harvest year the shopper saw when they added this line, set when the
   * backend's checkout quote moved the reservation to a later harvest (the
   * season closed or filled between add and checkout, spec §6). While present
   * the cart and checkout show the change and checkout stays blocked; the
   * shopper's "Continue with the fall YYYY harvest" clears it. Absent when the
   * line still reserves the harvest it was added for.
   */
  movedFromYear?: number;
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

/** "2026-10-15" shifted by `years` ("2027-10-15"); a non-ISO string is returned as-is. */
export function shiftIsoYear(iso: string, years: number): string {
  const m = /^(\d{4})(-\d{2}-\d{2})$/.exec(iso);
  return m ? `${Number(m[1]) + years}${m[2]}` : iso;
}

/**
 * Move a reservation to the harvest year the backend quoted (GOL-3258, spec
 * §6). A later season shifts the ship window by whole years, exactly as the
 * backend's `seed_season` does (all three dates + 1 year), and reads as rolled
 * over ("Pre-ordered, fall 2027 harvest"). `movedFromYear` keeps the year the
 * shopper first saw, even across a second move, so the notice always names the
 * harvest they thought they were reserving. Returns the same object when the
 * year is unchanged.
 */
export function moveSeedReservation(s: CartSeedReservation, year: number): CartSeedReservation {
  if (year === s.year) return s;
  const delta = year - s.year;
  const from = s.movedFromYear ?? s.year;
  return {
    ...s,
    year,
    // Later than the harvest first shown = this season closed on them. The rare
    // move BACK (a cancel freed the cap) is in season again.
    rolledOver: year > from,
    shipStart: shiftIsoYear(s.shipStart, delta),
    shipEnd: shiftIsoYear(s.shipEnd, delta),
    movedFromYear: from,
  };
}

/** The reservation with its move acknowledged (nothing left to confirm). */
export function acknowledgeSeedMove(s: CartSeedReservation): CartSeedReservation {
  if (s.movedFromYear === undefined) return s;
  const { movedFromYear: _moved, ...rest } = s;
  return rest;
}

/**
 * The notice shown when a seed reservation moved to a later harvest between
 * add-to-cart and checkout (spec §6): what changed, why, what the $1 now
 * reserves, and the two ways out. Plain sentences, no em dashes.
 */
export function seedHarvestMovedMessage(s: CartSeedReservation): string {
  const from = s.movedFromYear ?? s.year;
  const why =
    s.year > from
      ? `Fall ${from} pre-orders closed before you checked out`
      : `Room opened up in the fall ${s.year} harvest`;
  return `Your seed reservation moved to the fall ${s.year} harvest. ${why}, so your $${SEED_DEPOSIT} deposit now reserves seeds from the fall ${s.year} harvest, shipping approx ${seedShipWindow(s)}. Confirm to continue, or remove the seeds from your cart.`;
}

/** The button that acknowledges the move. */
export function seedHarvestConfirmLabel(s: Pick<CartSeedReservation, "year">): string {
  return `Continue with the fall ${s.year} harvest`;
}
