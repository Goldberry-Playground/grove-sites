import { describe, it, expect } from "vitest";
import type { Product } from "@grove/odoo-client";
import { LEAD_SELLERS, selectLeadSellers } from "./featured";

const p = (id: number, name: string, available = true): Product =>
  ({ id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), price: 12, available, tags: [] }) as unknown as Product;

// Shaped like the prod nursery catalog on 2026-10-15.
const catalog: Product[] = [
  p(93, "American Chestnut"),
  p(8, "Chinese Chestnut"),
  p(10, "Fig"),
  p(3, "Apple"),
  p(19, "Service Berry", false),
  p(13, "Mulberry", false),
  p(22, "Chestnut Grove (5-Tree Native Bundle)"),
  p(132, "Mountain Mama Package (5-Tree Appalachian Mix)"),
  p(144, "Walnut Holler (5-Tree Native Mix)"),
  p(87, "Black Walnut"),
];

describe("lead sellers (2026-10-15)", () => {
  it("leads with the three 5-tree bundles, then fig", () => {
    expect(selectLeadSellers(catalog).map((x) => x.id)).toEqual([22, 132, 144, 10]);
  });

  it("while Walnut Holler is unpublished, fig and apple fill the row", () => {
    const live = catalog.filter((x) => x.id !== 144);
    expect(selectLeadSellers(live).map((x) => x.id)).toEqual([22, 132, 10, 3]);
  });

  it("'walnut holler' does not match the single Black Walnut tree", () => {
    const live = catalog.filter((x) => x.id !== 144);
    expect(selectLeadSellers(live, 3).map((x) => x.id)).not.toContain(87);
  });

  it("'chestnut grove' does not match single chestnut trees", () => {
    // With the Chestnut Grove bundle gone, the term matches nothing: the
    // curated slots are Mountain Mama, Fig, Apple, and only the 4th card is
    // an in-stock backfill (never a "chestnut grove" match on a single tree).
    const withoutBundle = catalog.filter((x) => x.id !== 22);
    expect(selectLeadSellers(withoutBundle, 3).map((x) => x.id)).toEqual([132, 144, 10]);
  });

  it("starts with the bundle terms", () => {
    expect(LEAD_SELLERS.slice(0, 3)).toEqual(["chestnut grove", "mountain mama", "walnut holler"]);
  });
});
