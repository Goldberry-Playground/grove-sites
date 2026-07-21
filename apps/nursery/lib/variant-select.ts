/**
 * Pure variant-axis logic for the product buy box (design spec §"buy box":
 * Cultivar dropdown + Potted/Bareroot Format selector that together resolve to
 * one purchasable variant). Kept framework-free so the selection rules are unit
 * tested independently of the React component that renders them.
 *
 * Odoo models these as two attribute axes on one template — Cultivar (e.g.
 * "Honeycrisp") × Format ("Potted"/"Bareroot") — flattened into the variant
 * list. Either axis may be absent (a product with a single format, or no
 * cultivars); the helpers degrade gracefully to fewer controls.
 */
export interface SelectableVariant {
  id: number;
  cultivar?: string | null;
  format?: string | null;
}

/** Distinct, order-preserving cultivar values (drops null/empty). */
export function cultivarOptions(variants: SelectableVariant[]): string[] {
  return distinct(variants.map((v) => v.cultivar));
}

/** Distinct format values available for a given cultivar (or across all
 * variants when `cultivar` is null). Order-preserving. */
export function formatOptions(
  variants: SelectableVariant[],
  cultivar: string | null,
): string[] {
  const scoped = cultivar == null ? variants : variants.filter((v) => v.cultivar === cultivar);
  return distinct(scoped.map((v) => v.format));
}

/**
 * Resolve the variant for the current axis selection. Matches on whichever axes
 * are provided; falls back progressively so a partial selection still lands on
 * a real variant (cultivar-only match, then the first variant). Returns
 * undefined only when `variants` is empty.
 */
export function pickVariant<T extends SelectableVariant>(
  variants: T[],
  sel: { cultivar?: string | null; format?: string | null },
): T | undefined {
  if (variants.length === 0) return undefined;
  const byBoth = variants.find(
    (v) =>
      (sel.cultivar == null || v.cultivar === sel.cultivar) &&
      (sel.format == null || v.format === sel.format),
  );
  if (byBoth) return byBoth;
  const byCultivar =
    sel.cultivar != null ? variants.find((v) => v.cultivar === sel.cultivar) : undefined;
  return byCultivar ?? variants[0];
}

/**
 * Strip a leading Odoo internal reference code from a variant display name
 * (GOL-678). Odoo prefixes variant names with the bracketed `default_code`,
 * e.g. `[FIG-AJ-BR] Fig (Adriatic JH, Bareroot)` — an internal SKU that must
 * never reach customers. Removes a single leading `[...]` token and its
 * following whitespace; names without one pass through unchanged.
 */
export function stripVariantCode(name: string): string {
  return name.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
}

function distinct(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}
