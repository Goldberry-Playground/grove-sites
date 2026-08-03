/**
 * Pure variant-axis logic for the product buy box (design spec §"buy box":
 * Cultivar dropdown + Potted/Bareroot Format selector + Grafted/Seedling
 * Rootstock selector that together resolve to one purchasable variant). Kept
 * framework-free so the selection rules are unit tested independently of the
 * React component that renders them.
 *
 * Odoo models these as up to three attribute axes on one template — Cultivar
 * (e.g. "Honeycrisp") × Format ("Potted"/"Bareroot") × Rootstock ("M.111",
 * "Seedling") — flattened into the variant list. Any axis may be absent (a
 * product with a single format, no cultivars, or no rootstock choice); the
 * helpers degrade gracefully to fewer controls (GOL-1112).
 */
export interface SelectableVariant {
  id: number;
  cultivar?: string | null;
  format?: string | null;
  /** Rootstock / propagation axis value (e.g. "M.111", "Seedling"); null when
   *  the product has no Rootstock attribute (GOL-1112). */
  rootstock?: string | null;
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

/** Distinct rootstock values available for a given cultivar (or across all
 * variants when `cultivar` is null). Order-preserving. Empty when the product
 * has no Rootstock axis, which the buy box reads as "render no selector"
 * (GOL-1112). */
export function rootstockOptions(
  variants: SelectableVariant[],
  cultivar: string | null,
): string[] {
  const scoped = cultivar == null ? variants : variants.filter((v) => v.cultivar === cultivar);
  return distinct(scoped.map((v) => v.rootstock));
}

/**
 * Classify a rootstock label into its propagation kind so the UI can pair a
 * color-independent icon + word with the raw value (never colour alone). A
 * value naming own-root / ungrafted / seedling propagation is a "seedling";
 * everything else (a named clonal rootstock like "M.111", or the literal
 * "Grafted") is "grafted". Case-insensitive; unknown/empty defaults to
 * "grafted" — the nursery's fruit trees are grafted unless said otherwise.
 */
export function rootstockKind(value: string | null | undefined): "grafted" | "seedling" {
  return /seedling|own[\s-]?root|ungrafted|un-?grafted/i.test(value ?? "")
    ? "seedling"
    : "grafted";
}

/**
 * Resolve the variant for the current axis selection. Matches on whichever axes
 * are provided; falls back progressively so a partial selection still lands on
 * a real variant (all axes, then cultivar+format, then cultivar-only, then the
 * first variant). Returns undefined only when `variants` is empty.
 */
export function pickVariant<T extends SelectableVariant>(
  variants: T[],
  sel: { cultivar?: string | null; format?: string | null; rootstock?: string | null },
): T | undefined {
  if (variants.length === 0) return undefined;
  const byAll = variants.find(
    (v) =>
      (sel.cultivar == null || v.cultivar === sel.cultivar) &&
      (sel.format == null || v.format === sel.format) &&
      (sel.rootstock == null || v.rootstock === sel.rootstock),
  );
  if (byAll) return byAll;
  const byCultivarFormat = variants.find(
    (v) =>
      (sel.cultivar == null || v.cultivar === sel.cultivar) &&
      (sel.format == null || v.format === sel.format),
  );
  if (byCultivarFormat) return byCultivarFormat;
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
