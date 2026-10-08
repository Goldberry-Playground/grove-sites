/**
 * "Plant two" rule (GOL-2734).
 *
 * `GrowingFacts.pollination` is a free-text Odoo Char (`grove_pollination`,
 * helper text: 'e.g. "Self-fertile" / "Needs a second variety"'), so the PDP
 * cannot read a boolean off it. This module is the ONE explicit rule that
 * decides whether a listing needs a pollination partner, so the "plant two"
 * hint is never a guess and its behaviour is unit-tested (`plant-two.test.ts`)
 * rather than re-derived per component.
 *
 * Design rules, in priority order — the order is the whole point:
 *   1. blank / absent / "not applicable" sentinel → NOT needed. A missing fact
 *      is not evidence of a requirement.
 *   2. an explicitly NEGATED self-fertility claim ("not self-fertile",
 *      "self-sterile") → needed. Checked BEFORE (3) because "not self-fertile"
 *      contains the substring "self-fertile" and would otherwise match it.
 *   3. a self-sufficiency claim ("self-fertile", "self-pollinating") → NOT
 *      needed, even when the prose goes on to say a partner improves yield
 *      ("Self-fertile, but a second variety increases set"). The hint is for
 *      "you will get no fruit alone", not "you could get more" — overstating it
 *      would push a second tree the buyer does not need.
 *   4. an explicit partner requirement ("needs a second variety", "plant 2+
 *      trees", "cross-pollination required", "dioecious") → needed.
 *   5. anything else → NOT needed. Unrecognised prose fails closed: no hint.
 *
 * Adding a phrasing means adding a pattern here plus a test case, not
 * loosening the rule into a fuzzy keyword scan.
 */

/** Which rule fired, for tests and for debugging a surprising listing. */
export type PlantTwoReason =
  | "absent"
  | "not-applicable"
  | "self-negated"
  | "self-fertile"
  | "partner-required"
  | "unrecognised";

export interface PlantTwoVerdict {
  needsPartner: boolean;
  reason: PlantTwoReason;
}

/**
 * Normalize authored prose to a comparable form: lowercase, unicode dashes and
 * curly apostrophes folded to ASCII, punctuation that only ever separates words
 * turned into spaces, whitespace collapsed. Keeps `+` (it carries meaning in
 * "2+ trees") and digits.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‐-―−]/g, "-") // – — ‒ ― − → -
    .replace(/[‘’ʼ]/g, "'") // ’ → '
    .replace(/[^a-z0-9+']+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Content sentinels the listing spec uses for non-fruiting plants. */
const NOT_APPLICABLE = [
  /^n a$/,
  /^na$/,
  /^none$/,
  /\bnot applicable\b/,
];

/** A self-fertility claim that has been explicitly negated → partner needed. */
const SELF_NEGATED = [
  /\bnot self (fertile|fruitful|pollinating|compatible)\b/,
  /\bnon self (fertile|fruitful|pollinating|compatible)\b/,
  /\bself (sterile|incompatible|unfruitful)\b/,
];

/** A standalone self-fertility claim → no partner needed. */
const SELF_SUFFICIENT = [
  /\bself (fertile|fruitful|pollinating|pollinated)\b/,
  /\bselfpollinating\b/,
  /\bno (pollinator|partner|second tree|second variety) (is )?(needed|required)\b/,
  // A negated requirement ("doesn't need a pollinator") must be caught here:
  // the PARTNER_REQUIRED patterns match on "need … pollinator" and would read
  // the negation backwards, recommending a tree the listing just ruled out.
  /\b(does ?n't|does not|do ?n't|do not|won't|will not|never) (needs?|requires?)\b/,
];

/** An explicit requirement for a second plant → partner needed. */
const PARTNER_REQUIRED = [
  // "needs / requires / must have a second (variety|cultivar|tree|plant|...)"
  /\b(needs?|need|requires?|must have|wants?) (a |an |another |two |2 )?(second|2nd|different|other|compatible|separate) (variety|varieties|cultivar|cultivars|tree|trees|plant|plants|seedling|seedlings|pollinator|pollinizer)\b/,
  // "needs / requires a pollinator" (no qualifier)
  /\b(needs?|need|requires?|must have) (a |an )?(pollinator|pollinizer|pollination partner|partner)\b/,
  // bare "second variety" / "another variety" as the whole fact
  /\b(second|another|different) (variety|varieties|cultivar|cultivars|pollinator|pollinizer)\b/,
  // "cross pollination required / needed", "requires cross pollination"
  /\bcross pollination (is )?(required|needed|necessary)\b/,
  /\b(requires?|needs?) cross pollination\b/,
  // "plant 2 / two / 2+ / at least two ... trees"
  /\bplant (at least )?(2\+?|two|3\+?|three) (or more )?(trees|plants|seedlings|varieties|cultivars)?\b/,
  // "2+ trees", "two or more trees", "3 or more seedlings"
  /\b(2|3|two|three)\+? (or more )?(trees|plants|seedlings|varieties|cultivars) (are |is )?(needed|required|recommended for fruit)\b/,
  /\b(2|3)\+ (trees|plants|seedlings|varieties|cultivars)\b/,
  // separate-sex species: one plant can never fruit alone
  /\b(dioecious|male and female)\b/,
];

function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * Decide whether this listing's pollination fact says a second plant is needed
 * to get fruit. Returns the verdict plus which rule fired.
 */
export function plantTwoVerdict(pollination: string | null | undefined): PlantTwoVerdict {
  if (pollination == null) return { needsPartner: false, reason: "absent" };
  const text = normalize(pollination);
  if (text === "") return { needsPartner: false, reason: "absent" };
  if (anyMatch(NOT_APPLICABLE, text)) return { needsPartner: false, reason: "not-applicable" };
  if (anyMatch(SELF_NEGATED, text)) return { needsPartner: true, reason: "self-negated" };
  if (anyMatch(SELF_SUFFICIENT, text)) return { needsPartner: false, reason: "self-fertile" };
  if (anyMatch(PARTNER_REQUIRED, text)) return { needsPartner: true, reason: "partner-required" };
  return { needsPartner: false, reason: "unrecognised" };
}

/** Convenience boolean for render guards. */
export function needsPollinationPartner(pollination: string | null | undefined): boolean {
  return plantTwoVerdict(pollination).needsPartner;
}

/** Quantity the "plant two" action sets — a partner means two plants, not one. */
export const PLANT_TWO_QUANTITY = 2;
