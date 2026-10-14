// Canonical ship-to eligibility list for the checkout form's State/Country
// selects (GOL-1055). Co-located with the session route this package owns so the
// UI's selectable set and the server payload it produces can never drift apart.
//
// ── Source of truth ─────────────────────────────────────────────────────────
// These 32 states are the nursery "green list" — the states we are licensed to
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
  { code: "AL", name: "Alabama" },
  { code: "AR", name: "Arkansas" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "OH", name: "Ohio" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "TN", name: "Tennessee" },
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

/**
 * Ship-to list for a SEED-ONLY cart (Josh, 2026-10-13): seeds are not living
 * trees, so the nursery licence list above does not apply. Seeds go to every
 * state plus DC except Hawaii and Alaska (49 options). The backend enforces the
 * same list for seed orders (GOL-3257); tree carts keep `SHIP_TO_STATES`.
 */
export const SEED_SHIP_TO_STATES: ShipToOption[] = [
  { code: "AL", name: "Alabama" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

/**
 * Ship-to list for a PRINTIFY (shirt) cart (gom printify spec, Josh 2026-10-13,
 * GOL-3315): the 50 US states plus DC, 51 options, no territories. Printify
 * prints and ships the shirts, so neither the nursery licence list nor the
 * seed list applies. The backend enforces the same 51-code set and refuses
 * anything else with "Shirts ship to the 50 US states and DC."
 */
export const US_SHIP_TO_STATES: ShipToOption[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  ...SEED_SHIP_TO_STATES.filter((s) => s.code !== "AL" && s.name.localeCompare("Hawaii") < 0 && s.code !== "AK"),
  { code: "HI", name: "Hawaii" },
  ...SEED_SHIP_TO_STATES.filter((s) => s.name.localeCompare("Hawaii") > 0),
];
