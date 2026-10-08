import { describe, expect, it } from "vitest";
import { needsPollinationPartner, plantTwoVerdict, PLANT_TWO_QUANTITY } from "./plant-two";

/**
 * The "plant two" hint is the only PDP element that tells a buyer to buy a
 * second tree, so its trigger has to be an explicit rule over the authored
 * pollination prose — never a fuzzy keyword scan (GOL-2734). These cases are the
 * contract: the live prod strings, the phrasings the listing spec's helper text
 * blesses, and the traps that a naive `includes("second variety")` gets wrong.
 */
describe("plantTwoVerdict", () => {
  it("is silent when there is no pollination fact", () => {
    // An em-dash placeholder normalizes to nothing → same "absent" verdict.
    for (const blank of [null, undefined, "", "   ", "\n", "\u2014"]) {
      expect(plantTwoVerdict(blank)).toEqual({ needsPartner: false, reason: "absent" });
    }
  });

  it("is silent on the non-fruiting sentinels the listing spec uses", () => {
    for (const s of ["Not applicable", "not applicable", "N/A", "n/a", "None"]) {
      const v = plantTwoVerdict(s);
      expect(v.needsPartner, s).toBe(false);
      expect(v.reason, s).toBe("not-applicable");
    }
  });

  it("fires on the live prod strings", () => {
    // PawPaw, product.template 91 on prod as of 2026-09-30.
    expect(plantTwoVerdict("Needs second variety")).toEqual({
      needsPartner: true,
      reason: "partner-required",
    });
    // Black Walnut's authored phrasing (GOL-2674 draft).
    expect(needsPollinationPartner("Not self-fertile — plant 2+ trees")).toBe(true);
  });

  it("fires on the phrasings the Odoo helper text blesses", () => {
    for (const s of [
      "Needs a second variety",
      "Needs a second cultivar to fruit",
      "Requires a second variety nearby",
      "Requires a pollinator",
      "Needs a pollination partner",
      "Second variety required",
      "Another variety needed within 50 ft",
      "Cross-pollination required",
      "Requires cross pollination",
      "Plant two for fruit",
      "Plant 2+ trees",
      "Plant at least two seedlings",
      "Dioecious — male and female plants needed",
    ]) {
      expect(needsPollinationPartner(s), s).toBe(true);
    }
  });

  it("stays silent on self-fertile listings", () => {
    for (const s of ["Self-fertile", "Self fertile", "Self-pollinating", "Self-fruitful"]) {
      const v = plantTwoVerdict(s);
      expect(v.needsPartner, s).toBe(false);
      expect(v.reason, s).toBe("self-fertile");
    }
  });

  it("stays silent when a partner only IMPROVES yield on a self-fertile plant", () => {
    // The trap: a naive "second variety" substring match would push a tree the
    // buyer does not need. Self-fertility is checked first and wins.
    for (const s of [
      "Self-fertile, but a second variety improves set",
      "Self-fertile; yields more with another cultivar nearby",
      "Self-pollinating — a second variety increases fruit size",
    ]) {
      const v = plantTwoVerdict(s);
      expect(v.needsPartner, s).toBe(false);
      expect(v.reason, s).toBe("self-fertile");
    }
  });

  it("fires when self-fertility is explicitly negated", () => {
    for (const s of [
      "Not self-fertile",
      "Not self-pollinating",
      "Non-self-fertile",
      "Self-sterile",
      "Self-incompatible",
    ]) {
      const v = plantTwoVerdict(s);
      expect(v.needsPartner, s).toBe(true);
      expect(v.reason, s).toBe("self-negated");
    }
  });

  it("stays silent when the prose says no partner is needed", () => {
    for (const s of [
      "No pollinator needed",
      "No second variety required",
      "Doesn't need a pollinator",
      "Does not require a second variety",
      // An explicitly negated requirement must not be read backwards by the bare
      // "second variety" noun pattern in PARTNER_REQUIRED (GOL-3239).
      "A second variety is not required",
      "A second variety is not needed",
      "No second variety is necessary",
      "Second variety unnecessary",
      "Male and female plants not needed",
    ]) {
      expect(needsPollinationPartner(s), s).toBe(false);
    }
  });

  it("fails closed on prose it does not recognise", () => {
    for (const s of ["Wind-pollinated", "Bees love it", "Pollination: see guide", "Insect"]) {
      const v = plantTwoVerdict(s);
      expect(v.needsPartner, s).toBe(false);
      expect(v.reason, s).toBe("unrecognised");
    }
  });

  it("is insensitive to case, unicode dashes and curly apostrophes", () => {
    expect(needsPollinationPartner("NEEDS A SECOND VARIETY")).toBe(true);
    expect(needsPollinationPartner("Needs a second variety — plant two")).toBe(true);
    expect(needsPollinationPartner("Self‑fertile")).toBe(false);
    expect(needsPollinationPartner("Doesn’t need a pollinator")).toBe(false);
  });

  it("asks for exactly two plants", () => {
    expect(PLANT_TWO_QUANTITY).toBe(2);
  });
});
