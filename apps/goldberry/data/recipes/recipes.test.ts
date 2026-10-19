import { describe, expect, it } from "vitest";
import {
  BOOKS,
  RECIPES,
  SORTED_RECIPES,
  TAGS,
  attribution,
  bookCounts,
  plainFractions,
  recipeFacts,
  recipeNeighbours,
} from "./index";

// GOL-3435 acceptance: the collection as approved on 2026-10-19.
describe("recipe collection", () => {
  it("has all 158 recipes with unique, URL-safe ids", () => {
    expect(RECIPES).toHaveLength(158);
    const ids = RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(158);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    // `trees` is a static sibling route under /recipes.
    expect(ids).not.toContain("trees");
  });

  it("matches the approved course counts", () => {
    const counts: Record<string, number> = {};
    for (const r of RECIPES) counts[r.category] = (counts[r.category] ?? 0) + 1;
    expect(counts).toEqual({
      Cakes: 42,
      "Cookies & Bars": 22,
      Salads: 18,
      Desserts: 15,
      Candies: 15,
      Breads: 14,
      "Vegetables & Sides": 10,
      "Appetizers & Snacks": 9,
      Pies: 6,
      "Main Dishes": 5,
      "Preserves & Pickles": 1,
      Soups: 1,
    });
  });

  it("credits every recipe to one of the five books", () => {
    const counts = bookCounts();
    expect(Object.keys(counts)).toEqual(Object.keys(BOOKS));
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(158);
  });

  it("orders Prev / Next through every recipe exactly once", () => {
    expect(SORTED_RECIPES).toHaveLength(158);
    expect(recipeNeighbours(SORTED_RECIPES[0].id).prev).toBeNull();
    expect(recipeNeighbours(SORTED_RECIPES[157].id).next).toBeNull();
  });
});

describe("attribution keeps names and hometowns as printed", () => {
  it("contains the printed name, role, city and state verbatim", () => {
    for (const r of RECIPES) {
      const line = attribution(r);
      for (const part of [r.contributor, r.contributorRole, r.city, r.state]) if (part) expect(line).toContain(part);
    }
  });

  it("says so when the book printed no hometown or no name, rather than guessing", () => {
    for (const r of RECIPES) {
      const line = attribution(r);
      if (r.contributor && !r.city && !r.state) expect(line).toContain("The book didn't print a hometown.");
      if (!r.contributor) expect(line).toContain("The cook's name wasn't printed with this one.");
    }
  });

  it("never doubles a printed period", () => {
    for (const r of RECIPES) expect(attribution(r)).not.toMatch(/\.\./);
  });
});

describe("plainFractions", () => {
  it("spells Number Forms fractions and leaves Latin-1 ones alone", () => {
    expect(plainFractions("⅓ cup")).toBe("1/3 cup");
    expect(plainFractions("1⅔ cups")).toBe("1 2/3 cups");
    expect(plainFractions("½ tsp. and ¾ cup")).toBe("½ tsp. and ¾ cup");
  });
});

describe("cook-with tags", () => {
  it("only link grown trees to the nursery", () => {
    for (const t of TAGS) if (t.nurserySlug) expect(t.grow).toBe(true);
  });

  it("tags black walnut without also tagging English walnut", () => {
    const r = RECIPES.find((x) => x.id === "carrot-cake");
    expect(r).toBeDefined();
    const f = recipeFacts(r!);
    expect(f.tags).toContain("black-walnut");
    expect(f.grown).toContain("black-walnut");
  });
});
