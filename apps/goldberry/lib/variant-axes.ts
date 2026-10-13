import type { ProductVariant } from "@grove/odoo-client";

/**
 * Pure Color / Size axis helpers for the farm PDP (GOL-3315, gom printify spec
 * Storefront §3). Odoo serializes each Printify variant with `color` and `size`
 * ("" when the product lacks that attribute). A variant disabled in Printify is
 * archived in Odoo and simply absent from the payload, so "available sizes for
 * this color" falls out of the list itself: nothing is inferred.
 */

/** Distinct non-empty values in payload order (the backend's attribute order). */
function distinct(values: readonly string[]): string[] {
  return values.filter((value, i) => value !== "" && values.indexOf(value) === i);
}

function colorOf(v: ProductVariant): string {
  return v.color ?? "";
}

function sizeOf(v: ProductVariant): string {
  return v.size ?? "";
}

/** The Color options to offer, in order; empty when the product has no Color axis. */
export function colorOptions(variants: readonly ProductVariant[]): string[] {
  return distinct(variants.map(colorOf));
}

/**
 * The Size options for `color`, in order. On a product with a Color axis this is
 * empty until a color is chosen (sizes differ per color once Printify disables
 * a combination); on a sizes-only product it is every size.
 */
export function sizeOptions(variants: readonly ProductVariant[], color: string | null): string[] {
  const hasColor = colorOptions(variants).length > 0;
  if (hasColor && !color) return [];
  return distinct(variants.filter((v) => !hasColor || colorOf(v) === color).map(sizeOf));
}

/**
 * Strict: the exact variant for the chosen axes, or null. Never a silent
 * fallback to a neighbouring size or color, since that is what would put an
 * archived or wrong shirt in the cart. An axis the product lacks is not
 * required; a product with neither axis matches its only variant.
 */
export function matchVariant(
  variants: readonly ProductVariant[],
  sel: { color: string | null; size: string | null },
): ProductVariant | null {
  const needColor = colorOptions(variants).length > 0;
  const needSize = variants.some((v) => sizeOf(v) !== "");
  if ((needColor && !sel.color) || (needSize && !sel.size)) return null;
  return (
    variants.find(
      (v) => (!needColor || colorOf(v) === sel.color) && (!needSize || sizeOf(v) === sel.size),
    ) ?? null
  );
}
