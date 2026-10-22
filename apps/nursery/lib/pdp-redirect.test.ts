import { describe, expect, it, vi } from "vitest";

vi.mock("../data/slug-aliases", () => ({
  SLUG_ALIASES: { "service-berry": "serviceberry" },
}));

import { pdpRedirectTarget } from "./pdp-redirect";

const noLookup = async () => {
  throw new Error("slug segments must not hit Odoo");
};

describe("pdpRedirectTarget (GOL-3601)", () => {
  it("R1: 301s a product id to its slug", async () => {
    expect(await pdpRedirectTarget("93", async () => "american-chestnut")).toBe(
      "american-chestnut",
    );
  });

  it("R1/R5: lets an unknown id through so the page answers a real 404", async () => {
    expect(await pdpRedirectTarget("999999", async () => null)).toBeNull();
  });

  it("R4: lets a product with a blank slug through to the id form", async () => {
    expect(await pdpRedirectTarget("93", async () => "")).toBeNull();
  });

  it("R2: never redirects to an id, even if the lookup returns a numeric slug", async () => {
    expect(await pdpRedirectTarget("93", async () => "1999")).toBeNull();
  });

  it("leaves a current lowercase slug alone without touching Odoo", async () => {
    expect(await pdpRedirectTarget("american-chestnut", noLookup)).toBeNull();
  });

  it("R3: 301s a retired slug to its current one", async () => {
    expect(await pdpRedirectTarget("service-berry", noLookup)).toBe("serviceberry");
  });

  it("R6: 301s mixed case to lowercase", async () => {
    expect(await pdpRedirectTarget("American-Chestnut", noLookup)).toBe("american-chestnut");
  });

  it("R3+R6: a mixed-case retired slug resolves in ONE hop", async () => {
    expect(await pdpRedirectTarget("Service-Berry", noLookup)).toBe("serviceberry");
  });
});
