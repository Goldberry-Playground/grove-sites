// Canonical ship-to eligibility list for the checkout form's State/Country
// selects (GOL-1055). Co-located with the session route this package owns so the
// UI's selectable set and the server payload it produces can never drift apart.
//
// ── Source of truth ─────────────────────────────────────────────────────────
// These 21 states are the nursery "green list" — the states we are licensed to
// ship living trees to. They mirror the backend zone engine that actually
// prices and gates the order at checkout: grove-odoo-modules
// `grove_headless/models/shipping_zones.py` (`ZONE_BY_STATE`). The client-side
// estimator keeps the SAME membership in `apps/nursery/lib/shipping-estimate.ts`
// (`ZONE_BY_STATE`); a unit test there asserts the two lists stay identical so a
// state added on one side can't silently disappear from the other.
//
// Server-side REJECTION of an unsupported state remains grove-headless
// authority — this list only removes the ability to pick/submit a bad state at
// the UI (kills the "Ohio" vs "OH" and the free-typed-garbage class of bugs).

export interface ShipToOption {
  /** 2-letter code — the value sent to the checkout-session route. */
  code: string;
  /** Full name for the option label. */
  name: string;
}

/** Supported ship-to states, alphabetical by name for the dropdown. Keep in
 *  lockstep with `ZONE_BY_STATE` in the backend engine and the client estimator. */
export const SHIP_TO_STATES: ShipToOption[] = [
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "KY", name: "Kentucky" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "OH", name: "Ohio" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
];

/** Supported ship-to countries. US-only today; a select (not free text) so the
 *  payload country is always a clean 2-letter code and never unparseable. */
export const SHIP_TO_COUNTRIES: ShipToOption[] = [
  { code: "US", name: "United States" },
];
