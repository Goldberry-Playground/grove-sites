import { describe, expect, it } from "vitest";
import { SLUG_ALIASES } from "./slug-aliases";
import { isUsableSlug } from "../lib/product-path";

describe("SLUG_ALIASES (GOL-2875 R3)", () => {
  const entries = Object.entries(SLUG_ALIASES);

  it("maps usable lowercase slugs to usable lowercase slugs", () => {
    for (const [from, to] of entries) {
      expect(isUsableSlug(from), from).toBe(true);
      expect(isUsableSlug(to), to).toBe(true);
    }
  });

  it("never chains: a target is not itself a retired slug (one hop, R1)", () => {
    for (const [from, to] of entries) {
      expect(SLUG_ALIASES[to], `${from} → ${to} → ${SLUG_ALIASES[to]}`).toBeUndefined();
    }
  });

  it("never maps a slug to itself", () => {
    for (const [from, to] of entries) expect(from).not.toBe(to);
  });
});
