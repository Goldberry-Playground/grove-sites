import { US_STATE_NAMES } from "../lib/shipping-estimate";
import {
  consultMixOutlook,
  type ComplianceMap,
  type ConsultMixOutlook,
} from "../lib/plant-compliance";

/**
 * Join a list the way a person writes one: "A", "A and B", "A, B and C".
 * Oxford comma deliberately omitted (Grove brand voice, GOL-589).
 */
function sentenceList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The botanical as a reader wants it, not as the compliance field stores it.
 * Two layers come off, in this order (GOL-3054 redline C):
 *
 * 1. A trailing gloss the gate ignores (`Morus alba 'Maple Leaf' (hybrid white
 *    mulberry)`), which would otherwise render as nested parentheses inside our
 *    own parenthetical.
 * 2. A quoted cultivar epithet (`Morus alba 'Maple Leaf'` -> `Morus alba`).
 *    CMO sign-off: for Indiana / Ohio / Wisconsin the exclusion list is exactly
 *    one line, so that line IS the whole disclosure for three states. A cultivar
 *    name invites the wrong inference, that only that one cultivar is
 *    restricted, when the gate blocks on the species. Display what we block on,
 *    and it then agrees with the body copy two lines above ("white mulberry").
 *
 * The palette keeps the raw string, because that is what `parseTaxon` must agree
 * with; only the display is trimmed. Straight and curly quotes both, since
 * catalog master data is hand-entered.
 */
function displayBotanical(botanical: string): string {
  const trimmed = botanical
    .replace(/\s*\([^()]*\)\s*$/, "")
    .replace(/\s*['’‘"“][^'’‘"”]*['’”"]\s*$/, "")
    .trim();
  return trimmed || botanical;
}

export interface ConsultCarveOutNoticeProps {
  /** Canonical 2-letter destination the shopper picked. */
  state: string;
  /** Live carve-out map (feed-first, snapshot fallback) — `resolveCompliance()`. */
  compliance: ComplianceMap;
  /**
   * Which surface is asking. Only the closing next-step line differs: on the PDP
   * the shopper has not committed anything yet, at checkout they are about to
   * pay a deposit, so "before anything ships" is the reassurance that matters.
   */
  surface: "pdp" | "checkout";
  /** Pre-computed outlook, when the caller already derived it (avoids a re-walk). */
  outlook?: ConsultMixOutlook;
}

/**
 * Honest constraint notice for a **consult-built** mix (Odoo
 * `grove_consult_built`, templates 134/135) shipping into a state that restricts
 * part of our palette — GOL-3028, the storefront half of GOL-3019 §4.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * A consult-built SKU agrees its contents in a consult AFTER the deposit, so at
 * deposit time there is nothing true to declare (GOL-2972's palette-ceiling
 * rule). Until GOL-3019 the backend fail-safed that empty declaration into a
 * hard 400 for the four reachable regulated states (FL, IN, OH, WI), so the
 * customer could not even pay the deposit. GOL-3019 moved the real decision to
 * mix time and records the excluded taxa on the order. That recovers the sale,
 * and it creates this obligation: the customer must learn the mix is
 * **constrained for their destination BEFORE they pay**, not at the consult.
 *
 * ── Why it is reassuring, not alarming ──────────────────────────────────────
 * The constraint is narrow and the number says so: Florida takes three of
 * seventeen species off the list, Indiana / Ohio / Wisconsin take one. A full
 * 100-tree food forest is genuinely deliverable in all four. So the notice leads
 * with what the shopper DOES get ("14 of our 17 food-forest species"), then
 * names the exclusions plainly. Leading with the loss would overstate it.
 *
 * The denominator is deliberately scoped to the MIX, not to the nursery
 * (GOL-3054 redline A). "the 14 species we grow" was a claim about the farm, and
 * a false one: our own content names hazelnut, persimmon, shagbark hickory,
 * elderberry and serviceberry besides. It was also unsafe, because
 * `CONSULT_PALETTE` is a hand snapshot, so the day a fifteenth single publishes
 * the sentence goes wrong on a payment page with nothing in CI to notice.
 * Scoped to the mix, the worst case is "slightly conservative".
 *
 * ── Source of truth ─────────────────────────────────────────────────────────
 * Every exclusion is derived by running the palette through the same
 * `evaluateCompliance` mirror of `plant_compliance.evaluate_line` that the
 * checkout gate uses, against the live `compliance.carve_outs` feed. The notice
 * therefore cannot name a species the gate would allow, or miss one it blocks.
 *
 * ── Design lenses ───────────────────────────────────────────────────────────
 * - **Accessibility / colour-blind safety**: the icon is `aria-hidden`, and
 *   every signal is carried in words ("Not for Florida:"), never by colour. The
 *   panel reads identically in grayscale and under deuteranopia / protanopia /
 *   tritanopia. Body copy is `text-foreground` / `text-foreground/70` on the
 *   accent tint, clearing WCAG AA.
 * - **Visual hierarchy**: one bold claim line, one explanatory paragraph, one
 *   labelled exclusion list, one next step. A stranger reads the headline number
 *   in two seconds.
 * - **Gestalt / common region**: the bordered tinted region groups the whole
 *   disclosure so it cannot be mistaken for generic shipping copy.
 * - **Ethics**: this is anti-dark-pattern by construction. The constraint is
 *   disclosed before payment, in the shopper's own terms, with nothing hidden
 *   behind a later step.
 *
 * Copy is SIGNED OFF by CMO-Sora on GOL-3054 (2026-10-05) with redlines A, B
 * and C applied — it is a delivery promise, not a dev string. Every ratified
 * string is pinned verbatim in `consult-carveout-copy.test.ts`, which is a
 * sign-off condition: a delivery promise any future refactor can silently
 * reword is not signed off. Strings live only here, in
 * `shipping-estimator.tsx` and on the Format cards in `product-view.tsx`, so a
 * redline stays a small change.
 */
export function ConsultCarveOutNotice({
  state,
  compliance,
  surface,
  outlook,
}: ConsultCarveOutNoticeProps) {
  const stateName = state ? (US_STATE_NAMES[state] ?? state) : "";
  const mix = outlook ?? consultMixOutlook(state, compliance);
  // Nothing we actually grow is restricted here (a carve-out rule exists for the
  // state but names no palette species). Saying "constrained" then listing
  // nothing would be noise, so the notice stays silent rather than vague.
  if (!state || mix.excluded.length === 0) return null;

  const reasons = sentenceList(mix.excludedTaxonLabels);

  return (
    <div
      className="rounded border border-accent/30 bg-accent/5 p-3"
      data-testid="consult-carveout-notice"
    >
      <p className="flex items-start gap-1.5 text-sm font-medium text-foreground">
        {/* A bordered circle around a plain ASCII letter, not a ⓘ codepoint:
            the enclosed-alphanumeric block is missing from several of the
            fallback fonts a shopper may land on, and a tofu box is worse than
            no icon at all. Same construction as the carve-out panel's "!" so
            the two notices read as one family. Decorative only — the words
            carry the meaning. */}
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent text-[0.6rem] font-bold leading-none text-accent"
        >
          i
        </span>
        <span>
          Your {stateName} mix: {mix.clearedCount} of our {mix.paletteCount}{" "}
          food-forest species
        </span>
      </p>
      <p className="mt-1.5 text-xs text-foreground/70">
        We ship to {stateName}, which restricts {reasons} for plant-health reasons.
        So your list comes from the other {mix.clearedCount}. That’s still a full
        food forest.
      </p>
      <p className="mt-2 text-xs font-medium text-foreground">
        Not for {stateName}:
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-foreground/70">
        {mix.excluded.map((species) => (
          <li key={species.templateId} className="flex items-start gap-1.5">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
            <span>
              {species.label}{" "}
              <span className="italic">({displayBotanical(species.botanical)})</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-foreground/70">
        {surface === "checkout"
          ? `Your deposit reserves the consult, not a fixed plant list. We confirm every plant with you, cleared for ${stateName}, before anything ships.`
          : `We confirm your exact list with you in the consult, cleared for ${stateName}, before anything ships. Your shipping is quoted then too, once we know how many boxes your trees pack into.`}
      </p>
    </div>
  );
}
