import { describe, expect, it } from "vitest";
import { SEED_SHIP_TO_STATES, SHIP_TO_STATES, US_SHIP_TO_STATES } from "./ship-to-states";

describe("SEED_SHIP_TO_STATES (GOL-3258, Josh 2026-10-13)", () => {
  const codes = SEED_SHIP_TO_STATES.map((s) => s.code);

  it("is the lower 48 plus DC: no Hawaii, no Alaska, no duplicates", () => {
    expect(codes).toHaveLength(49);
    expect(new Set(codes).size).toBe(49);
    expect(codes).not.toContain("HI");
    expect(codes).not.toContain("AK");
    expect(codes).toContain("DC");
    for (const west of ["CA", "WA", "OR", "TX", "CO"]) expect(codes).toContain(west);
  });

  it("is a superset of the tree list, so no tree state loses seeds", () => {
    for (const s of SHIP_TO_STATES) expect(codes).toContain(s.code);
  });

  it("is alphabetical by name for the dropdown, two-letter codes only", () => {
    const names = SEED_SHIP_TO_STATES.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const c of codes) expect(c).toMatch(/^[A-Z]{2}$/);
  });
});

describe("US_SHIP_TO_STATES (GOL-3315, Printify shirts: 50 states + DC)", () => {
  const codes = US_SHIP_TO_STATES.map((s) => s.code);

  it("has exactly 51 distinct entries, alphabetical by name", () => {
    expect(codes).toHaveLength(51);
    expect(new Set(codes).size).toBe(51);
    const names = US_SHIP_TO_STATES.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("is the seed list plus Alaska and Hawaii, and nothing more (no territories)", () => {
    for (const s of SEED_SHIP_TO_STATES) expect(codes).toContain(s.code);
    expect(codes).toContain("AK");
    expect(codes).toContain("HI");
    for (const territory of ["PR", "VI", "GU", "AS", "MP"]) expect(codes).not.toContain(territory);
  });
});
