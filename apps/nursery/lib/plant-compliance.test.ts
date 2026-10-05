import { describe, expect, it } from "vitest";
import type { ShippingRateFeed } from "@grove/odoo-client";
import {
  SNAPSHOT_COMPLIANCE,
  SNAPSHOT_SUBSTITUTES,
  evaluateCompliance,
  isTaxonBlocked,
  parseTaxon,
  resolveCompliance,
  resolveSubstitutes,
  ruleFor,
} from "./plant-compliance";
import { SNAPSHOT_ZONE_MAP } from "./shipping-estimate";

/**
 * Mirror tests for the per-product plant-health carve-out gate (GOL-2973).
 *
 * Backend source of truth: grove-odoo-modules
 * `grove_headless/models/plant_compliance.py`. These assertions are written as
 * the *behaviours* that module guarantees, so a divergence shows up here rather
 * than as a shopper who was promised delivery and refused at checkout.
 */

const map = SNAPSHOT_COMPLIANCE;

describe("parseTaxon — mirror of plant_compliance.parse_taxon", () => {
  it("splits genus + species, lowercased", () => {
    expect(parseTaxon("Castanea mollissima")).toEqual({ genus: "castanea", species: "mollissima" });
  });

  it("ignores a cultivar epithet", () => {
    expect(parseTaxon("Morus alba 'Maple Leaf'")).toEqual({ genus: "morus", species: "alba" });
  });

  it("treats a bare genus as species-less", () => {
    expect(parseTaxon("Cornus")).toEqual({ genus: "cornus", species: null });
  });

  it("drops a non-alphabetic species token like Python's isalpha()", () => {
    // "spp." is NOT alphabetic, so prod template 22's "Castanea spp." resolves
    // to the bare genus — which is what makes the FL chestnut block fire.
    expect(parseTaxon("Castanea spp.")).toEqual({ genus: "castanea", species: null });
  });

  it("returns null for empty, whitespace, and an unparseable first token", () => {
    expect(parseTaxon("")).toBeNull();
    expect(parseTaxon(null)).toBeNull();
    expect(parseTaxon("   ")).toBeNull();
    // The legacy "Bundle: …" naming is deliberately unparseable — fail-safe.
    expect(parseTaxon("Bundle: Food Forest (50)")).toBeNull();
  });
});

describe("carve-out lookup", () => {
  it("prefers the genus+species key over the bare genus", () => {
    expect(ruleFor({ genus: "morus", species: "alba" }, map)?.key).toBe("morus alba");
    // Morus rubra (red mulberry) matches nothing — the restriction is species-level.
    expect(ruleFor({ genus: "morus", species: "rubra" }, map)).toBeNull();
    expect(ruleFor({ genus: "morus", species: null }, map)).toBeNull();
  });

  it("blocks chestnut into FL/OR/WA and nowhere else", () => {
    const castanea = { genus: "castanea", species: null };
    for (const state of ["FL", "OR", "WA"]) {
      expect(isTaxonBlocked(castanea, state, map), `castanea → ${state}`).toBe(true);
    }
    for (const state of ["WV", "VA", "GA", "OH"]) {
      expect(isTaxonBlocked(castanea, state, map), `castanea → ${state}`).toBe(false);
    }
  });

  it("leaves an unrestricted taxon alone everywhere", () => {
    expect(isTaxonBlocked({ genus: "malus", species: "domestica" }, "FL", map)).toBe(false);
  });

  it("regulated_states is exactly the union of every rule's states", () => {
    const union = [
      ...new Set(Object.values(map.carveOuts).flatMap((r) => r.states)),
    ].sort();
    expect(map.regulatedStates.slice().sort()).toEqual(union);
  });
});

describe("evaluateCompliance", () => {
  const base = { compliance: map, substitutes: SNAPSHOT_SUBSTITUTES };

  it("is clear before a state is picked", () => {
    expect(evaluateCompliance({ ...base, state: "", botanicalName: "Castanea spp." }).kind).toBe(
      "clear",
    );
  });

  it("restricts a declared chestnut into Florida and names the swap", () => {
    const v = evaluateCompliance({ ...base, state: "FL", botanicalName: "Castanea spp." });
    expect(v).toMatchObject({
      kind: "restricted",
      taxonKey: "castanea",
      taxonLabel: "chestnut",
      substitute: { label: "Shagbark Hickory", botanical: "Carya ovata" },
    });
  });

  it("clears the same chestnut into a green state with no carve-out", () => {
    expect(evaluateCompliance({ ...base, state: "WV", botanicalName: "Castanea spp." }).kind).toBe(
      "clear",
    );
  });

  it("fail-safes an undeclared botanical into a REGULATED state only", () => {
    // Consult-built mix (templates 134/135): no declared botanical by design.
    expect(evaluateCompliance({ ...base, state: "FL", botanicalName: "" }).kind).toBe("unconfirmed");
    expect(evaluateCompliance({ ...base, state: "OH", botanicalName: null }).kind).toBe(
      "unconfirmed",
    );
    // Unregulated green states are untouched — the gate only ever tightens.
    expect(evaluateCompliance({ ...base, state: "WV", botanicalName: "" }).kind).toBe("clear");
    expect(evaluateCompliance({ ...base, state: "GA", botanicalName: null }).kind).toBe("clear");
  });

  it("the four green states a consult-built mix fail-safes into are FL/IN/OH/WI", () => {
    // The GOL-2971 blast radius: every green destination that carries a rule.
    const green = SNAPSHOT_ZONE_MAP.greenStates;
    const failsafed = green.filter(
      (s) => evaluateCompliance({ ...base, state: s, botanicalName: "" }).kind === "unconfirmed",
    );
    expect(failsafed.sort()).toEqual(["FL", "IN", "OH", "WI"]);
  });

  it("stays silent for a compliance-exempt product, exactly like checkout", () => {
    expect(
      evaluateCompliance({
        ...base,
        state: "FL",
        botanicalName: "Castanea spp.",
        complianceExempt: true,
      }).kind,
    ).toBe("clear");
    expect(
      evaluateCompliance({ ...base, state: "FL", botanicalName: "", complianceExempt: true }).kind,
    ).toBe("clear");
  });

  it("stays silent for a substitution bundle, exactly like checkout (GOL-3015)", () => {
    // Template 132 is deliberately Castanea-led: a bundle declares the CEILING
    // of its palette (GOL-2961/GOL-2972), so the taxon gate WOULD block it into
    // Florida. Checkout doesn't: the phantom Kit BoM explodes the bundle and
    // swaps the chestnut out per destination (GOL-2237), so the line ships. The
    // PDP must not say "Not cleared for Florida" about an order we will fulfil.
    const blocked = evaluateCompliance({ ...base, state: "FL", botanicalName: "Castanea spp." });
    expect(blocked.kind).toBe("restricted");
    expect(
      evaluateCompliance({
        ...base,
        state: "FL",
        botanicalName: "Castanea spp.",
        shipsAllGreenStates: true,
      }).kind,
    ).toBe("clear");
    // Also lifts the undeclared-botanical fail-safe into a regulated state: a
    // substituted bundle is resolved per destination, so there is nothing left
    // to fail safe about.
    expect(
      evaluateCompliance({ ...base, state: "FL", botanicalName: "", shipsAllGreenStates: true })
        .kind,
    ).toBe("clear");
  });

  it("the substitution flag clears every regulated state, and only green ones (GOL-3015)", () => {
    // Green ∩ regulated is FL/IN/OH/WI (GOL-2971). All four go quiet for a
    // substituted bundle. The flag does NOT widen the green list — that gate
    // runs before this module is ever consulted (`shipsTo` in the estimator),
    // which is why there is no non-green case to assert here.
    for (const state of ["FL", "IN", "OH", "WI"]) {
      expect(
        evaluateCompliance({
          ...base,
          state,
          botanicalName: "Morus alba",
          shipsAllGreenStates: true,
        }).kind,
      ).toBe("clear");
    }
    // Sanity: without the flag, Morus alba is blocked out of IN/OH/WI.
    expect(
      evaluateCompliance({ ...base, state: "IN", botanicalName: "Morus alba" }).kind,
    ).toBe("restricted");
  });

  it("absent / false substitution flag changes nothing (no GOL-2973 regression)", () => {
    // The field is absent on a grove_headless build predating 19.0.1.63.0 and
    // false catalog-wide while prod holds zero mrp.bom (GOL-2949), so "inert
    // until the BoMs are seeded" has to be a pinned behaviour, not a hope.
    for (const extra of [{}, { shipsAllGreenStates: false }, { shipsAllGreenStates: undefined }]) {
      expect(
        evaluateCompliance({ ...base, state: "FL", botanicalName: "Castanea spp.", ...extra }).kind,
      ).toBe("restricted");
      expect(
        evaluateCompliance({ ...base, state: "FL", botanicalName: null, ...extra }).kind,
      ).toBe("unconfirmed");
    }
  });

  it("falls back to the botanical name when a taxon has no plain-language label", () => {
    const v = evaluateCompliance({
      ...base,
      state: "FL",
      botanicalName: "Castanea dentata",
      compliance: {
        carveOuts: { "castanea dentata": { kind: "block", states: ["FL"] } },
        regulatedStates: ["FL"],
      },
    });
    expect(v).toMatchObject({ kind: "restricted", taxonLabel: "Castanea dentata" });
  });

  it("honours an allow-only rule as 'blocked everywhere else'", () => {
    const only = {
      carveOuts: { quercus: { kind: "allow" as const, states: ["WV"] } },
      regulatedStates: ["WV"],
    };
    expect(evaluateCompliance({ ...base, state: "WV", botanicalName: "Quercus alba", compliance: only }).kind).toBe("clear");
    expect(evaluateCompliance({ ...base, state: "GA", botanicalName: "Quercus alba", compliance: only }).kind).toBe("restricted");
  });
});

describe("feed resolution", () => {
  const feed = {
    schema: 2,
    compliance: {
      schema: 1,
      carve_outs: { quercus: { kind: "block" as const, states: ["ME"] } },
      regulated_states: ["ME"],
    },
    bundle_substitution: {
      schema: 1,
      substitutes: { quercus: { botanical: "Acer rubrum", label: "Red Maple", native: true } },
    },
  } as unknown as ShippingRateFeed;

  it("prefers the live feed over the baked snapshot", () => {
    expect(resolveCompliance(feed).regulatedStates).toEqual(["ME"]);
    expect(resolveSubstitutes(feed).quercus.label).toBe("Red Maple");
    // The feed is authoritative, so a snapshot-only taxon must NOT leak through.
    expect(resolveCompliance(feed).carveOuts.castanea).toBeUndefined();
  });

  it("falls back to the snapshot on a missing, null, or empty compliance block", () => {
    expect(resolveCompliance(null)).toBe(SNAPSHOT_COMPLIANCE);
    expect(resolveCompliance(undefined)).toBe(SNAPSHOT_COMPLIANCE);
    expect(resolveCompliance({ schema: 2 } as ShippingRateFeed)).toBe(SNAPSHOT_COMPLIANCE);
    expect(
      resolveCompliance({
        schema: 2,
        compliance: { schema: 1, carve_outs: {}, regulated_states: [] },
      } as unknown as ShippingRateFeed),
    ).toBe(SNAPSHOT_COMPLIANCE);
    expect(resolveSubstitutes(null)).toBe(SNAPSHOT_SUBSTITUTES);
  });
});
