/**
 * Shared selected/unselected treatment for the PDP's radio-style option cards
 * (method, Format, rootstock). Selection is carried by three cues, never the
 * tint alone (WCAG 1.4.1): a 2px-equivalent border (border + ring), a filled
 * radio dot, and a light tint. Unselected cards get a quiet border and no tint
 * so two cards can never read as "both selected".
 */
export function optionCardClass(active: boolean): string {
  return active
    ? "border-primary ring-1 ring-primary bg-primary/[0.07]"
    : "border-primary/25 bg-transparent hover:border-primary/60";
}

/**
 * Nested choice inside a card (pre-order waves). Lighter than the parent so it
 * reads as subordinate; shows active only when its parent card is selected.
 */
export function subOptionClass(active: boolean): string {
  return active
    ? "border-primary bg-primary/[0.07]"
    : "border-primary/20 bg-transparent hover:border-primary/50";
}

/** Radio indicator: an empty ring when unselected, a filled dot when selected. */
export function RadioDot({ active, small = false }: { active: boolean; small?: boolean }) {
  const outer = small ? "h-3 w-3" : "h-4 w-4";
  const inner = small ? "h-1.5 w-1.5" : "h-2 w-2";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${outer} shrink-0 items-center justify-center rounded-full border ${
        active ? "border-primary" : "border-primary/40"
      }`}
    >
      {active && <span className={`${inner} rounded-full bg-primary`} />}
    </span>
  );
}
