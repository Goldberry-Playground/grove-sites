import type { GrowingFacts } from "@grove/odoo-client";
import { needsPollinationPartner, PLANT_TWO_QUANTITY } from "../../../lib/plant-two";

/**
 * "At a glance" decision card + "plant two" hint (GOL-2734).
 *
 * Both live in the PDP's right column directly under the buy box, so the six
 * facts that actually decide a purchase sit beside the price instead of several
 * screens below it. The FULL `SpecBlock` table still renders lower down with
 * every row — this is a decision summary, not a replacement (single source of
 * facts, two densities).
 *
 * These render once each. On phones the PDP grid collapses to one column, so the
 * same DOM stacks in decision order (photos → buy box → zone check → at a glance
 * → plant two) with no breakpoint-duplicated markup.
 */

/** The six decision facts, in the order a buyer asks them. */
const GLANCE_ORDER = [
  "zones",
  "sun",
  "size",
  "yearsToFruit",
  "spacing",
  "chillHours",
] as const;

/**
 * Is an authored fact worth showing in a *glance* card? Blanks are obviously
 * out. So are the listing spec's non-fruiting sentinels ("Not applicable" for
 * chill hours / years to fruit on an ornamental): in the full spec table they
 * are a meaningful "we checked, it doesn't apply", but in a six-tile decision
 * summary they are noise that crowds out the facts that do decide the buy.
 */
function present(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value.trim();
  if (v === "") return null;
  if (/^(n\/?a|none|not applicable|-+|—)$/i.test(v)) return null;
  return v;
}

function capitalize(v: string | null): string | null {
  if (!v) return v;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** Build the tiles that have data. Empty array → the caller renders nothing. */
function glanceTiles(facts: GrowingFacts): Array<{ key: string; label: string; value: string }> {
  const zones =
    facts.zoneMin != null && facts.zoneMax != null
      ? `${facts.zoneMin}–${facts.zoneMax}`
      : facts.zoneMin != null
        ? `${facts.zoneMin}+`
        : facts.zoneMax != null
          ? `${facts.zoneMax} and cooler`
          : null;

  // Mature size is one tile from two facts. The label names exactly what is in
  // it: "height × spread" only when both are authored, so a listing with only a
  // height never implies a spread it doesn't have.
  const height = present(facts.matureSize);
  const spread = present(facts.matureSpread);
  const size =
    height && spread
      ? { label: "Mature height × spread", value: `${height} × ${spread}` }
      : height
        ? { label: "Mature height", value: height }
        : spread
          ? { label: "Mature spread", value: spread }
          : null;

  const byKey: Record<(typeof GLANCE_ORDER)[number], { label: string; value: string } | null> = {
    zones: zones ? { label: "USDA zones", value: zones } : null,
    sun: present(capitalize(facts.sun)) ? { label: "Sun", value: capitalize(facts.sun)! } : null,
    size,
    yearsToFruit: present(facts.yearsToFruit)
      ? { label: "Years to fruit", value: present(facts.yearsToFruit)! }
      : null,
    spacing: present(facts.spacing) ? { label: "Spacing", value: present(facts.spacing)! } : null,
    chillHours: present(facts.chillHours)
      ? { label: "Chill hours", value: present(facts.chillHours)! }
      : null,
  };

  return GLANCE_ORDER.flatMap((key) => {
    const tile = byKey[key];
    return tile ? [{ key, ...tile }] : [];
  });
}

/**
 * Compact two-column key-facts card. Renders nothing when none of the six facts
 * exist, so a sparsely-filled listing shows no empty shell (commerce never
 * blocks on content — same rule as `SpecBlock`).
 */
export function AtAGlance({ facts }: { facts?: GrowingFacts }) {
  if (!facts) return null;
  const tiles = glanceTiles(facts);
  if (tiles.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg border border-primary/10 bg-secondary/10 p-4" aria-labelledby="glance-heading">
      {/* The `!` modifiers are load-bearing, not shouting. globals.css styles
          every h1/h2/h3 UNLAYERED (`font-family: display; font-weight: 300;
          letter-spacing: -.02em`), and unlayered CSS beats Tailwind's
          `@layer utilities` no matter the specificity — without them this card
          title renders as a thin 14px display serif, i.e. a caption. These three
          land it on exactly the treatment the ZoneCheck card's label above it
          already uses: body face (`font-sans` = --grove-font-body), weight 600.
          (`text-sm` needs no `!`: the base rule sets no font-size.) */}
      <h2
        id="glance-heading"
        className="mb-3 text-sm font-sans! font-semibold! tracking-normal! text-foreground"
      >
        At a glance
      </h2>
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.key} className="rounded border border-primary/10 bg-white/60 px-3 py-2">
            <dt className="text-xs text-ink-soft">{t.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">{t.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * "Plant two" hint. Renders ONLY when `lib/plant-two.ts` says the authored
 * pollination fact explicitly requires a partner — never on a self-fertile
 * listing, never on prose the rule doesn't recognise (see that module for the
 * ordered rule and its tests).
 *
 * The body is the authored fact itself rather than copy we invent, so the claim
 * on the page is the one Odoo carries. The action only sets the quantity
 * stepper — it never adds to the cart on the buyer's behalf, and the stepper
 * stays editable, so the nudge is reversible and visible (no sneak-into-basket).
 */
export function PlantTwoHint({
  pollination,
  quantity,
  onPlantTwo,
}: {
  pollination: string | null | undefined;
  quantity: number;
  onPlantTwo: () => void;
}) {
  if (!needsPollinationPartner(pollination)) return null;

  const fact = present(pollination);
  const satisfied = quantity >= PLANT_TWO_QUANTITY;

  return (
    <div className="mt-6 rounded-lg border border-accent/40 bg-accent/5 p-4">
      <p className="flex items-start gap-2 text-sm">
        {/* Decorative: two saplings. The requirement is carried by the words, so
            nothing here depends on colour or on the icon rendering (WCAG 1.4.1). */}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-primary">
          <path d="M8 2 3 12h4v6h2v-6h4L8 2Z" />
          <path d="M17 8.5 13 18h3.2v3h1.6v-3H21l-4-9.5Z" />
        </svg>
        <span>
          <strong className="font-semibold text-foreground">Plant two.</strong>{" "}
          <span className="text-ink-soft">
            {fact ? `${fact.replace(/[.\s]+$/, "")}.` : "This one needs a partner to set fruit."}
          </span>
        </span>
      </p>
      {/* The button stays MOUNTED once the pair is reached. Unmounting it on
          click dropped keyboard focus to <body> on a ~2300px page (WCAG 2.4.3,
          GOL-2741). Instead it goes inert in place: `aria-disabled` (not
          `disabled`, which would also eject focus) plus a label that reports
          the new state. Lowering the stepper below two re-arms it. */}
      <button
        type="button"
        onClick={satisfied ? undefined : onPlantTwo}
        aria-disabled={satisfied || undefined}
        className={
          satisfied
            ? "mt-3 inline-flex min-h-11 cursor-default items-center rounded border border-primary/15 bg-transparent px-4 text-sm font-semibold text-ink-soft"
            : "mt-3 inline-flex min-h-11 items-center rounded border border-primary/30 bg-white/70 px-4 text-sm font-semibold text-primary transition hover:border-primary hover:bg-white"
        }
      >
        {/* One template literal, not `to {PLANT_TWO_QUANTITY}`: JSX would split
            that into two text nodes and SSR would emit `to <!-- -->2`, which
            breaks any plain-text probe of the rendered document (the e2e lane
            greps the PDP HTML rather than navigating 20 image-heavy pages). */}
        {satisfied ? `Quantity set to ${PLANT_TWO_QUANTITY}` : `Set quantity to ${PLANT_TWO_QUANTITY}`}
      </button>
      {/* One PERSISTENTLY MOUNTED live region, not a swapped-in element: the
          quantity stepper this button moves lives elsewhere in the buy box, and a
          live region that only mounts at the moment of the change is unreliably
          announced. Empty until the pair is reached, then it confirms. */}
      <p
        role="status"
        className={
          satisfied ? "mt-3 text-sm stock-line stock-line--in" : "sr-only"
        }
      >
        {satisfied ? `Quantity ${quantity}, enough for a pair.` : ""}
      </p>
    </div>
  );
}
