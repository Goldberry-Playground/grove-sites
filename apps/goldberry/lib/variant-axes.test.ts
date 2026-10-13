import { describe, expect, it } from "vitest";
import { colorOptions, matchVariant, sizeOptions } from "./variant-axes";

/**
 * Pure Color / Size axis helpers for the farm PDP (GOL-3315, gom printify
 * spec Storefront §3). The picker builds its option lists from these and adds
 * to cart only what `matchVariant` returns: a variant Printify disabled is
 * archived in Odoo and never arrives in the payload, so its size must not be
 * offered for that color and no silent fallback may pick a neighbour.
 */

const v = (id: number, color: string, size: string) =>
  ({ id, name: `${color} / ${size}`, price: 28, color, size, available: true }) as never;
const variants = [v(1, "Natural", "M"), v(2, "Natural", "2XL"), v(3, "Sage", "M")];

describe("variant axes", () => {
  it("lists distinct colors in payload order", () => {
    expect(colorOptions(variants)).toEqual(["Natural", "Sage"]);
  });

  it("lists sizes available for a color only", () => {
    expect(sizeOptions(variants, "Sage")).toEqual(["M"]);
    expect(sizeOptions(variants, "Natural")).toEqual(["M", "2XL"]);
  });

  it("lists no sizes until a color is chosen on a two-axis product", () => {
    expect(sizeOptions(variants, null)).toEqual([]);
  });

  it("matches strictly, never a neighbour", () => {
    expect(matchVariant(variants, { color: "Natural", size: "2XL" })?.id).toBe(2);
    expect(matchVariant(variants, { color: "Sage", size: "2XL" })).toBeNull();
    expect(matchVariant(variants, { color: null, size: "M" })).toBeNull();
    expect(matchVariant(variants, { color: "Natural", size: null })).toBeNull();
  });

  it("matches a single-axis product (sizes only)", () => {
    const sizesOnly = [v(5, "", "M"), v(6, "", "L")];
    expect(colorOptions(sizesOnly)).toEqual([]);
    expect(sizeOptions(sizesOnly, null)).toEqual(["M", "L"]);
    expect(matchVariant(sizesOnly, { color: null, size: "L" })?.id).toBe(6);
  });

  it("matches a single-axis product (colors only)", () => {
    const colorsOnly = [v(7, "Natural", ""), v(8, "Sage", "")];
    expect(sizeOptions(colorsOnly, "Sage")).toEqual([]);
    expect(matchVariant(colorsOnly, { color: "Sage", size: null })?.id).toBe(8);
  });

  it("treats a variant with neither axis as the only choice", () => {
    const plain = [v(9, "", "")];
    expect(matchVariant(plain, { color: null, size: null })?.id).toBe(9);
  });

  it("tolerates payloads that predate the axes (color/size undefined)", () => {
    const legacy = [{ id: 10, name: "Tee", price: 28, available: true }] as never[];
    expect(colorOptions(legacy)).toEqual([]);
    expect(sizeOptions(legacy, null)).toEqual([]);
    expect(matchVariant(legacy, { color: null, size: null })?.id).toBe(10);
  });
});
