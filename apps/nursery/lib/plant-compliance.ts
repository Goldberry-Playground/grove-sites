import type { ShippingRateFeed } from "@grove/odoo-client";

/**
 * Client-side mirror of the per-product plant-health carve-out gate (GOL-2132).
 *
 * The green-list zone map in `shipping-estimate.ts` answers "do we ship to this
 * state at all?". This answers the second, item-specific question the PDP was
 * silent about until GOL-2973: "is *this plant* cleared into that state?" —
 * even when the state is green.
 *
 * ── Source of truth ─────────────────────────────────────────────────────────
 * grove-odoo-modules `grove_headless/models/plant_compliance.py` (the gate the
 * checkout controller hard-rejects an order with) and
 * `models/bundle_substitution.py` (what we offer instead). Both are serialized
 * into the SAME `/grove/api/v1/shipping/rates` feed the estimator already
 * receives — `compliance.carve_outs` / `bundle_substitution.substitutes` — so
 * the PDP notice and the checkout refusal read one map and cannot drift. The
 * constants below are only the baked fallback for an unreachable feed, exactly
 * like `SNAPSHOT_ZONE_MAP`.
 *
 * Fail-safe parity matters more here than anywhere else in the estimator: the
 * backend refuses a product whose botanical name is empty or unparseable into a
 * REGULATED state rather than guess a taxon. So does this module — a
 * consult-built mix (templates 134/135, deliberately no declared botanical) is
 * reported `unconfirmed`, never `clear`. Over-promising is the harm we are
 * fixing; a cautious "ask us" is always the safe direction.
 *
 * ── Gate order ──────────────────────────────────────────────────────────────
 * Mirrors the checkout controller exactly: `grove_compliance_exempt` →
 * phantom (Kit) BoM → `evaluate_line`. Both skips reach us as flags on the
 * product payload — `complianceExempt` and `shipsAllGreenStates` (GOL-2988) —
 * and both short-circuit `evaluateCompliance` to `clear`. Neither widens the
 * green list; they only remove the per-PRODUCT block.
 */

/** One carve-out rule: a taxon may not ship to `states` ("block"), or may ship
 *  only to `states` ("allow"). Wire shape, snake_case keys preserved. */
export interface CarveOutRule {
  kind: "block" | "allow";
  states: string[];
}

/** Resolved carve-out map + the states any rule touches. */
export interface ComplianceMap {
  /** Lowercased taxon key (`"castanea"`, `"morus alba"`) → rule. */
  carveOuts: Record<string, CarveOutRule>;
  /**
   * Every state named by any rule. The empty/unparseable-botanical fail-safe
   * applies ONLY to these — a green state outside the set is unregulated and
   * ships exactly as it did before the gate existed.
   */
  regulatedStates: string[];
}

/** What we ship in place of a restricted genus (bundle substitution, GOL-2237). */
export interface TaxonSubstitute {
  botanical: string;
  label: string;
  native: boolean;
}

/** Baked fallback of `plant_compliance.CARVE_OUTS` (NPB Oct-2025). Used only
 *  when the live feed is unreachable; kept in lock-step by the drift test. */
export const SNAPSHOT_COMPLIANCE: ComplianceMap = {
  carveOuts: {
    // Castanea — chestnut / chestnut-hybrid. Gall wasp / blight certs.
    castanea: { kind: "block", states: ["FL", "OR", "WA"] },
    // Prunus — peach, plum, American plum. Plum pox / stone-fruit certs.
    prunus: { kind: "block", states: ["OR", "WA"] },
    // Cornus — dogwood. Dogwood anthracnose quarantine.
    cornus: { kind: "block", states: ["FL"] },
    // Carya — hickory / pecan. Pecan weevil.
    carya: { kind: "block", states: ["AZ", "NM"] },
    // Morus alba — white mulberry. Species resolution: Morus rubra stays clean.
    "morus alba": { kind: "block", states: ["IN", "OH", "WI"] },
    // Diospyros — persimmon. CA only, and CA is not green (latent today).
    diospyros: { kind: "block", states: ["CA"] },
  },
  regulatedStates: ["AZ", "CA", "FL", "IN", "NM", "OH", "OR", "WA", "WI"],
};

/** Baked fallback of `bundle_substitution.SUBSTITUTES`, keyed by genus. */
export const SNAPSHOT_SUBSTITUTES: Record<string, TaxonSubstitute> = {
  castanea: { botanical: "Carya ovata", label: "Shagbark Hickory", native: true },
  prunus: { botanical: "Ziziphus jujuba", label: "Jujube", native: false },
};

/**
 * Plain-language names for the taxa that carry a carve-out, so the notice can
 * say "Florida restricts chestnut" instead of "Florida restricts Castanea".
 * Keys match `carveOuts`. An unmapped taxon falls back to the declared
 * botanical name — never to silence.
 */
const TAXON_COMMON_NAMES: Record<string, string> = {
  castanea: "chestnut",
  prunus: "plum and other stone fruit",
  cornus: "dogwood",
  carya: "hickory",
  "morus alba": "white mulberry",
  diospyros: "persimmon",
};

/** Parsed `(genus, species)`, both lowercased; `species` null on a bare genus. */
export interface Taxon {
  genus: string;
  species: string | null;
}

/** A token is a taxon word only if it is all letters — mirrors Python's
 *  `str.isalpha()`, which is false for `"spp."`, `"×"`, `"'Maple"`. */
function isAlpha(token: string): boolean {
  return token.length > 0 && /^[\p{L}]+$/u.test(token);
}

/**
 * Parse a botanical name into `(genus, species)`, both lowercased — the mirror
 * of `plant_compliance.parse_taxon`. Returns null when the name is empty or its
 * first token is not alphabetic (the fail-safe case).
 *
 * `"Morus alba 'Maple Leaf'"` → morus/alba; `"Castanea spp."` → castanea/null
 * (`"spp."` is not alphabetic); `"Bundle: Food Forest"` → null (`"bundle:"`).
 */
export function parseTaxon(botanicalName: string | null | undefined): Taxon | null {
  if (!botanicalName) return null;
  const tokens = botanicalName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || !isAlpha(tokens[0])) return null;
  const species = tokens.length > 1 && isAlpha(tokens[1]) ? tokens[1] : null;
  return { genus: tokens[0], species };
}

/** Most-specific rule for a taxon: genus+species key before the bare genus. */
export function ruleFor(taxon: Taxon, map: ComplianceMap): { key: string; rule: CarveOutRule } | null {
  if (taxon.species) {
    const key = `${taxon.genus} ${taxon.species}`;
    const rule = map.carveOuts[key];
    if (rule) return { key, rule };
  }
  const rule = map.carveOuts[taxon.genus];
  return rule ? { key: taxon.genus, rule } : null;
}

/** True when this taxon may not ship to `state` (canonical 2-letter code). */
export function isTaxonBlocked(taxon: Taxon, state: string, map: ComplianceMap): boolean {
  const found = ruleFor(taxon, map);
  if (!found) return false;
  return found.rule.kind === "block"
    ? found.rule.states.includes(state)
    : !found.rule.states.includes(state);
}

/** Feed-first compliance map, snapshot fallback — the same drift-safe seam as
 *  `resolveZoneMap`. A feed present but carrying no `compliance` block (an
 *  older backend) also falls back, so the notice never silently disappears. */
export function resolveCompliance(feed?: ShippingRateFeed | null): ComplianceMap {
  const wire = feed?.compliance;
  if (!wire || !wire.carve_outs || Object.keys(wire.carve_outs).length === 0) {
    return SNAPSHOT_COMPLIANCE;
  }
  return {
    carveOuts: wire.carve_outs,
    regulatedStates: wire.regulated_states ?? [],
  };
}

/** Feed-first substitute map, snapshot fallback. */
export function resolveSubstitutes(feed?: ShippingRateFeed | null): Record<string, TaxonSubstitute> {
  const wire = feed?.bundle_substitution;
  if (!wire || !wire.substitutes || Object.keys(wire.substitutes).length === 0) {
    return SNAPSHOT_SUBSTITUTES;
  }
  return wire.substitutes;
}

/**
 * Per-item, per-state compliance verdict for a GREEN destination.
 *
 *  - `clear`       — ship it, quote a rate (today's only happy branch).
 *  - `restricted`  — the declared taxon is carved out of this state. We know
 *                    the reason and can name a swap, so the copy is specific.
 *  - `consult-constrained` — a consult-built SKU (Odoo `grove_consult_built`,
 *                    templates 134/135) into a regulated state. The backend no
 *                    longer refuses the deposit here: GOL-3019 defers the real
 *                    compliance decision to mix time and records the excluded
 *                    taxa on the order. So the honest storefront answer is not
 *                    "we can't", it is "we can, with these species off the
 *                    list" — said BEFORE the customer pays (GOL-3028).
 *  - `unconfirmed` — no parseable declared botanical, NOT consult-built, and the
 *                    state is regulated: the backend fail-safe still refuses
 *                    this at checkout, so the PDP must not quote a rate. The
 *                    pre-GOL-3019 behaviour for any other undeclared product.
 */
export type ComplianceVerdict =
  | { kind: "clear" }
  | {
      kind: "consult-constrained";
      /** Carve-out taxa this destination excludes, as the gate names them. */
      excludedTaxa: string[];
    }
  | {
      kind: "restricted";
      /** Lowercased taxon key that matched, e.g. "castanea". */
      taxonKey: string;
      /** Plain-language taxon for customer copy, e.g. "chestnut". */
      taxonLabel: string;
      /** What we can offer instead, when a substitute is defined. */
      substitute: TaxonSubstitute | null;
    }
  | { kind: "unconfirmed" };

const CLEAR: ComplianceVerdict = { kind: "clear" };

export interface ComplianceInput {
  /** Declared `grove_botanical_name` for the product, or null/"" when unset. */
  botanicalName?: string | null;
  /** Odoo `grove_compliance_exempt` — Josh has cleared this item by hand, so
   *  checkout skips the gate entirely and so must the notice (GOL-2587). */
  complianceExempt?: boolean;
  /**
   * `ships_all_green_states` (GOL-2988) — this product is a phantom/Kit-BoM
   * bundle, so checkout explodes it per destination and substitutes whatever
   * that state restricts (GOL-2237) before the carve-out gate ever sees a
   * taxon. Same shape and same effect as `complianceExempt`: the gate skips,
   * so the notice must too (GOL-3015).
   */
  shipsAllGreenStates?: boolean;
  /**
   * Odoo `grove_consult_built` (API `consult_built`, grove-odoo-modules PR #315).
   * `true` on a SKU whose contents are agreed in a consult AFTER the deposit, so
   * there is nothing true to declare at checkout time (templates 134/135). The
   * notice keys on THIS, never on the empty botanical: an empty botanical also
   * covers products that simply have not been declared yet, and those still get
   * the cautious `unconfirmed` fail-safe.
   */
  consultBuilt?: boolean;
  /** Canonical 2-letter destination code; "" before the shopper picks one. */
  state: string;
  compliance: ComplianceMap;
  substitutes?: Record<string, TaxonSubstitute>;
}

/**
 * Evaluate one product against one destination — the mirror of
 * `plant_compliance.evaluate_line`, returning a verdict to render rather than a
 * 400 message. Callers must only act on this for a state already on the green
 * list; the green gate runs first and its copy is different ("not there yet" is
 * about geography, this is about the item).
 */
export function evaluateCompliance({
  botanicalName,
  complianceExempt,
  shipsAllGreenStates,
  consultBuilt,
  state,
  compliance,
  substitutes = SNAPSHOT_SUBSTITUTES,
}: ComplianceInput): ComplianceVerdict {
  if (!state) return CLEAR;
  // The exemption is the operator's explicit override: checkout skips the gate,
  // so the storefront must too or we'd warn about an order that sails through.
  if (complianceExempt) return CLEAR;
  // Substitution bundle (GOL-2988/GOL-3015): the gate's SECOND skip, and the
  // one that bites hardest if we miss it. A bundle whose declared botanical
  // leads with the most restrictive taxon in its palette (template 132 is
  // Castanea-led by design, GOL-2961/GOL-2972) parses as blocked here — yet
  // checkout substitutes that component away per destination and ships the
  // order. Suppressing the notice is therefore the FAITHFUL read, not a
  // loosening: without it the PDP would say "Not cleared for Florida" about an
  // order we will happily fulfil, which is GOL-2973's advertise-vs-reject
  // defect pointing the other way — turning away revenue instead of taking an
  // order we must refuse.
  if (shipsAllGreenStates) return CLEAR;

  // Consult-built deferral (GOL-3019 step 2b-iii), mirrored exactly: the backend
  // takes this branch only when the template is consult-built AND declares no
  // botanical, and only a REGULATED destination carries a constraint worth
  // naming. A consult-built SKU that somehow declares a botanical falls through
  // to normal evaluation, like the gate does.
  if (consultBuilt && !(botanicalName ?? "").trim()) {
    const excludedTaxa = excludedTaxaForState(state, compliance);
    if (excludedTaxa.length > 0) return { kind: "consult-constrained", excludedTaxa };
    return CLEAR;
  }

  const taxon = parseTaxon(botanicalName);
  if (!taxon) {
    // Fail-safe, in lock-step with the backend: unknown taxon is refused into a
    // regulated state and ships normally everywhere else.
    return compliance.regulatedStates.includes(state) ? { kind: "unconfirmed" } : CLEAR;
  }
  if (!isTaxonBlocked(taxon, state, compliance)) return CLEAR;

  const found = ruleFor(taxon, compliance);
  const taxonKey = found?.key ?? taxon.genus;
  return {
    kind: "restricted",
    taxonKey,
    taxonLabel:
      TAXON_COMMON_NAMES[taxonKey] ?? ((botanicalName ?? "").trim() || taxon.genus),
    substitute: substitutes[taxon.genus] ?? null,
  };
}

/** True when a verdict means "do not quote a rate for this item/state pair". */
export function blocksRate(verdict: ComplianceVerdict): boolean {
  return verdict.kind !== "clear";
}

/**
 * The 14 single-species SKUs a consult-built mix (templates 134/135) draws
 * from — the "palette" whose CEILING is what we may honestly declare for a
 * class-C SKU (GOL-2972). Snapshotted from the live published catalog
 * (`/grove/api/v1/products?limit=200` + each `facts.botanical_name`,
 * 2026-10-05): 20 SKUs = these 14 singles + 6 bundles. Bundles are excluded
 * because a mix is built from plants, not from other bundles.
 *
 * Why a snapshot and not the feed: the rate feed carries the carve-out RULES
 * (`compliance.carve_outs`) but not the catalog, so "how many of what we grow
 * clears your state" cannot be derived from it. Only the membership of this list
 * is baked — every exclusion decision runs the same `evaluateCompliance` the
 * checkout gate mirrors, so a rule change in the feed re-counts automatically
 * and the notice can never contradict the gate. `plant-compliance.test.ts` pins
 * the three live answers (FL 11/14, IN/OH/WI 13/14, elsewhere 14/14), so a
 * catalog change that moves them fails CI rather than shipping a wrong promise.
 */
export interface PaletteSpecies {
  /** Odoo `product.template` id, so a drift check can re-read the catalog. */
  templateId: number;
  /** Customer-facing name, exactly as the shop card reads it. */
  label: string;
  /** Declared `grove_botanical_name` — what the carve-out gate keys on. */
  botanical: string;
}

export const CONSULT_PALETTE: PaletteSpecies[] = [
  { templateId: 93, label: "American Chestnut", botanical: "Castanea dentata" },
  { templateId: 5, label: "American Plum", botanical: "Prunus americana" },
  { templateId: 3, label: "Apple", botanical: "Malus domestica" },
  { templateId: 87, label: "Black Walnut", botanical: "Juglans nigra" },
  { templateId: 8, label: "Chestnut - Hybrid", botanical: "Castanea spp. (hybrid)" },
  { templateId: 9, label: "Dogwood", botanical: "Cornus florida" },
  { templateId: 10, label: "Fig", botanical: "Ficus carica" },
  { templateId: 11, label: "Jujube", botanical: "Ziziphus jujuba" },
  {
    templateId: 13,
    label: "Mulberry",
    botanical: "Morus alba 'Maple Leaf' (hybrid white mulberry)",
  },
  { templateId: 91, label: "PawPaw", botanical: "Asimina triloba" },
  { templateId: 14, label: "Peach", botanical: "Prunus persica" },
  { templateId: 15, label: "Pear", botanical: "Pyrus spp." },
  { templateId: 17, label: "Plum", botanical: "Prunus spp." },
  { templateId: 19, label: "Service Berry", botanical: "Amelanchier laevis" },
];

/**
 * Carve-out taxa that may not ship to `state` — the mirror of
 * `plant_compliance.excluded_taxa_for_state` (grove-odoo-modules PR #315), which
 * is what the backend records on the order when it defers a consult-built mix's
 * compliance to mix time (GOL-3019 AC4). Sorted keys, e.g. `["castanea",
 * "cornus"]` for FL and `["morus alba"]` for IN/OH/WI; empty for an unregulated
 * destination. Reads the live feed map, so the notice and the deferral record
 * name the same constraint.
 */
export function excludedTaxaForState(state: string, map: ComplianceMap): string[] {
  if (!state) return [];
  return Object.entries(map.carveOuts)
    .filter(([, rule]) =>
      rule.kind === "block" ? rule.states.includes(state) : !rule.states.includes(state),
    )
    .map(([taxon]) => taxon)
    .sort();
}

/**
 * What a consult-built mix can and cannot include for one destination — the
 * honest constraint list the PDP and checkout show before the customer pays
 * (GOL-3019 §4 / GOL-3028).
 *
 * `excluded` is the species WE GROW that this state restricts, named the way a
 * customer reads them ("American Chestnut", not "castanea"). `clearedCount` /
 * `paletteCount` give the reassuring shape of the constraint: three of fourteen
 * off the list is a narrowing, not a refusal, and a 100-tree food forest is
 * still genuinely deliverable.
 */
export interface ConsultMixOutlook {
  /** Species from `CONSULT_PALETTE` this state restricts, in catalog order. */
  excluded: PaletteSpecies[];
  /** Plain-language taxon names behind the exclusions, deduped + in order. */
  excludedTaxonLabels: string[];
  /** How many palette species clear this destination. */
  clearedCount: number;
  /** Palette size (14 today) — the denominator of "N of M clear". */
  paletteCount: number;
}

/**
 * Evaluate the whole palette against one destination. Pure + synchronous, so the
 * notice answers inside the Doherty threshold on a state change.
 *
 * Every species goes through `evaluateCompliance` — the same mirror of the
 * checkout gate the single-product notice uses — so the count can never claim a
 * species clears a state the gate would refuse it into.
 */
export function consultMixOutlook(
  state: string,
  compliance: ComplianceMap,
  palette: PaletteSpecies[] = CONSULT_PALETTE,
): ConsultMixOutlook {
  const excluded = state
    ? palette.filter(
        (species) =>
          evaluateCompliance({
            botanicalName: species.botanical,
            state,
            compliance,
          }).kind !== "clear",
      )
    : [];
  const labels: string[] = [];
  for (const species of excluded) {
    const taxon = parseTaxon(species.botanical);
    const found = taxon ? ruleFor(taxon, compliance) : null;
    const key = found?.key ?? taxon?.genus ?? "";
    const label = TAXON_COMMON_NAMES[key] ?? key;
    if (label && !labels.includes(label)) labels.push(label);
  }
  return {
    excluded,
    excludedTaxonLabels: labels,
    clearedCount: palette.length - excluded.length,
    paletteCount: palette.length,
  };
}
