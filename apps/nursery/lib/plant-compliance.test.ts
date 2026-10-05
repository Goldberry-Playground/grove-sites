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
